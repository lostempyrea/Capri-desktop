import { Capri } from './capri.js';
import { FxLayer, GRAB_FRAMES } from './fx.js';
import { Chip, Mask } from './chip.js';
import { Panel } from './panel.js';
import { Voice } from './voice.js';
import { Brain } from './brain.js';
import { Guide } from './guide.js';
import { Mission } from './mission.js';
import { Chat } from './chat.js';
import { Player } from './player.js';
import { ScreenRecorder } from './recorder.js';
import { InstantReplayBuffer } from './replay-buffer.js';
import { SettingsUI } from './settings-ui.js';
import { TimerGuardian } from './timer-guardian.js';
import { VoiceInput } from './voice-input.js';
import { LINES } from './lines.js';
import { pick, fmt } from './util.js';

const host = window.host;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// close-ups of her for the cut-ins, frames of the show (tools/build-cutins.py)
const CUTINS = ['grin', 'laugh', 'eyes', 'many', 'look'];

async function boot() {
  const [config, image, intro, ...cutins] = await Promise.all([
    host.getConfig(),
    loadImage('../../assets/capri/capri-full.png'),
    // her intro: her close-up grabbing the screen, and its drawings with her mouth and arm moving
    Promise.all(GRAB_FRAMES.map((name) => loadImage(`../../assets/capri/intro-${name}.webp`).catch(() => null)))
      // decoded now, not the first time each one shows up (a hitch right on "hi", on the wave)
      .then((cels) => Promise.all(cels.map((cel) => cel && createImageBitmap(cel))))
      .then((cels) => (cels[0] ? Object.fromEntries(GRAB_FRAMES.map((name, i) => [name, cels[i]])) : null)),
    ...CUTINS.map((name) => loadImage(`../../assets/capri/cutin-${name}.png`)),
    document.fonts.load('600 16px "Chakra Petch"'),
    document.fonts.load('400 11px "JetBrains Mono"'),
  ]);
  document.documentElement.lang = config.lang;

  const fx = new FxLayer(document.getElementById('fx'), {
    cutins: Object.fromEntries(CUTINS.map((name, i) => [name, cutins[i]])),
    intro,
  });
  fx.resize(innerWidth, innerHeight);

  // Restore saved Mini Biochip position if available
  let savedChipPos = null;
  try {
    const raw = localStorage.getItem('capri.chipPosition');
    if (raw) savedChipPos = JSON.parse(raw);
  } catch {}
  if (!savedChipPos && config.chipPosition) {
    savedChipPos = config.chipPosition;
  }

  const chip = new Chip(document.getElementById('chip'));
  if (savedChipPos && savedChipPos.x !== undefined && savedChipPos.y !== undefined) {
    chip.place(innerWidth, innerHeight, Number(savedChipPos.x), Number(savedChipPos.y));
  } else {
    chip.place(innerWidth, innerHeight);
  }
  if (config.visible === false) {
    config.visible = true;
    try { host.setConfig({ visible: true }); } catch {}
  }
  // Keep chip strictly hidden during boot until Intro sequence completes
  const willPlayIntro = Boolean(intro && config.visible !== false);
  if (!willPlayIntro) {
    chip.show();
  } else {
    chip.canvas.style.opacity = '0';
    chip.canvas.style.visibility = 'hidden';
    chip.canvas.style.pointerEvents = 'none';
    chip.canvas.style.setProperty('opacity', '0', 'important');
    chip.canvas.style.setProperty('visibility', 'hidden', 'important');
    chip.canvas.style.setProperty('pointer-events', 'none', 'important');
    chip.hideQuickInput?.(true);
    chip.hideSpeech?.();
  }
  const mask = new Mask(document.getElementById('mask'));

  const voice = new Voice();
  voice.configure(config);
  host.listSounds().then((list) => list.length && voice.loadCustom(list));

  const panel = new Panel({
    panel: document.getElementById('panel'),
    ticker: document.getElementById('ticker'),
    labels: LINES[config.lang] || LINES.vi || LINES.en,
  });
  panel.setChipCenterGetter(() => chip.center());

  const capri = new Capri({
    root: document.getElementById('capri'),
    canvas: document.getElementById('sprite'),
    image,
    fx,
    voice,
  });
  capri.wander = false;
  capri.possessWindows = false;
  capri.setScale(config.scale || 0.52);
  panel.bindCapri(capri);

  const mission = new Mission();
  const brain = new Brain({ capri, panel, voice, host, mission, lang: config.lang });
  brain.userName = config.system?.userName || 'Tèo';

  // Apply saved Theme and Opacity
  document.documentElement.dataset.theme = config.system?.theme || 'system';
  const savedOpacity = config.system?.opacity ?? 0.95;
  document.documentElement.style.setProperty('--holo-opacity', savedOpacity);
  document.documentElement.style.setProperty('--chat-bg-opacity', savedOpacity);

  // Wire Capri expressions to panel face portrait badge
  capri.onExpression = (face) => {
    panel.setFace(face);
  };

  // Click-through everywhere except on her body, the panel and her biochip.
  let interactive = false;
  let mouse = null;
  let chipDrag = null;

  const setInteractive = (on) => {
    if (on === interactive) return;
    interactive = on;
    host.setInteractive(on);
  };

  let settingsUI = null;

  const updateMouseHitTest = (clientX, clientY) => {
    if (capri.dragging || chipDrag?.isDragging) {
      setInteractive(true);
      return true;
    }
    if (clientX === undefined || clientY === undefined || clientX === null) {
      setInteractive(false);
      return false;
    }

    // 1. Quick-Chat Input / Overheads: ABSOLUTE PRIORITY (no alpha check needed)
    let onQuickInput = false;
    const quickPopupEl = chip?.quickInputEl || document.getElementById('biochip-quick-input') || document.querySelector('.chip-quick-bar, .biochip-popup');
    if (quickPopupEl && !quickPopupEl.hidden) {
      const qr = quickPopupEl.getBoundingClientRect();
      const padX = 12;
      const padTop = 16;
      const padBottom = 12;
      if (
        qr.width > 0 && qr.height > 0 &&
        clientX >= qr.left - padX && clientX <= qr.right + padX &&
        clientY >= qr.top - padTop && clientY <= qr.bottom + padBottom
      ) {
        onQuickInput = true;
      }
    }
    if (chip.isQuickExpanded || onQuickInput) {
      setInteractive(true);
      return true;
    }

    // 2. Mini Biochip with Pixel-Accurate Alpha Hit-Testing
    const onChip = Boolean(chip.visible && chip.contains(clientX, clientY));

    // 3. Hologram Screen
    let onPanel = false;
    if (panel.visible) {
      const r = panel.rect();
      if (r && clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        onPanel = true;
      }
    }

    // 4. Settings Modal / Deck
    let onSettings = false;
    if (settingsUI && settingsUI.isOpen) {
      const sr = settingsUI.rect ? settingsUI.rect() : null;
      if (sr && clientX >= sr.left && clientX <= sr.right && clientY >= sr.top && clientY <= sr.bottom) {
        onSettings = true;
      }
    }

    // 5. Capri character body
    const onCapri = !capri.stowed && !capri.dormant && capri.hit(clientX, clientY);

    document.body.style.cursor = onChip ? 'pointer' : '';

    const shouldBeInteractive = Boolean(onChip || onPanel || onSettings || onCapri);
    setInteractive(shouldBeInteractive);
    return shouldBeInteractive;
  };

  const refreshHit = () => {
    if (!mouse) return setInteractive(false);
    return updateMouseHitTest(mouse.x, mouse.y);
  };

  // 100ms Cursor Watchdog: Checks OS cursor position to guarantee immediate desktop passthrough
  setInterval(async () => {
    if (capri.dragging) return;
    try {
      const cur = await host.cursor();
      if (!cur) return;
      if (!cur.inside) {
        if (interactive) setInteractive(false);
        panel.setMouseOver(false);
        return;
      }
      mouse = { x: cur.x, y: cur.y };
      const hit = updateMouseHitTest(cur.x, cur.y);
      if (!hit && interactive) {
        setInteractive(false);
      }
    } catch {}
  }, 100);

  // Dynamic Keyboard Focus Management: allow typing in inputs without grabbing focus when idle
  window.addEventListener('focusin', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      host.setFocusable(true);
      panel.setInputFocused(true);
    }
  });

  window.addEventListener('focusout', (e) => {
    const tag = e.target?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      setTimeout(() => {
        const active = document.activeElement?.tagName?.toLowerCase();
        if (active !== 'input' && active !== 'textarea' && active !== 'select') {
          host.setFocusable(false);
          panel.setInputFocused(false);
        }
      }, 50);
    }
  });
  // Her biochip: her eyes on it follow the pointer over it, and she comes out when you click it
  // (only then, so the pointer passing through that corner doesn't call her back).
  // Her mask, asleep: the pointer coming over it stirs her, and a moment of that wakes her up.
  let wakeTimer = 0;
  let lastWakeTime = 0;

  const comeOut = async () => {
    lastWakeTime = performance.now();
    window.dispatchEvent(new CustomEvent('capri:activity'));
    resetInactivity();
    if (chip.visible) chip.wake();
    if (mask.visible) mask.wake();
    try { capri.forceRestoreInteraction(); } catch {}
    try { capri.wake(); } catch {}
    try { panel.forceRestore(); } catch {}
    try {
      if (typeof panel.openPanel === 'function') {
        panel.openPanel();
      } else {
        panel.show();
      }
    } catch (e) {
      console.error('[app] openPanel err:', e);
    }
    if (!chat.open) {
      try {
        await chat.start();
      } catch (err) {
        console.error('[app] chat.start err:', err);
      }
    } else {
      panel.chatInput?.focus();
      host.setFocusable(true);
    }
    voiceInput?.selfHeal?.();
    refreshHit();
  };
  const hoverChip = () => {
    chip.pointer = chip.visible && mouse && chip.contains(mouse.x, mouse.y) ? mouse : null;
  };
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (
      e.target?.closest?.('.chip-quick-bar, .quick-input-btn, .quick-mic-btn, .quick-chat-input, #biochip-quick-input, .biochip-quick-input, #biochip-speech, #biochip-voice-pill') ||
      chip?.isQuickExpanded ||
      (chip?.containsQuickInput && chip.containsQuickInput(e.clientX, e.clientY))
    ) {
      chipDrag = null;
      return;
    }

    // Outside click dismiss: clicking anywhere outside the active Chat Frame dismisses it immediately
    if (panel.visible && !capri.dragging && !chipDrag?.isDragging) {
      const r = panel.rect();
      const onP = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      const onC = chip.visible && chip.contains(e.clientX, e.clientY, 8);
      if (!onP && !onC) {
        panel.hide();
        chat.close();
        refreshHit();
      }
    }

    if (chip.visible && chip.contains(e.clientX, e.clientY, 8)) {
      chipDrag = {
        startX: e.screenX,
        startY: e.screenY,
        origX: chip.x,
        origY: chip.y,
        isDragging: false,
        downTime: Date.now(),
      };
      setInteractive(true);
    }
  });

  // Desktop window blur: clicking outside the transparent Electron window auto-dismisses the on-demand Chat Frame
  window.addEventListener('blur', () => {
    if (panel.visible && !capri.dragging && !chipDrag?.isDragging) {
      panel.hide();
      chat.close();
      refreshHit();
    }
  });

  window.addEventListener('mousemove', (e) => {
    mouse = { x: e.clientX, y: e.clientY };

    if (chipDrag) {
      const dx = e.screenX - chipDrag.startX;
      const dy = e.screenY - chipDrag.startY;
      if (!chipDrag.isDragging && Math.hypot(dx, dy) > 8) {
        chipDrag.isDragging = true;
        setInteractive(true);
        if (capri && typeof capri.perform === 'function' && !capri.busy) {
          try { capri.perform('dangle'); } catch {}
        }
      }
      if (chipDrag.isDragging) {
        const newX = Math.max(0, Math.min(innerWidth - chip.w, chipDrag.origX + dx));
        const newY = Math.max(0, Math.min(innerHeight - chip.h, chipDrag.origY + dy));
        chip.setPosition(newX, newY);
        panel.alignToChip(chip.center());
        return;
      }
    }

    refreshHit();
    hoverChip();
  });

  window.addEventListener('mouseup', (e) => {
    if (
      e.target?.closest?.('.chip-quick-bar, .quick-input-btn, .quick-mic-btn, .quick-chat-input, #biochip-quick-input, .biochip-quick-input') ||
      (chip?.containsQuickInput && chip.containsQuickInput(e.clientX, e.clientY))
    ) {
      chipDrag = null;
      return;
    }
    if (chipDrag) {
      const wasDragging = chipDrag.isDragging;
      chipDrag = null;
      if (wasDragging) {
        try {
          const pos = { x: chip.x, y: chip.y };
          localStorage.setItem('capri.chipPosition', JSON.stringify(pos));
          host.setConfig({ chipPosition: pos });
        } catch {}
        refreshHit();
        return;
      }
      // Click without drag (<= 8px): immediately toggle panel ONLY when clicked directly on solid mask alpha
      if (!chip.isAlphaSolid || chip.isAlphaSolid(e.clientX, e.clientY, 25)) {
        if (panel.visible) {
          panel.hide();
          chat.close();
        } else {
          comeOut();
        }
      }
      return;
    }
  });

  document.addEventListener('mouseleave', () => {
    mouse = null;
    refreshHit();
    hoverChip();
  });
  window.addEventListener('contextmenu', (e) => {
    if ((chip.visible && chip.contains(e.clientX, e.clientY, 4)) ||
        (mask.visible && mask.contains(e.clientX, e.clientY, 30))) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  });
  window.addEventListener('click', (e) => {
    if (mask.visible && mask.contains(e.clientX, e.clientY, 30)) {
      comeOut();
    }
  });

  // wiring
  capri.onMove = (head) => {
    // pointing at something: the panel goes on her other side, so it doesn't cover it
    panel.setAnchor({ ...head, lean: capri.pointing ? -capri.pointing.dir : 0 }, capri.view);
    // she may have moved out from under a still pointer: never leave a dead click zone behind
    refreshHit();
  };
  capri.onTeleport = (phase) => (phase === 'start' ? panel.suspend() : panel.resume());
  capri.chipAt = () => chip.center();
  capri.onStow = () => {
    chip.setMode(capri.mode);
    chip.show();
  };
  capri.onUnstow = () => chip.show();
  capri.onDoze = () => {
    // Single Biochip guarantee: Mask canvas is deprecated and never displayed
    mask.hide();
  };
  capri.onMode = (mode, prev) => chip.setMode(mode, prev);
  // now and then she says something about the satellite: while she looks at it, or once
  // the red light has gone up (never during, nothing should cover that)
  capri.onGaze = (when) => {
    const lines = when === 'end' ? brain.t.uplink : brain.t.gaze;
    if (!panel.visible && Math.random() < (when === 'end' ? 0.6 : 0.4)) panel.say({ kind: 'info', line: pick(lines), hold: 3800 });
  };
  capri.onClick = () => {
    if (panel.visible) panel.hide();
    else brain.status();
  };
  panel.onChar = (kind) => voice.play('blip', { mood: kind });
  panel.onTalk = (talking) => talking && capri.perform('talk');
  capri.onMenu = () => host.openMenu();

  // Her guide (guide.js): her welcome on first launch, and "How does it work?" in her menu,
  // where she takes you to things and points at them.
  const guide = new Guide({ capri, panel, voice, host, brain });
  // In-app music player (local files + Cyberpunk Radio + YouTube streams)
  const player = new Player({ host, capri, panel, voice, brain, fx });
  // Screen recording engine & Instant Replay Rolling Ring-Buffer
  const recorder = new ScreenRecorder({ host, panel, voice, fx, capri });
  const replayBuffer = new InstantReplayBuffer({ host, panel, voice, fx, capri });
  const timerGuardian = new TimerGuardian({ host, panel, voice, capri });

  // Anime Cut-in Celebration
  function showVictoryCutin() {
    const cutin = document.createElement('div');
    cutin.className = 'cutin-overlay';
    cutin.innerHTML = '<img class="cutin-overlay__img" src="../../docs/victory.png" alt="Victory">';
    document.body.appendChild(cutin);
    fx?.flash?.();
    voice.play('rise');
    setTimeout(() => cutin.remove(), 1200);
  }
  replayBuffer.onCutin = showVictoryCutin;

  // Talking to her (chat.js): "Talk to her" in her menu, or the button when you click her idle.
  const chat = new Chat({ capri, panel, voice, host, brain, player, recorder, fx, chip, replayBuffer });
  const initialUserAvatar = localStorage.getItem('capri_user_avatar') || localStorage.getItem('capri.userAvatar') || config.user?.avatar || config.userAvatar || '';
  if (initialUserAvatar) {
    panel.setUserAvatar(initialUserAvatar);
  }
  panel.bindChat(chat);
  panel.bindChip(chip);
  chip.bindVoice(voice);
  chip.bindChat(chat);
  chip.initQuickInput();

  // Synchronize Chat Frame hide lifecycle with host & hit-testing
  panel.onHide = () => {
    chat.close();
    host.setFocusable(false);
    refreshHit();
  };

  window.addEventListener('capri:toggle-chat', () => {
    if (panel.visible) {
      panel.hide();
      chat.close();
    } else {
      comeOut();
    }
  });

  // Voice Input & "Hey Capri" Wake Word engine
  const voiceInput = new VoiceInput({
    host, capri, panel, voice, brain, player, chat, fx, chip,
    micDeviceId: config.voice?.inputDeviceId || config.micDeviceId,
    replayBuffer,
    timerGuardian
  });
  chat.voiceInput = voiceInput;
  chip.bindVoiceInput(voiceInput);
  chip.bindPanel(panel);
  chip.bindCapri(capri);
  voiceInput.setWakeWordEnabled(config.wakeWord ?? true);
  voiceInput.onWake = () => {
    chip.wake();
    chip.setStatusBadge('Listening...', 'listen', 5000);
    voice.play('wake');
  };
  window.addEventListener('capri:wake', () => {
    chip.wake();
    chip.setStatusBadge('Listening...', 'listen', 5000);
  });

  // Cyberpunk Settings Deck
  settingsUI = new SettingsUI({ host, panel, voice, voiceInput, chat });
  if (config.lang) {
    panel.updateI18n?.(config.lang);
    chip.updateI18n?.(config.lang);
    settingsUI.applyLanguage?.(config.lang);
  }
  settingsUI.onConfigSaved = (patch) => {
    if (patch.lang) {
      document.documentElement.lang = patch.lang;
      brain.lang = patch.lang;
      panel.updateI18n?.(patch.lang);
      chip.updateI18n?.(patch.lang);
      settingsUI.applyLanguage?.(patch.lang);
    }
    if (patch.system?.userName) brain.userName = patch.system.userName;
    if (patch.system?.theme) document.documentElement.dataset.theme = patch.system.theme;
    if (patch.system?.opacity !== undefined) {
      document.documentElement.style.setProperty('--holo-opacity', patch.system.opacity);
      document.documentElement.style.setProperty('--chat-bg-opacity', patch.system.opacity);
    }
  };
  panel.onSettingsClick = (open) => {
    if (open) settingsUI.open();
    else settingsUI.close();
  };
  panel.setChipCenterGetter(() => chip.center());
  voice.onSpeakingState = (isSpeaking, volume) => {
    panel.setSpeaking(isSpeaking, volume);
    if (isSpeaking) {
      chip.setMode('active');
      chip.setAudioRms(volume);
    } else {
      chip.setAudioRms(0);
      if (chip.mode === 'active' || chip.matrixState === 'active') {
        chip.setMode(capri.mode || 'idle');
      }
    }
  };

  // Instant Replay & Hardware Guardian host listeners
  if (host.onInstantReplay) {
    host.onInstantReplay(() => replayBuffer.clip());
  }
  if (host.onHardwareAlert) {
    host.onHardwareAlert(({ type, percent, message }) => {
      panel.say({
        kind: 'alert',
        face: 'wide',
        badge: 'SYS ALERT',
        line: message || `[ ALERT ] RAM hệ thống: ${percent}%!`,
        hold: 8000
      });
      voice.play('alert');
    });
  }
  if (host.onGamerMode) {
    host.onGamerMode(({ active, title }) => {
      if (active) {
        console.log(`[app] Gamer Mode detected (${title}), entering 1 FPS sleep...`);
        chip.hibernate();
        panel.hide();
      }
    });
  }

  // 30-Second Inactivity Auto-Hibernate to Mini Biochip
  let inactivityMinutes = Number(config.inactivityMinutes ?? 5);
  let sleepSeconds = Number(config.system?.inactivitySleepSec ?? (inactivityMinutes * 60));
  let inactivityTimer = null;

  const resetInactivity = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    if (!sleepSeconds || sleepSeconds <= 0) return;

    inactivityTimer = setTimeout(() => {
      const now = performance.now();
      if (now - lastWakeTime < 15000) {
        resetInactivity();
        return;
      }
      const isMusicPlaying = player?.playing || (player?.audio && !player.audio.paused);
      const isBusy = capri.busy || capri.act || panel.visible || recorder.isRecording || voiceInput.state === 'COMMAND_ACTIVE';
      if (isMusicPlaying || isBusy) {
        resetInactivity();
        return;
      }
      console.log(`[app] Inactivity timeout (${sleepSeconds}s) reached, putting Mini into hibernation (1 FPS)`);
      chip.hibernate();
      panel.hide();
    }, sleepSeconds * 1000);
  };

  window.addEventListener('mousemove', resetInactivity);
  window.addEventListener('click', resetInactivity);
  window.addEventListener('keydown', resetInactivity);
  window.addEventListener('capri:activity', resetInactivity);
  host.onClaudeEvent(() => resetInactivity());
  host.onDiscordMessage?.(() => resetInactivity());
  host.onInactivityConfig?.((min) => {
    inactivityMinutes = Number(min);
    sleepSeconds = Math.max(30, inactivityMinutes * 60);
    resetInactivity();
  });
  resetInactivity();
  brain.onTalk = () => chat.start();
  // the first Claude Code event that ever reaches her: so you know it worked
  brain.linked = config.linked;
  brain.onLinked = () => {
    host.setConfig({ linked: true, welcomed: true });
    voice.play('hello');
    capri.perform('hop');
    panel.say({ kind: 'done', badge: 'LINK', line: brain.t.welcome.linked, hold: 6000 });
  };

  // The demo's second half, after its fake Claude session: everything she does on her own, one
  // after the other, a line before each.
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (done, max = 15000) => {
    for (const t0 = Date.now(); !done() && Date.now() - t0 < max;) await wait(100);
  };
  const free = () => !capri.busy && !capri.act && capri.stance !== 'fall';
  brain.onShowcase = async () => {
    const t = brain.t.showcase;
    const caption = (line) => panel.say({ kind: 'info', line, hold: 2200 });
    capri.nextMove = capri.nextGaze = performance.now() + 120000; // nothing of her own in between
    if (capri.stowed) await capri.unstow();
    if (capri.dormant) capri.wake();
    await until(free);
    panel.hide();

    caption(t.minds);
    await wait(1000);
    await capri.perform('split');
    await wait(900);

    caption(t.zap);
    await wait(1000);
    const h = capri.head();
    capri.zap(h.x + capri.towardCenter() * 280, h.y - 170);
    await wait(1800);

    panel.hide();
    if (capri.gaze({ big: true })) await until(() => !capri.sky);
    await wait(2500);

    // a little terminal opens for her to take over, and closes under her once she's done with it
    capri.possessWindows = true;
    if (await host.demoWindow(true)) {
      const top = () => capri.windows.wins.find((w) => capri.canSit(w)); // it opens on top of everything
      await until(top, 3500);
      let win = top();
      if (!win) {
        win = { id: 999999, x: Math.round(innerWidth * 0.5 - 310), y: Math.round(innerHeight * 0.42), w: 620, h: 300 };
      }
      const seat = { win, dx: win.w * 0.4 };
      if (seat) {
        panel.hide();
        panel.setTicker?.({ verb: 'TERMINAL', target: 'JACKING IN...' });
        await capri.sitOn(seat);
        await until(free);
        caption(t.possess);
        panel.setTicker?.({ verb: 'POSSESS', target: 'HIJACKING TERMINAL...' });
        await wait(1400);
        panel.hide();
        await capri.possess();
        await wait(1800);
        panel.setTicker?.(null);
      }
      host.demoWindow(false);
      await wait(400);
      await until(free); // she may have fallen off it
      await wait(900);
    }
    capri.possessWindows = false;

    caption(t.sleep);
    await wait(1400);
    panel.hide();
    capri.setMode('sleep');
    await wait(2500); // dozing off
    await capri.doze();
    await wait(4500);
    capri.wake();
    await until(free);
    await wait(1200);

    caption(t.chip);
    await wait(1600);
    panel.hide();
    await capri.stow();
    await wait(3500);
    await capri.unstow();
    await wait(600);
    panel.say({ kind: 'info', line: t.end, hold: 5000 });
  };

  host.onClaudeEvent((evt) => brain.handle(evt));
  host.onAntigravityActivity?.((activity) => {
    resetInactivity();
    if (!activity) return;
    const verb = activity.verb || 'AGENT';
    const target = activity.target || 'ACTIVE';
    panel.setTicker?.({ verb, target });

    // Emote reaction
    const emote = activity.emote || 'point';
    try {
      capri.perform?.(emote);
    } catch {
      capri.perform?.('hop');
    }
  });
  host.onDiscordMessage?.((data) => {
    capri.pulse();
    voice.play('blip');
    capri.perform('hop');
    panel.say({
      kind: 'chat',
      badge: 'DISCORD',
      face: 'look',
      line: data.text || 'Nhận được tín hiệu từ Discord!',
      hold: 7000,
    });
  });
  host.onWindows((data) => {
    capri.setWindows(data);
    brain.onWindows(data);
  });
  // the windows as they are now: the watcher only speaks again when something changes
  host.windowsNow().then((data) => data && capri.setWindows(data));

  host.onResize(({ width, height }) => {
    fx.resize(width, height);
    chip.place(width, height);
    capri.setView(width, height);
    panel.place();
  });
  window.addEventListener('resize', () => {
    fx.resize(innerWidth, innerHeight);
    chip.place(innerWidth, innerHeight);
    capri.setView(innerWidth, innerHeight);
    panel.place();
  });

  host.onConfig((cfg) => {
    voice.configure(cfg);
    capri.wander = cfg.wander;
    capri.possessWindows = cfg.possess;
    if (cfg.scale !== capri.scale) capri.setScale(cfg.scale);
    if (cfg.wakeWord !== undefined) voiceInput.setWakeWordEnabled(cfg.wakeWord);
    if (cfg.micDeviceId !== undefined && cfg.micDeviceId !== voiceInput.currentMicId) {
      voiceInput.setMicrophone(cfg.micDeviceId, false);
    }
    if (cfg.inactivityMinutes !== undefined) {
      inactivityMinutes = Number(cfg.inactivityMinutes);
      sleepSeconds = Math.max(30, inactivityMinutes * 60);
      resetInactivity();
    }
    if (cfg.lang !== brain.lang) {
      brain.lang = cfg.lang;
      panel.labels = LINES[cfg.lang] || LINES.vi || LINES.en;
      document.documentElement.lang = cfg.lang;
    }
    if (cfg.user?.avatar !== undefined) {
      panel.setUserAvatar(cfg.user.avatar);
      try { localStorage.setItem('capri.userAvatar', cfg.user.avatar || ''); } catch {}
    }
  });

  host.onCommand(async (cmd) => {
    const t = brain.t;
    switch (cmd.name) {
      case 'teleport':
        if (panel && panel.visible) {
          capri.teleport(capri.spot('random'));
        } else {
          chip.teleport?.();
        }
        break;
      case 'status':
        brain.status();
        break;
      case 'welcome': // "How does it work?" in her menu
        guide.menu();
        break;
      case 'chat': // "Talk to her" in her menu
        await comeOut();
        break;
      case 'toggle-chat':
        if (panel && panel.visible) {
          panel.hide();
          chat.close();
        } else {
          await comeOut();
        }
        break;
      case 'report': // "Mission report" in her menu
        if (capri.stowed || capri.dormant) {
          host.setConfig({ visible: true });
          await comeOut();
        }
        capri.wake();
        if (brain.report()) capri.perform('curious', capri.towardCenter());
        break;
      case 'fakeClaude': { // --dev: the topmost window (the test window) is where a prompt was typed, and you're elsewhere
        const win = capri.windows.wins[0];
        if (win) {
          brain.sessions.set('dev', { id: 'dev', project: 'dev', taskStart: Date.now(), count: 0, files: new Set(), log: [], working: true, waiting: false, window: win.id, seen: Date.now() });
          capri.windows = { ...capri.windows, fg: -1 };
        }
        break;
      }
      case 'guide': // --dev: one topic of her guide (welcome, menu, connect, icon, claude, folder)
        if (cmd.topic === 'welcome') guide.welcome();
        else if (cmd.topic === 'menu') guide.menu();
        else if (typeof guide[cmd.topic] === 'function') guide.scene(() => guide[cmd.topic]());
        break;
      case 'stow': // Ctrl+Alt+C: into her biochip, or back out
        if (cmd.on) capri.stow();
        else await comeOut();
        break;
      case 'satellite': // the whole sequence, on demand (tray)
        if (capri.stowed || capri.dormant) {
          host.setConfig({ visible: true });
          await comeOut();
        }
        capri.wake();
        if (capri.stance === 'peek') await capri.unpeek();
        if (!capri.gaze({ big: true })) setTimeout(() => capri.gaze({ big: true }), 1500);
        break;
      case 'hooks':
        if (cmd.ok) panel.say({ kind: 'info', line: cmd.action === 'install' ? t.hooksOk : t.hooksRemoved, hold: 6000 });
        else panel.say({ kind: 'error', line: fmt(t.hooksFail, { error: cmd.error }), hold: 9000 });
        break;
      // --dev helpers
      case 'intro': // her intro again, as when she starts (still: as with Windows' animations off)
        panel.hide();
        chip.canvas.style.opacity = '0';
        chip.canvas.style.visibility = 'hidden';
        chip.canvas.style.pointerEvents = 'none';
        chip.hideQuickInput?.(true);
        {
          const chipCenter = chip.center();
          await fx.intro({
            to: { x: chipCenter.x, y: chipCenter.y, size: 70 },
            label: 'hi',
            caption: 'CAPRI // PROJECT CAPRICORN',
            still: Boolean(cmd.still),
            onCue: (cue) => {
              if (cue === 'open') voice.play('charge');
              else if (cue === 'hand') voice.play('land');
              else if (cue === 'wave') voice.play('rise');
              else if (cue === 'grab') { voice.play('land'); voice.play('bolt'); }
              else if (cue === 'hi') {
                if (voice.voiceMode === 'pack') voice.playCapriVoicePack?.('auto');
                else voice.play('hello');
              }
              else if (cue === 'slip') voice.play('teleport-out');
            },
          });
          if (typeof fx.burst === 'function') {
            fx.burst(chipCenter.x, chipCenter.y, { color: '#00f0ff', count: 18 });
          }
          voice.play('teleport-in');
          chip.show();
          chip.canvas.style.opacity = '1';
          chip.canvas.style.visibility = 'visible';
          chip.canvas.style.pointerEvents = 'auto';
          chip.wake();
        }
        break;
      case 'pose':
        capri.debug = cmd.params || null;
        if (cmd.still) capri.nextMove = capri.nextGaze = Infinity; // no wandering off mid-test
        if (cmd.hush) {
          panel.setTicker(null);
          panel.hide();
        }
        if (cmd.scale) capri.setScale(cmd.scale);
        if (cmd.stance) capri.setStance(cmd.stance, cmd);
        if (cmd.at) capri.pos = cmd.at;
        if (cmd.facing) capri.facing = cmd.facing;
        capri.drawFrame();
        break;
      case 'config': // a setting, as if changed from her menu
        host.setConfig(cmd.patch || {});
        break;
      case 'focus': // as if window `fg` had come to the front
        capri.windows = { ...capri.windows, fg: cmd.fg };
        brain.onWindows(capri.windows);
        break;
      case 'freeze':
        capri.hidden = Boolean(cmd.on);
        break;
      case 'act':
        // behaviours by method name (gaze, celebrate, hurt, shed, peek, fall, wanderStep...) or acts by name
        if (cmd.act === 'sit') {
          // pile: n-th window she could sit on from the top of the pile (0: the --dev test window
          // opened last), instead of the usual choice
          const top = cmd.pile !== undefined && capri.windows.wins.filter((w) => capri.canSit(w))[cmd.pile];
          const seat = top ? { win: top, dx: top.w * 0.4 } : capri.pickSeat();
          if (seat) capri.sitOn(seat);
        } else if (typeof capri[cmd.act] === 'function') capri[cmd.act](...(cmd.args || []));
        else capri.perform(cmd.act, cmd.dir || 0);
        break;
      default:
        break;
    }
  });

  // 2. Play Legendary Startup Intro Animation
  if (willPlayIntro) {
    try {
      // Biochip is strictly hidden during entire Intro
      chip.canvas.style.opacity = '0';
      chip.canvas.style.visibility = 'hidden';
      chip.canvas.style.pointerEvents = 'none';
      chip.canvas.style.setProperty('opacity', '0', 'important');
      chip.canvas.style.setProperty('visibility', 'hidden', 'important');
      chip.canvas.style.setProperty('pointer-events', 'none', 'important');
      chip.hideQuickInput?.(true);
      chip.hideSpeech?.();

      const fxEl = document.getElementById('fx');
      if (fxEl) {
        fxEl.style.setProperty('z-index', '2147483646', 'important');
      }

      const chipCenter = chip.center();
      await fx.intro({
        to: { x: chipCenter.x, y: chipCenter.y, size: 70 },
        label: 'hi',
        caption: 'CAPRI // PROJECT CAPRICORN',
        still: false,
        onCue: (cue) => {
          if (cue === 'open') voice.play('charge');
          else if (cue === 'hand') voice.play('land');
          else if (cue === 'wave') voice.play('rise');
          else if (cue === 'grab') {
            voice.play('land');
            voice.play('bolt');
          } else if (cue === 'hi') {
            if (voice.voiceMode === 'pack') {
              voice.playCapriVoicePack?.('auto');
            } else {
              voice.play('hello');
            }
          } else if (cue === 'slip') voice.play('teleport-out');
        },
      });

      // 100% of Intro complete: trigger convergence/glitch materialize effect
      if (typeof fx.burst === 'function') {
        fx.burst(chipCenter.x, chipCenter.y, { color: '#00f0ff', count: 18 });
      }
      voice.play('teleport-in');
    } catch (err) {
      console.warn('[app] Intro animation error:', err);
    }
  }

  // Entrance: On boot, reveal Mini Biochip smoothly only AFTER Intro completes
  capri.wander = false;
  capri.possessWindows = false;
  capri.place();
  chip.show();
  chip.canvas.style.transition = 'opacity 0.35s ease';
  chip.canvas.style.opacity = '1';
  chip.canvas.style.visibility = 'visible';
  chip.canvas.style.pointerEvents = 'auto';
  chip.canvas.style.removeProperty('opacity');
  chip.canvas.style.removeProperty('visibility');
  chip.canvas.style.removeProperty('pointer-events');
  chip.wake();
  panel.place();
  refreshHit();

  const hooks = await host.hooksStatus();
  if (!config.welcomed || !hooks.installed) {
    guide.welcome();
  }

  // Auto-start Instant Replay 30s rolling buffer 2s after boot
  setTimeout(() => {
    replayBuffer.start(30).catch((err) => console.warn('[app] Auto-start replayBuffer failed:', err.message));
  }, 2000);

  // Time-based smart greeting audio & status banner
  playSmartGreeting(voice, chip, panel, brain);

  // In the evening, after a real day's work, she brings you her report card once, on her own,
  // at a quiet moment.
  setInterval(() => {
    const day = mission.day;
    const quiet = !brain.busySessions.length && !panel.visible && !guide.running && !capri.busy && !capri.act;
    if (new Date().getHours() < 18 || day.reported || day.missions < 3 || !quiet) return;
    if (capri.stowed || capri.dormant || capri.mode === 'sleep') return;
    if (brain.report()) {
      mission.markReported();
      capri.perform('curious', capri.towardCenter());
    }
  }, 60000);
}

async function playSmartGreeting(voice, chip, panel, brain) {
  if (voice.muted) return;
  const now = new Date();
  const hour = now.getHours();
  const lastSeenStr = localStorage.getItem('capri.lastSeen');
  const nowMs = Date.now();
  localStorage.setItem('capri.lastSeen', String(nowMs));

  let wav = null;
  let textEn = '';

  if (lastSeenStr) {
    const lastSeen = parseInt(lastSeenStr, 10);
    const diffHours = (nowMs - lastSeen) / (1000 * 60 * 60);
    if (diffHours >= 24) {
      wav = 'assets/voice/hello-miss.wav';
      textEn = 'Welcome back! Missed you, I have been watching your PC.';
    }
  }

  if (!wav) {
    if (hour >= 5 && hour < 12) {
      wav = 'assets/voice/hello-morning.wav';
      textEn = 'Good morning! Ready for a productive day.';
    } else if (hour >= 23 || hour < 5) {
      wav = 'assets/voice/hello-late.wav';
      textEn = 'Working late? Take care of yourself, do not stay up too late.';
    } else {
      textEn = 'Back already? System online and ready.';
    }
  }

  const msg = textEn || 'Back already? System online and ready.';
  setTimeout(async () => {
    if (wav) {
      await voice.playSoundFile(wav);
    }
    // Route greeting directly to Biochip Speech Bubble (not the top-left ticker)
    if (chip?.say) {
      chip.say({ text: msg, badge: '[ CAPRI // ONLINE ]', duration: 8000, tts: false });
    }
  }, 1800);
}

boot().catch((err) => {
  console.error('[capri] boot failed', err);
});
