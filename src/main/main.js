'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const {
  app, session, BrowserWindow, Tray, Menu, ipcMain, screen, protocol, net, shell, globalShortcut, nativeImage,
  clipboard, ClipboardItem, desktopCapturer,
} = require('electron');

const config = require('./config');
const { TRAY, LANGS } = require('./labels');
const { createBridge } = require('./bridge');
const { startWindowWatch, getLedgesOnce } = require('./windows');
const memory = require('./memory');
const hands = require('./hands');
const { discordRpc } = require('./discord-rpc-pipe');
const ollama = require('./ollama');
const apps = require('./apps');
const media = require('./media');
const music = require('./music');
const { DiscordBridge } = require('./discord');
const stt = require('./stt');
const screenCapture = require('./screen-capture');
const assistantTools = require('./assistant-tools');
const configStore = require('./config-store');
const tts = require('./tts');
const aiVault = require('./ai-vault');
const hardwareGuardian = require('./hardware-guardian');
const { cleanupGuardian } = require('./cleanup-hook');
const { antigravityHook } = require('./antigravity-hook');
const hooks = require('../../scripts/install-hooks');
const demoSteps = require('../../scripts/demo-sequence');

const ROOT = path.resolve(__dirname, '..', '..');
const DEV = process.argv.includes('--dev');
const PORT = Number(process.env.CAPRI_PORT) || 47823;
const SOUND_EXT = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;
const CLAUDE_CODE_HELP = 'https://code.claude.com/docs/en/quickstart';
const OLLAMA_SITE = 'https://ollama.com';
const AI_HELP = 'https://aistudio.google.com/apikey'; // free Gemini API key

// In-Process Antigravity Webhook Engine (Zero child processes spawned)
function updateAgentHookState(enabled) {
  if (enabled) {
    antigravityHook.start({
      onActivity: (activity) => {
        overlay?.webContents.send('antigravity:activity', activity);
      },
    });
  } else {
    antigravityHook.stop();
  }
}

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync(path.join(ROOT, 'startup_err.log'), `[uncaughtException] ${new Date().toISOString()} ${err.stack || err}\n`);
  } catch {}
  console.error('[main] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(path.join(ROOT, 'startup_err.log'), `[unhandledRejection] ${new Date().toISOString()} ${reason?.stack || reason}\n`);
  } catch {}
  console.error('[main] unhandledRejection:', reason);
});

// Prevent Chromium from freezing timers, rendering, and Web Audio when in background/unfocused
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

protocol.registerSchemesAsPrivileged([
  { scheme: 'capri', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let overlay = null;
let tray = null;
let trayMenu = null; // also what she opens when you right-click her
let demoTimer = null;
let windowWatch = null;
// the watcher only speaks when something changes: the overlay asks for this when it (re)loads
let lastWindows = null;
let chatModels = null; // the Ollama models, as last seen (null: Ollama not reached)
const chats = new Map(); // id -> AbortController of an answer being streamed
let lastMusicState = null;
let discord = null;
let availableMicrophones = [];

const userSoundsDir = () => path.join(app.getPath('userData'), 'sounds');
const getMusicDirs = () => music.getMusicDirs(app.getPath('music'), app.getPath('userData'), ROOT);

function sendMusicCommand(cmd) {
  overlay?.webContents.send('capri:music', cmd);
}

// capri://app/...        -> files of this repo
// capri://usersounds/... -> the user's own sound overrides
// capri://music/<id>     -> in-app music tracks
function serveProtocol() {
  protocol.handle('capri', (request) => {
    const url = new URL(request.url);
    if (url.host === 'music') {
      const id = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      const filePath = music.getLocalTrackPath(id);
      if (filePath && fs.existsSync(filePath)) {
        return net.fetch(pathToFileURL(filePath).toString());
      }
      return new Response('track not found', { status: 404 });
    }
    const base = url.host === 'usersounds' ? userSoundsDir() : ROOT;
    const target = path.resolve(base, '.' + decodeURIComponent(url.pathname));
    if (target !== base && !target.startsWith(base + path.sep)) {
      return new Response('forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(target).toString());
  });
}

function targetDisplay() {
  const { displayId } = config.load();
  return screen.getAllDisplays().find((d) => d.id === displayId) || screen.getPrimaryDisplay();
}

function fitOverlay() {
  if (!overlay) return;
  const display = targetDisplay();
  const bounds = display.bounds;
  overlay.setBounds({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height });
  overlay.webContents.send('overlay:resize', { width: bounds.width, height: bounds.height });
}

function createOverlay() {
  const display = targetDisplay();
  const bounds = display.bounds;
  overlay = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    type: process.platform === 'win32' ? 'toolbar' : undefined,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadURL('capri://app/src/renderer/index.html');
  overlay.on('close', (e) => {
    fs.appendFileSync(path.join(ROOT, 'startup_boot.log'), `[boot] overlay close event! preventDefault: ${e.defaultPrevented}\n`);
  });
  overlay.webContents.on('did-fail-load', (e, code, desc) => {
    fs.appendFileSync(path.join(ROOT, 'startup_boot.log'), `[boot] did-fail-load: ${code} ${desc}\n`);
  });
  overlay.webContents.on('render-process-gone', (_e, details) => {
    fs.appendFileSync(path.join(ROOT, 'startup_boot.log'), `[boot] renderer gone: ${details.reason} (exitCode: ${details.exitCode})\n`);
  });
  // always shown: put away, she's still there as her biochip in the corner
  overlay.once('ready-to-show', () => {
    fs.appendFileSync(path.join(ROOT, 'startup_boot.log'), `[boot] ready-to-show fired!\n`);
    overlay.showInactive();
  });
  overlay.webContents.on('preload-error', (_e, preloadPath, error) => {
    try { fs.appendFileSync(path.join(ROOT, 'renderer.log'), `[preload-error] ${preloadPath}: ${error?.stack || error}\n`); } catch {}
  });
  overlay.webContents.on('console-message', (e) => {
    const { level, message, lineNumber, sourceId } = e;
    const line = `[renderer:${level}] ${message} (${String(sourceId).split('/').pop()}:${lineNumber})\n`;
    try { fs.appendFileSync(path.join(ROOT, 'renderer.log'), line); } catch {}
    if (DEV) console.log(line.trim());
  });
  if (DEV && process.env.CAPRI_DEVTOOLS) overlay.webContents.openDevTools({ mode: 'detach' });
}

function sendCommand(name, payload = {}) {
  overlay?.webContents.send('capri:command', { name, ...payload });
}

// Ctrl+Alt+C: she folds herself away into her biochip in the corner, or comes back out of it.
function toggleVisible(force) {
  const visible = typeof force === 'boolean' ? force : !config.load().visible;
  config.save({ visible });
  sendCommand('stow', { on: !visible });
  rebuildTray();
}

function playDemo() {
  clearTimeout(demoTimer);
  let i = 0;
  const next = () => {
    if (i >= demoSteps.length) return;
    const [delay, evt] = demoSteps[i++];
    demoTimer = setTimeout(() => {
      overlay?.webContents.send('claude:event', evt);
      next();
    }, delay);
  };
  next();
}

// During the demo, a little fake terminal for her to sit on and take over (window tracking is
// Windows only, so only there). Opened without stealing focus; closing it drops her off it.
let demoWin = null;
const DEMO_TERMINAL = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 16px 20px; background: #090b10; color: #a0aec0;
    font-family: 'JetBrains Mono', 'Cascadia Code', Consolas, monospace; font-size: 13px; line-height: 1.6;
    overflow: hidden; user-select: none; border: 1px solid #00f0ff;
    box-shadow: inset 0 0 20px rgba(0, 240, 255, 0.15), 0 0 15px rgba(0, 240, 255, 0.3);
  }
  .term-header {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 8px; margin-bottom: 12px; border-bottom: 1px solid rgba(0, 240, 255, 0.2);
    font-size: 11px; letter-spacing: 0.1em; color: #00f0ff;
  }
  .term-dots { display: flex; gap: 6px; }
  .term-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .dot-red { background: #ff2a5f; }
  .dot-yellow { background: #fcee0a; }
  .dot-green { background: #00ff66; }
  .line-prompt { color: #00ff66; font-weight: bold; }
  .line-pass { color: #38bdf8; padding-left: 12px; }
  .line-check { color: #00ff66; font-weight: bold; }
  .line-summary { color: #fcee0a; font-weight: bold; margin-top: 6px; }
  .cursor { display: inline-block; width: 8px; height: 14px; background: #00f0ff; animation: blink 0.8s infinite; vertical-align: middle; }
  @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
</style></head>
<body>
  <div class="term-header">
    <div class="term-dots">
      <span class="term-dot dot-red"></span>
      <span class="term-dot dot-yellow"></span>
      <span class="term-dot dot-green"></span>
    </div>
    <span>TERMINAL // NIGHT-CITY-CORE [PID: 2077]</span>
    <span>BASH</span>
  </div>
  <div class="line-prompt">PS C:\\projects\\night-city-api&gt; npm test -- gigs</div>
  <div class="line-pass">GET /api/v1/gigs/feed</div>
  <div class="line-pass"><span class="line-check">✓</span> returns 20 items per page with cursor (18ms)</div>
  <div class="line-pass"><span class="line-check">✓</span> validates signature & auth tokens (42ms)</div>
  <div class="line-pass"><span class="line-check">✓</span> rejects unauthorized rogue packet (9ms)</div>
  <div class="line-summary">6 passing (186ms) — ALL SYSTEMS NOMINAL</div>
  <div class="line-prompt">PS C:\\projects\\night-city-api&gt; <span class="cursor"></span></div>
</body></html>`;

function demoWindow(open) {
  demoWin?.destroy();
  demoWin = null;
  if (!open || process.platform !== 'win32') return false;
  const b = overlay.getBounds();
  demoWin = new BrowserWindow({
    x: Math.round(b.x + b.width * 0.5 - 310), y: Math.round(b.y + b.height * 0.42), width: 620, height: 300,
    show: false, alwaysOnTop: true, title: 'night-city-api — npm test', backgroundColor: '#14101c', autoHideMenuBar: true,
  });
  demoWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(DEMO_TERMINAL)}`);
  demoWin.once('ready-to-show', () => demoWin?.showInactive());
  demoWin.on('closed', () => { demoWin = null; });
  return true;
}

// 'auto' -> the first system language Capri speaks, English otherwise.
function resolveLang(setting) {
  if (LANGS.includes(setting)) return setting;
  const preferred = [...app.getPreferredSystemLanguages(), app.getSystemLocale(), app.getLocale()];
  for (const tag of preferred) {
    const base = String(tag || '').toLowerCase().split(/[-_]/)[0];
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

// What the overlay gets: `lang` is the resolved one, `langSetting` what the user picked.
function rendererConfig() {
  const cfg = config.load();
  return { ...cfg, lang: resolveLang(cfg.lang), langSetting: cfg.lang };
}

function updateConfig(patch) {
  if (patch.agentHookEnabled !== undefined) {
    updateAgentHookState(Boolean(patch.agentHookEnabled));
  }
  config.save(patch);
  if (patch.discordToken !== undefined || patch.discordUserId !== undefined) {
    discord?.restart?.().catch((e) => console.warn('[discord] restart error on config update:', e));
  }
  const cfg = rendererConfig();
  overlay?.webContents.send('capri:config', cfg);
  rebuildTray();
  return cfg;
}

function rebuildTray() {
  if (!tray) return;
  const cfg = config.load();
  const hookState = hooks.status();
  const t = TRAY[resolveLang(cfg.lang)];

  const displays = screen.getAllDisplays();
  const current = targetDisplay().id;

  const menu = Menu.buildFromTemplate([
    { label: t.online(PORT), enabled: false },
    { type: 'separator' },
    { label: t.teleport, click: () => sendCommand('teleport') },
    { label: t.satellite, click: () => sendCommand('satellite') },
    { label: t.demo, click: playDemo },
    { label: t.help, click: () => sendCommand('welcome') },
    { label: t.report, click: () => sendCommand('report') },
    { label: t.talk, click: () => sendCommand('chat') },
    { label: cfg.visible ? t.hide : t.show, accelerator: 'Ctrl+Alt+C', click: () => toggleVisible() },
    { type: 'separator' },
    {
      label: t.size,
      submenu: [[t.small, 0.45], [t.medium, 0.6], [t.large, 0.8]].map(([label, scale]) => ({
        label, type: 'radio', checked: Math.abs(cfg.scale - scale) < 0.01, click: () => updateConfig({ scale }),
      })),
    },
    {
      label: t.inAppMusic,
      submenu: [
        {
          label: lastMusicState?.playing ? `⏸️ ${t.musicPlay}` : `▶️ ${t.musicPlay}`,
          click: () => sendMusicCommand({ action: 'toggle' }),
        },
        { label: `⏭️ ${t.musicNext}`, click: () => sendMusicCommand({ action: 'next' }) },
        { label: `⏮️ ${t.musicPrev}`, click: () => sendMusicCommand({ action: 'prev' }) },
        {
          label: t.musicShuffle,
          type: 'checkbox',
          checked: Boolean(lastMusicState?.shuffle),
          click: () => sendMusicCommand({ action: 'shuffle' }),
        },
        { type: 'separator' },
        {
          label: t.musicVol,
          submenu: [100, 80, 50, 25].map((pct) => ({
            label: `${pct}%`,
            type: 'radio',
            checked: Math.abs((lastMusicState?.volume || 70) - pct) < 15,
            click: () => sendMusicCommand({ action: 'volume', value: pct / 100 }),
          })),
        },
        {
          label: t.musicRadio,
          submenu: [
            { label: t.radioPlaza, click: () => sendMusicCommand({ action: 'radio', index: 0 }) },
            { label: t.radioDefcon, click: () => sendMusicCommand({ action: 'radio', index: 1 }) },
            { label: t.radioGroove, click: () => sendMusicCommand({ action: 'radio', index: 2 }) },
          ],
        },
        {
          label: t.musicTracks,
          submenu: lastMusicState?.tracks?.length
            ? lastMusicState.tracks.slice(0, 20).map((track, i) => ({
                label: track.title,
                click: () => sendMusicCommand({ action: 'track', index: i }),
              }))
            : [{ label: '(Thả file MP3 vào thư mục nhạc)', enabled: false }],
        },
        { type: 'separator' },
        {
          label: t.musicFolder,
          click: () => {
            const dir = getMusicDirs()[0];
            fs.mkdirSync(dir, { recursive: true });
            shell.openPath(dir);
          },
        },
      ],
    },
    {
      label: discord?.status().running ? `🤖 Discord Bot: ${discord.status().tag}` : '🤖 Discord Bot: Tắt',
      submenu: [
        {
          label: discord?.status().running ? 'Tắt kết nối Discord' : 'Bật kết nối Discord',
          click: async () => {
            if (discord?.status().running) await discord.stop();
            else await discord.start();
            rebuildTray();
          },
        },
        { type: 'separator' },
        {
          label: 'Mở file cấu hình .env...',
          click: () => shell.openPath(path.join(ROOT, '.env')),
        },
      ],
    },
    {
      label: t.sound,
      submenu: [
        { label: t.mute, type: 'checkbox', checked: cfg.muted, click: (item) => updateConfig({ muted: item.checked }) },
        { type: 'separator' },
        {
          label: t.soundsDir,
          click: () => {
            fs.mkdirSync(userSoundsDir(), { recursive: true });
            shell.openPath(userSoundsDir());
          },
        },
      ],
    },
    {
      label: t.media,
      submenu: [
        { label: t.mediaPlay, click: () => media.action('playpause') },
        { label: t.mediaNext, click: () => media.action('next') },
        { label: t.mediaPrev, click: () => media.action('prev') },
        { type: 'separator' },
        { label: t.mediaVolUp, click: () => media.action('volup') },
        { label: t.mediaVolDown, click: () => media.action('voldown') },
        { label: t.mediaMute, click: () => media.action('mute') },
      ],
    },
    {
      label: '🎙️ Giọng nói & "Hey Capri"',
      submenu: [
        {
          label: '🎙️ Luôn nghe "Hey Capri" (Wake Word)',
          type: 'checkbox',
          checked: Boolean(cfg.wakeWord ?? true),
          click: (item) => {
            updateConfig({ wakeWord: item.checked });
            overlay?.webContents.send('capri:voice:toggle-wakeword', item.checked);
            rebuildTray();
          },
        },
        {
          label: '🎙️ Nhấn để nói (Alt+V)',
          accelerator: 'Alt+V',
          click: () => {
            overlay?.webContents.send('capri:voice:listen');
          },
        },
        { type: 'separator' },
        {
          label: '🎤 Chọn Micro thu âm',
          submenu: availableMicrophones.length > 0
            ? [
                ...(availableMicrophones.some((m) => m.id === 'default') ? [] : [{
                  label: 'Mặc định hệ thống',
                  type: 'radio',
                  checked: !cfg.micDeviceId || cfg.micDeviceId === 'default',
                  click: () => {
                    updateConfig({ micDeviceId: 'default' });
                    overlay?.webContents.send('capri:voice:set-microphone', 'default');
                    rebuildTray();
                  },
                }]),
                ...availableMicrophones.map((mic, idx) => {
                  const isChecked = cfg.micDeviceId
                    ? cfg.micDeviceId === mic.id
                    : (mic.id === 'default' || idx === 0);
                  return {
                    label: mic.label || `Microphone ${idx + 1}`,
                    type: 'radio',
                    checked: isChecked,
                    click: () => {
                      updateConfig({ micDeviceId: mic.id });
                      overlay?.webContents.send('capri:voice:set-microphone', mic.id);
                      rebuildTray();
                    },
                  };
                }),
              ]
            : [{ label: 'Đang quét thiết bị...', enabled: false }],
        },
      ],
    },
    {
      label: '⏱️ Tự thu gọn vào Biochip',
      submenu: [
        {
          label: '1 phút (Mặc định)',
          type: 'radio',
          checked: Number(cfg.inactivityMinutes ?? 1) === 1,
          click: () => {
            updateConfig({ inactivityMinutes: 1 });
            overlay?.webContents.send('capri:inactivity-config', 1);
            rebuildTray();
          },
        },
        {
          label: '3 phút',
          type: 'radio',
          checked: Number(cfg.inactivityMinutes) === 3,
          click: () => {
            updateConfig({ inactivityMinutes: 3 });
            overlay?.webContents.send('capri:inactivity-config', 3);
            rebuildTray();
          },
        },
        {
          label: '5 phút',
          type: 'radio',
          checked: Number(cfg.inactivityMinutes) === 5,
          click: () => {
            updateConfig({ inactivityMinutes: 5 });
            overlay?.webContents.send('capri:inactivity-config', 5);
            rebuildTray();
          },
        },
        {
          label: '10 phút',
          type: 'radio',
          checked: Number(cfg.inactivityMinutes) === 10,
          click: () => {
            updateConfig({ inactivityMinutes: 10 });
            overlay?.webContents.send('capri:inactivity-config', 10);
            rebuildTray();
          },
        },
        {
          label: 'Tắt (Không tự thu)',
          type: 'radio',
          checked: Number(cfg.inactivityMinutes) === 0,
          click: () => {
            updateConfig({ inactivityMinutes: 0 });
            overlay?.webContents.send('capri:inactivity-config', 0);
            rebuildTray();
          },
        },
      ],
    },
    {
      label: t.screen,
      enabled: displays.length > 1,
      submenu: displays.map((d, i) => ({
        label: `${i + 1} — ${d.size.width}×${d.size.height}`,
        type: 'radio',
        checked: d.id === current,
        click: () => { config.save({ displayId: d.id }); fitOverlay(); rebuildTray(); },
      })),
    },
    {
      label: t.chatModel,
      submenu: ollama.provider() === 'openai'
        ? [{ label: `✓ ${process.env.AI_MODEL || 'OpenAI API'}`, enabled: false }]
        : chatModels?.length
          ? chatModels.map((name) => ({
            label: name, type: 'radio', checked: name === pickModel(cfg), click: () => updateConfig({ chatModel: name }),
          }))
          : [{ label: t.noOllama, enabled: false }],
    },
    { label: t.wander, type: 'checkbox', checked: cfg.wander, click: (item) => updateConfig({ wander: item.checked }) },
    { label: t.possess, type: 'checkbox', checked: cfg.possess, click: (item) => updateConfig({ possess: item.checked }) },
    {
      label: t.lang,
      submenu: [[t.auto, 'auto'], ...LANGS.map((lang) => [TRAY[lang].name, lang])].map(([label, lang]) => ({
        label, type: 'radio', checked: cfg.lang === lang, click: () => updateConfig({ lang }),
      })),
    },
    {
      label: t.startup,
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginItemOptions()).openAtLogin,
      click: (item) => app.setLoginItemSettings({ ...loginItemOptions(), openAtLogin: item.checked }),
    },
    { type: 'separator' },
    hookState.installed
      ? { label: t.hooksOn, enabled: false }
      : { label: t.hooksOff, click: () => runHooks('install') },
    ...(hookState.installed ? [{ label: t.hooksRemove, click: () => runHooks('uninstall') }] : []),
    { type: 'separator' },
    { label: t.quit, click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  trayMenu = menu;
}

// Run from a clone (`npm start`), electron.exe alone would open the default Electron app at login:
// it needs the project folder as argument.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [ROOT] };
}

// From the tray, she says how it went; from her welcome panel (quiet), the panel does.
function runHooks(action, { quiet = false } = {}) {
  let outcome;
  try {
    const result = action === 'install' ? hooks.install() : hooks.uninstall();
    outcome = { action, ok: true, file: result.file };
  } catch (err) {
    outcome = { action, ok: false, error: err.message };
  }
  if (!quiet) sendCommand('hooks', outcome);
  rebuildTray();
  return outcome;
}

// The model she talks with: the one picked in her menu if it's still installed, else the first.
function pickModel(cfg = config.load()) {
  if (!chatModels?.length) return null;
  return chatModels.includes(cfg.chatModel) ? cfg.chatModel : chatModels[0];
}

async function refreshModels() {
  chatModels = await ollama.models().catch(() => null);
  rebuildTray();
  return chatModels;
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(ROOT, 'assets', 'icons', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('Capri');
  tray.on('click', () => sendCommand('status'));
  rebuildTray();
}

function registerIpc() {
  ipcMain.on('overlay:interactive', (_e, on) => {
    overlay?.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.handle('overlay:cursor', () => {
    const p = screen.getCursorScreenPoint();
    const b = overlay.getBounds();
    return { x: p.x - b.x, y: p.y - b.y, inside: p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height };
  });
  ipcMain.handle('config:get', () => rendererConfig());
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.on('app:open-external', (_e, url) => {
    if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
      shell.openExternal(url);
    }
  });
  ipcMain.handle('hooks:status', () => hooks.status());
  ipcMain.handle('config:set', (_e, patch) => updateConfig(patch));
  ipcMain.handle('agent:toggle-hook', (_e, enabled) => {
    updateAgentHookState(Boolean(enabled));
    updateConfig({ agentHookEnabled: Boolean(enabled) });
    return { ok: true, enabled: Boolean(enabled) };
  });
  ipcMain.handle('agent:test-hook', () => {
    const act = { verb: 'AGENT', target: 'TEST HOOK: SYNCHRONIZED', emote: 'bolt' };
    overlay?.webContents.send('antigravity:activity', act);
    return { ok: true };
  });
  ipcMain.handle('demo:window', (_e, open) => demoWindow(open));
  // right-clicking her: the same menu as the tray icon (which Windows often hides behind the ^ by the clock)
  ipcMain.on('menu:open', () => trayMenu?.popup({ window: overlay }));
  // her welcome panel's buttons
  ipcMain.handle('hooks:install', () => runHooks('install', { quiet: true }));
  ipcMain.handle('claude:found', () => fs.existsSync(path.dirname(hooks.status().file))); // Claude Code keeps its settings there
  ipcMain.on('claude:help', () => shell.openExternal(CLAUDE_CODE_HELP));
  ipcMain.handle('windows:get', () => lastWindows);
  // talking to her (chat.js): is Ollama there, with a model to talk with
  // talking to her (chat.js): is an AI backend available (OpenAI-compatible API or Ollama)
  ipcMain.handle('chat:status', async () => {
    if (ollama.provider() === 'openai') {
      // OpenAI-compatible API configured: no model listing needed, just use the configured model
      const model = (await ollama.models().catch(() => []))[0];
      if (!model) return { ok: false, error: 'offline' };
      return { ok: true, model, provider: 'openai' };
    }
    const models = await refreshModels();
    if (!models) return { ok: false, error: 'offline' };
    if (!models.length) return { ok: false, error: 'nomodel' };
    ollama.warm(pickModel()); // loading while you type your first message
    return { ok: true, model: pickModel(), provider: 'ollama' };
  });
  // her answer, streamed to the overlay piece by piece as `chat:delta`
  ipcMain.handle('chat:send', async (_e, { id, messages }) => {
    const abort = new AbortController();
    chats.set(id, abort);
    try {
      const send = (text) => overlay?.webContents.send('chat:delta', { id, text });
      const model = ollama.provider() === 'openai' ? (await ollama.models().catch(() => []))[0] : pickModel();
      const text = await ollama.chat({ model, messages }, send, abort.signal);
      return { ok: true, text };
    } catch (err) {
      return { ok: false, error: abort.signal.aborted ? 'stopped' : err.message };
    } finally {
      chats.delete(id);
    }
  });
  ipcMain.on('chat:stop', (_e, id) => chats.get(id)?.abort());
  ipcMain.on('chat:ollama', () => shell.openExternal(OLLAMA_SITE));
  // closing an app you asked her to close, once you've clicked to confirm (apps.js)
  const appInfo = (app) => app && { name: app.process, label: app.label };
  ipcMain.handle('apps:list', async () => (await apps.list().catch(() => [])).map(appInfo));
  ipcMain.handle('apps:find', async (_e, wanted) => appInfo(await apps.find(wanted).catch(() => null)));
  ipcMain.handle('apps:close', (_e, { name, force }) => apps.close(name, { force }).catch((err) => ({ error: err.message })));
  // media player control (external Spotify / media)
  ipcMain.handle('media:action', async (_e, action) => media.action(action));
  // in-app music player
  ipcMain.handle('music:list', () => music.scanLocalMusic(getMusicDirs()));
  ipcMain.handle('music:search', async (_e, query) => music.searchYouTube(query));
  ipcMain.handle('music:resolve', async (_e, query) => music.resolveTrack(query, PORT));
  ipcMain.handle('music:openFolder', () => {
    const dir = getMusicDirs()[0];
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
    return dir;
  });
  ipcMain.on('music:command', (_e, cmd) => sendMusicCommand(cmd));
  ipcMain.on('music:state', (_e, state) => {
    lastMusicState = state;
    if (discord?.running) discord.updateActivity(state?.title, state?.playing);
    rebuildTray();
  });
  ipcMain.handle('apps:openSpotify', (_e, query) => apps.openSpotify(query));
  ipcMain.handle('apps:openWeb', (_e, { service, query }) => apps.openWebMusic(service, query));
  ipcMain.handle('apps:launch', (_e, appName) => apps.launchApp(appName));
  ipcMain.handle('screen:screenshot', () => screenCapture.takeScreenshot({ overlay, hideOverlay: true }));
  ipcMain.handle('screen:get-sources', () => screenCapture.getScreenSources());
  ipcMain.handle('screen:save-recording', (_e, payload) => {
    const buf = payload?.buffer || payload;
    const mimeType = payload?.mimeType || 'video/webm';
    return screenCapture.saveScreenRecording(buf, mimeType);
  });
  ipcMain.handle('screen:open-folder', (_e, dirPath) => screenCapture.openFolder(dirPath));
  ipcMain.handle('assistant:time', (_e, lang) => assistantTools.getTimeAndDate(lang));
  ipcMain.handle('assistant:weather', (_e, payload) => {
    const city = typeof payload === 'string' ? payload : (payload?.city || '');
    const lang = payload?.lang || 'vi';
    return assistantTools.getWeather(city, lang);
  });
  ipcMain.handle('discord:status', () => discord?.status() || { running: false });
  ipcMain.handle('discord:restart', async () => {
    if (!discord) return { ok: false, error: 'Discord Bot is not initialized.' };
    return await discord.restart();
  });
  ipcMain.handle('discord:command', async (_e, payload) => {
    if (!discord) return { ok: false, message: 'Discord Bot is not initialized.' };
    return await discord.handleDesktopCommand(payload);
  });
  ipcMain.handle('stt:transcribe', async (_e, { buffer, mimeType }) => {
    return await stt.transcribeAudio(buffer, mimeType);
  });
  // Cyberpunk Overhaul IPCs
  ipcMain.handle('tts:speak', async (_e, { text, options }) => tts.speak(text, options));
  ipcMain.handle('ai:chat', async (_e, { messages, options }) => aiVault.chat(messages, options));
  ipcMain.handle('ai:vision', async (_e, { prompt, base64Image, mimeType, options }) => aiVault.vision(prompt, base64Image, mimeType, options));
  ipcMain.handle('ai:test-provider', async (_e, providerId) => aiVault.testProvider(providerId));
  ipcMain.handle('screen:save-instant-replay', async (_e, { buffer, mimeType }) => screenCapture.saveInstantReplay(buffer, mimeType));
  ipcMain.handle('screen:open-file', async (_e, filePath) => screenCapture.openFile(filePath));
  ipcMain.handle('screen:share-discord', async (_e, filePath) => {
    if (!discord) return { ok: false, error: 'Discord Bot chưa khởi động.' };
    return await discord.shareFile(filePath);
  });

  // Windows ledge snap (single-shot, 0% CPU idle)
  ipcMain.handle('windows:get-ledges', () => getLedgesOnce(overlay));

  // Long-Term Memory (me.md)
  ipcMain.handle('memory:get', () => memory.getMemory());
  ipcMain.handle('memory:save', (_e, content) => memory.saveMemory(content));
  ipcMain.handle('memory:append', (_e, note) => memory.appendMemory(note));

  // Safe Hands Tools (Hands.cs & Computer.cs port)
  ipcMain.handle('hands:open-app', (_e, appName) => hands.openApp(appName));
  ipcMain.handle('hands:switch-app', (_e, target) => hands.switchApp(target));
  ipcMain.handle('hands:minimize-app', (_e, target) => hands.minimizeApp(target));
  ipcMain.handle('hands:shortcut', (_e, combo) => hands.sendShortcut(combo));
  ipcMain.handle('hands:power', (_e, action) => hands.systemPower(action));

  // Discord Local Named Pipe Rich Presence
  ipcMain.handle('discord-rpc:status', () => discordRpc.getStatus());
  ipcMain.handle('discord-rpc:toggle', (_e, enabled) => {
    discordRpc.enabled = Boolean(enabled);
    if (!enabled) discordRpc.stop();
    else discordRpc.start();
    return discordRpc.getStatus();
  });
  ipcMain.on('voice:microphones', (_e, mics) => {
    if (Array.isArray(mics)) {
      availableMicrophones = mics;
      rebuildTray();
    }
  });
  ipcMain.handle('discord:toggle', async () => {
    if (!discord) return false;
    if (discord.running) await discord.stop();
    else await discord.start();
    rebuildTray();
    return discord.status();
  });
  // typing to her: the overlay takes the keyboard while the chat is open, and gives it back after
  ipcMain.on('overlay:focus', (_e, on) => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setFocusable(Boolean(on));
    if (on) overlay.focus();
    else overlay.blur();
  });
  ipcMain.on('window:set-focusable', (_e, on) => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setFocusable(Boolean(on));
    if (on) overlay.focus();
    else overlay.blur();
  });
  ipcMain.on('window:focus-input', (_e) => {
    if (!overlay || overlay.isDestroyed()) return;
    overlay.setFocusable(true);
    overlay.focus();
    overlay.setIgnoreMouseEvents(false, { forward: true });
  });
  // her report card's copy button: a picture of that part of the overlay, on the clipboard
  ipcMain.handle('panel:copy', async (_e, rect) => {
    const image = await overlay.webContents.capturePage(rect);
    if (image.isEmpty()) return false;
    const png = new Blob([image.toPNG()], { type: 'image/png' });
    await clipboard.write([new ClipboardItem({ 'image/png': png })]);
    return true;
  });
  // her guide: where her tray icon is (it lives in the taskbar, off the overlay, hence overlay
  // coordinates past its edge), and the corner by the clock in case Windows hid it behind the ^
  ipcMain.handle('guide:tray', () => {
    const o = overlay.getBounds();
    const d = targetDisplay().bounds;
    const b = tray?.getBounds();
    const icon = b && b.width > 0 ? { x: b.x - o.x, y: b.y - o.y, w: b.width, h: b.height } : null;
    const corner = { x: d.x + d.width - 150 - o.x, y: d.y + d.height - 44 - o.y, w: 140, h: 40 };
    return { icon, corner };
  });
  // her guide: Claude Code's folder (~/.claude) in Explorer, its settings file selected
  ipcMain.handle('guide:claudeFolder', () => {
    const file = hooks.status().file;
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) return { found: false, dir };
    if (fs.existsSync(file)) shell.showItemInFolder(file);
    else shell.openPath(dir);
    return { found: true, dir, file: fs.existsSync(file) };
  });
  ipcMain.handle('sounds:list', () => {
    try {
      return fs.readdirSync(userSoundsDir())
        .filter((f) => SOUND_EXT.test(f))
        .map((f) => ({ name: f.replace(SOUND_EXT, '').toLowerCase(), url: `capri://usersounds/${encodeURIComponent(f)}` }));
    } catch {
      return [];
    }
  });
}

// Only in --dev: lets scripts drive the overlay and grab frames of it (no desktop content, just our window).
const testWins = new Map(); // name -> test window

async function debugHandler(route, body) {
  if (!DEV) throw new Error('debug routes need --dev');
  if (route === 'command') {
    sendCommand(body.name, body);
    return { ok: true };
  }
  if (route === 'reload') {
    overlay.webContents.reloadIgnoringCache();
    return { ok: true };
  }
  if (route === 'testwin') {
    // plain windows to sit on, opened without stealing focus, by name (`id`, default "main");
    // each one opened goes in front of the others. { open: false } without an id closes them all.
    const id = body.id ?? 'main';
    if (!body.open && body.id === undefined) {
      for (const win of testWins.values()) win.destroy();
      testWins.clear();
      return { ok: true };
    }
    testWins.get(id)?.destroy();
    testWins.delete(id);
    if (body.open) {
      const b = overlay.getBounds();
      const win = new BrowserWindow({
        x: b.x + (body.x ?? 300), y: b.y + (body.y ?? 380), width: body.w ?? 720, height: body.h ?? 380,
        show: false, alwaysOnTop: true, title: `Capri test window ${id}`, backgroundColor: '#1b1726',
      });
      win.loadURL('data:text/html,<body style="background:%231b1726"></body>');
      win.showInactive();
      testWins.set(id, win);
    }
    return { ok: true };
  }
  if (route === 'movewin' && testWins.has(body.id ?? 'main')) {
    const win = testWins.get(body.id ?? 'main');
    const [x, y] = win.getPosition();
    win.setPosition(x + (body.dx || 0), y + (body.dy || 0));
    return { ok: true };
  }
  if (route === 'mouse') {
    // the pointer moving over the overlay (css px), and clicking if asked, without touching the real one
    const at = { x: Math.round(body.x), y: Math.round(body.y) };
    overlay.webContents.sendInputEvent({ type: 'mouseMove', ...at });
    if (body.click) {
      overlay.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...at });
      overlay.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...at });
    }
    return { ok: true };
  }
  if (route === 'type') {
    // typing into the overlay (her chat), and Enter if asked
    if (body.text) await overlay.webContents.insertText(body.text);
    if (body.enter) {
      overlay.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
      overlay.webContents.sendInputEvent({ type: 'char', keyCode: 'Return' });
      overlay.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
    }
    return { ok: true };
  }
  if (route === 'capture') {
    const image = await overlay.webContents.capturePage();
    // installed, the app's own folder is read-only: its data folder instead
    const dir = path.join(app.isPackaged ? app.getPath('userData') : ROOT, 'captures');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${(body.name || 'frame').replace(/[^\w-]/g, '')}.png`);
    fs.writeFileSync(file, image.toPNG());
    return { ok: true, file };
  }
  throw new Error('unknown debug route');
}

function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => sendCommand('status'));
  if (process.platform === 'win32') app.setAppUserModelId('capri.desktop');

  app.whenReady().then(() => {
    // Automatically allow media / audio capture / display capture
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      if (permission === 'media' || permission === 'audioCapture' || permission === 'display-capture') {
        return callback(true);
      }
      callback(false);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      if (permission === 'media' || permission === 'audioCapture' || permission === 'display-capture') {
        return true;
      }
      return false;
    });

    // Handle desktop screen and Windows loopback system audio capture
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        callback({ video: sources[0], audio: 'loopback' });
      } catch (err) {
        console.warn('[main] setDisplayMediaRequestHandler error:', err.message);
        callback({ video: null });
      }
    });

    try {
      serveProtocol();
      registerIpc();
      createOverlay();
      createTray();
      cleanupGuardian.cleanOrphanProcesses();
      cleanupGuardian.attachToElectron(app);
    } catch (e) {
      console.error('[main] Setup error:', e);
    }

    try {
      windowWatch = startWindowWatch({
        overlay,
        onUpdate: (data) => {
          lastWindows = data;
          overlay?.webContents.send('windows:update', data);

          // Detect gamer / fullscreen mode
          if (data && Array.isArray(data.wins)) {
            const fgWin = data.wins.find((w) => w.id === data.fg);
            if (fgWin) {
              const isGame = hardwareGuardian.isGameWindow(fgWin.title);
              const b = overlay ? overlay.getBounds() : { width: 1920, height: 1080 };
              const isFullscreen = fgWin.w >= b.width && fgWin.h >= b.height;
              if (isGame || isFullscreen) {
                overlay?.webContents.send('system:gamer-mode', { active: true, title: fgWin.title, isGame });
              }
            }
          }
        },
      });

      createBridge({
        port: PORT,
        onEvent: (evt) => overlay?.webContents.send('claude:event', evt),
        onDebug: DEV ? debugHandler : null,
        onAudioStream: (req, res, url) => music.handleAudioStream(req, res, url),
      });

      // In-process Antigravity Webhook initialization (Zero process leak)
      const startupCfg = configStore.load();
      if (startupCfg?.agentHookEnabled) {
        updateAgentHookState(true);
      }

      discord = new DiscordBridge({
        getOverlay: () => overlay,
        sendMusicCommand,
        port: PORT,
      });
      discord.start().catch((e) => console.warn('[discord] start error:', e)).finally(() => rebuildTray());
      discordRpc.start();

      globalShortcut.register('Control+Alt+C', () => toggleVisible());
      globalShortcut.register('Alt+V', () => {
        overlay?.webContents.send('capri:voice:listen');
      });
      globalShortcut.register('Alt+F10', () => {
        overlay?.webContents.send('capri:instant-replay');
      });

      hardwareGuardian.startHardwareGuardian(overlay);

      refreshModels(); // for her menu's model list
      screen.on('display-metrics-changed', fitOverlay);
      screen.on('display-added', () => { fitOverlay(); rebuildTray(); });
      screen.on('display-removed', () => { fitOverlay(); rebuildTray(); });
    } catch (e) {
      console.error('[main] Daemon setup error:', e);
    }
  });

  // Clean up and shutdown hook servers (Zero process leak)
  app.on('before-quit', () => {
    cleanupGuardian.teardown('app.before-quit');
    updateAgentHookState(false);
  });

  app.on('will-quit', () => {
    cleanupGuardian.teardown('app.will-quit');
    updateAgentHookState(false);
    globalShortcut.unregisterAll();
    windowWatch?.stop();
    discord?.stop();
  });
  app.on('window-all-closed', (e) => e.preventDefault());
}

main();
