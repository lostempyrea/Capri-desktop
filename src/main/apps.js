'use strict';

// Closing an app when you ask her to (chat.js), after you've confirmed with a click. The apps with
// a window, by name; closing one the way its own close button does (it can still ask you to save),
// and only if you ask again, forcing it. Windows only.

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { shell } = require('electron');
const yts = require('yt-search');

const KNOWN_APPS = {
  chrome: { cmd: 'chrome', name: 'Google Chrome' },
  'google chrome': { cmd: 'chrome', name: 'Google Chrome' },
  edge: { cmd: 'msedge', name: 'Microsoft Edge' },
  msedge: { cmd: 'msedge', name: 'Microsoft Edge' },
  'microsoft edge': { cmd: 'msedge', name: 'Microsoft Edge' },
  brave: { cmd: 'brave', name: 'Brave Browser' },
  discord: { cmd: 'discord', name: 'Discord' },
  spotify: { cmd: 'spotify', name: 'Spotify', protocol: 'spotify:' },
  steam: { cmd: 'steam', name: 'Steam', protocol: 'steam://' },
  code: { cmd: 'code', name: 'Visual Studio Code' },
  vscode: { cmd: 'code', name: 'Visual Studio Code' },
  'vs code': { cmd: 'code', name: 'Visual Studio Code' },
  'visual studio code': { cmd: 'code', name: 'Visual Studio Code' },
  notepad: { cmd: 'notepad', name: 'Notepad' },
  calc: { cmd: 'calc', name: 'Calculator' },
  calculator: { cmd: 'calc', name: 'Calculator' },
  'máy tính': { cmd: 'calc', name: 'Calculator' },
  explorer: { cmd: 'explorer', name: 'File Explorer' },
  'file explorer': { cmd: 'explorer', name: 'File Explorer' },
  taskmgr: { cmd: 'taskmgr', name: 'Task Manager' },
  'task manager': { cmd: 'taskmgr', name: 'Task Manager' },
  settings: { protocol: 'ms-settings:', name: 'Windows Settings' },
  'cài đặt': { protocol: 'ms-settings:', name: 'Windows Settings' },
  cmd: { cmd: 'cmd', name: 'Command Prompt' },
  terminal: { cmd: 'wt', name: 'Windows Terminal' },
  'windows terminal': { cmd: 'wt', name: 'Windows Terminal' },
  wt: { cmd: 'wt', name: 'Windows Terminal' },
  powershell: { cmd: 'powershell', name: 'PowerShell' },
  pwsh: { cmd: 'powershell', name: 'PowerShell' },
  paint: { cmd: 'mspaint', name: 'Paint' },
  word: { cmd: 'winword', name: 'Microsoft Word' },
  excel: { cmd: 'excel', name: 'Microsoft Excel' },
  powerpoint: { cmd: 'powerpnt', name: 'Microsoft PowerPoint' },
};

// never these: the desktop itself, Windows' own pieces, her (Capri), Claude (she watches it) and
// Ollama (she talks through it)
const KEEP = new Set([
  'explorer', 'applicationframehost', 'textinputhost', 'shellexperiencehost', 'startmenuexperiencehost',
  'searchhost', 'searchapp', 'lockapp', 'dwm', 'capri', 'electron', 'claude', 'ollama', 'ollama app',
]);

function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`,
    ], { windowsHide: true, timeout: 15000 }, (err, out) => (err ? reject(err) : resolve(out.trim())));
  });
}

// [{ name, process, ids }]: one per program with a window open ("AM Music", "Discord"...)
async function list() {
  if (process.platform !== 'win32') return [];
  const out = await powershell(
    'Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | '
    + 'ForEach-Object { [pscustomobject]@{ id = $_.Id; name = $_.ProcessName; label = $_.Description } } | '
    + 'ConvertTo-Json -Compress',
  );
  const rows = [].concat(out ? JSON.parse(out) : []);
  const apps = new Map();
  for (const { id, name, label } of rows) {
    if (id === process.pid || KEEP.has(name.toLowerCase())) continue;
    const app = apps.get(name) || { name, process: name, label: label || '', ids: [] };
    app.ids.push(id);
    apps.set(name, app);
  }
  return [...apps.values()];
}

const simple = (text) => String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The open app that `wanted` names, by its name or its description ("am music", "YouTube Music").
async function find(wanted) {
  const key = simple(wanted);
  if (key.length < 2) return null;
  const apps = await list();
  const score = (app) => {
    const names = [simple(app.name), simple(app.label)].filter(Boolean);
    if (names.includes(key)) return 3;
    if (names.some((n) => n.startsWith(key) || key.startsWith(n))) return 2;
    if (key.length >= 3 && names.some((n) => n.includes(key) || key.includes(n))) return 1;
    return 0;
  };
  const best = apps.map((app) => [score(app), app]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0])[0];
  return best ? best[1] : null;
}

// Closes it like its close button would; `force` ends it outright (unsaved work is lost).
// Resolves with what's left: { running } (true when it stayed open, or hid in the tray).
async function close(name, { force = false } = {}) {
  const app = (await list()).find((a) => a.process === name);
  if (!app) return { running: false };
  const ids = app.ids.join(',');
  const out = await powershell(force
    ? `Stop-Process -Id ${ids} -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 600; `
      + `@(Get-Process -Id ${ids} -ErrorAction SilentlyContinue).Count`
    : `foreach ($p in @(Get-Process -Id ${ids} -ErrorAction SilentlyContinue)) { [void]$p.CloseMainWindow() }; `
      + 'Start-Sleep -Milliseconds 2500; '
      + `@(Get-Process -Name '${name.replace(/'/g, "''")}' -ErrorAction SilentlyContinue).Count`);
  return { running: Number(out) > 0 };
}

// Opens Spotify app (via URI protocol) or fallback to Spotify web
async function openSpotify(query = '') {
  const cleanQuery = String(query).trim();
  const uri = cleanQuery ? `spotify:search:${encodeURIComponent(cleanQuery)}` : 'spotify:';
  try {
    await shell.openExternal(uri);
    return { ok: true, app: 'spotify', mode: 'app', query: cleanQuery };
  } catch {
    const webUrl = cleanQuery
      ? `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`
      : 'https://open.spotify.com';
    await shell.openExternal(webUrl);
    return { ok: true, app: 'spotify', mode: 'web', query: cleanQuery };
  }
}

// Opens music in default browser for YouTube, YouTube Music, or SoundCloud
// For YouTube / YT Music, finds the direct top video and opens with autoplay
async function openWebMusic(service, query = '') {
  const cleanQuery = String(query).trim();
  const s = String(service || 'youtube').toLowerCase();
  let url = '';

  if (s.includes('ytmusic') || s.includes('youtube music')) {
    if (cleanQuery) {
      try {
        const res = await yts(cleanQuery);
        const top = res.videos?.[0];
        if (top?.videoId) {
          url = `https://music.youtube.com/watch?v=${top.videoId}`;
        }
      } catch {}
    }
    if (!url) {
      url = cleanQuery
        ? `https://music.youtube.com/search?q=${encodeURIComponent(cleanQuery)}`
        : 'https://music.youtube.com';
    }
  } else if (s.includes('soundcloud')) {
    url = cleanQuery
      ? `https://soundcloud.com/search?q=${encodeURIComponent(cleanQuery)}`
      : 'https://soundcloud.com';
  } else if (s.includes('spotify')) {
    return openSpotify(cleanQuery);
  } else {
    // Default: YouTube - get top video and open with autoplay=1
    if (cleanQuery) {
      try {
        const res = await yts(cleanQuery);
        const top = res.videos?.[0];
        if (top?.videoId) {
          url = `https://www.youtube.com/watch?v=${top.videoId}&autoplay=1`;
        }
      } catch {}
    }
    if (!url) {
      url = cleanQuery
        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`
        : 'https://www.youtube.com';
    }
  }

  await shell.openExternal(url);
  return { ok: true, service: s, url, query: cleanQuery };
}

let cachedShortcuts = null;
let lastShortcutsScan = 0;

function scanShortcuts() {
  const now = Date.now();
  if (cachedShortcuts && now - lastShortcutsScan < 60000) {
    return cachedShortcuts;
  }
  const shortcuts = [];
  const dirs = [
    process.env.APPDATA && path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    process.env.ProgramData && path.join(process.env.ProgramData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ].filter(Boolean);

  function walk(dir) {
    try {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
          const rawName = entry.name.slice(0, -4);
          shortcuts.push({
            name: rawName,
            key: simple(rawName),
            path: full,
          });
        }
      }
    } catch {}
  }

  for (const d of dirs) walk(d);
  cachedShortcuts = shortcuts;
  lastShortcutsScan = now;
  return shortcuts;
}

// Launches any application installed on Windows (by known app mapping or Start Menu .lnk)
async function launchApp(appName) {
  if (process.platform !== 'win32') {
    return { ok: false, error: 'Chỉ hỗ trợ mở ứng dụng trên Windows!' };
  }
  const raw = String(appName || '').trim();
  const key = simple(raw);
  if (!key) {
    return { ok: false, error: 'Vui lòng cung cấp tên ứng dụng cần mở!' };
  }

  // 1. Check known apps
  if (KNOWN_APPS[key]) {
    const app = KNOWN_APPS[key];
    try {
      if (app.protocol) {
        await shell.openExternal(app.protocol);
      } else {
        await powershell(`Start-Process -FilePath "${app.cmd}" -ErrorAction Stop`);
      }
      return { ok: true, name: app.name };
    } catch (err) {
      console.warn(`[apps] Failed to launch known app ${app.name}:`, err.message);
    }
  }

  // 2. Scan Start Menu .lnk shortcuts
  const shortcuts = scanShortcuts();
  // Exact match
  let matched = shortcuts.find((s) => s.key === key);
  // Starts with
  if (!matched) {
    matched = shortcuts.find((s) => s.key.startsWith(key) || key.startsWith(s.key));
  }
  // Substring match
  if (!matched && key.length >= 3) {
    matched = shortcuts.find((s) => s.key.includes(key) || key.includes(s.key));
  }

  if (matched) {
    try {
      const err = await shell.openPath(matched.path);
      if (err) {
        await powershell(`Start-Process -FilePath "${matched.path.replace(/"/g, '`"')}"`);
      }
      return { ok: true, name: matched.name, path: matched.path };
    } catch (err) {
      return { ok: false, error: `Lỗi khi mở ${matched.name}: ${err.message}` };
    }
  }

  // 3. Fallback: try powershell Start-Process with raw name
  try {
    await powershell(`Start-Process -FilePath "${raw.replace(/"/g, '`"')}" -ErrorAction Stop`);
    return { ok: true, name: raw };
  } catch {
    return {
      ok: false,
      error: `Không tìm thấy ứng dụng "${raw}" trên máy của bạn.`,
    };
  }
}

module.exports = { list, find, close, openSpotify, openWebMusic, launchApp };
