// The Cyberpunk Hologram Construct Screen & Transmission Deck
// Projects above the Mini Biochip emitter with Holo-Character-Stage (Left 220px) and Holo-Content-Area (Right Flex).

import { clamp, ease, reducedMotion } from './util.js';

const NOISE = '▚▞▙▟░▒#%&/\\<>01XZ';

const FACE_DIR = '../../assets/capri/';
export const FACES = {
  calm: 'face-calm.png',
  aside: 'face-aside.png',
  smug: 'face-smug.png',
  wide: 'face-wide.png',
  look: 'face-look.png',
  laugh: 'face-laugh.png',
  many: 'face-many.png',
  grin: 'capri-face.png',
};
const KIND_FACE = { alert: 'many', done: 'look', error: 'laugh', work: 'calm', idle: 'calm', report: 'smug', chat: 'look' };
const PRIORITY = { info: 1, idle: 1, work: 2, done: 3, error: 3, report: 3, chat: 3, alert: 4 };
const DECODE_STEP_MS = 28;
const COUNT_MS = 700;

function getMessageEmotion(text) {
  if (!text) return 'normal';
  const tagM = text.match(/\[(normal|grin|laugh|watch|look|all_eyes|many|zigzag|aside|look_down|smug|glance|wide)\]/i);
  if (tagM) {
    const raw = tagM[1].toLowerCase();
    if (raw === 'look') return 'watch';
    if (raw === 'many') return 'all_eyes';
    if (raw === 'aside') return 'zigzag';
    if (raw === 'smug') return 'look_down';
    if (raw === 'wide') return 'glance';
    return raw;
  }
  if (/(ha){2,}|lol|mdr|jaja|kkk|haha|hehe|hihi/i.test(text)) return 'laugh';
  if (/(tuyệt|awesome|great|yeah|quá đã|xịn|hay quá)/i.test(text) || text.includes('!')) return 'grin';
  if (/(suy nghĩ|hửm|thật sao|ủa|sao thế|\?)/i.test(text)) return 'look_down';
  if (/(cẩn thận|chú ý|cảnh báo|lỗi|error)/i.test(text)) return 'glance';
  return 'watch';
}

const FACE_MAP = {
  normal: 0,
  grin: 1,
  laugh: 2,
  watch: 3, look: 3,
  all_eyes: 4, many: 4,
  zigzag: 5, aside: 5,
  look_down: 6, smug: 6,
  glance: 7, wide: 7,
};

let facesImg = null;
function getFacesImage() {
  if (!facesImg) {
    facesImg = new Image();
    facesImg.src = 'assets/faces.png';
    facesImg.onerror = () => {
      facesImg.src = '../../assets/faces.png';
    };
  }
  return facesImg;
}

function drawCapriAvatarOnCanvas(canvas, faceNameOrIndex) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = getFacesImage();
  const idx = typeof faceNameOrIndex === 'number' ? faceNameOrIndex : (FACE_MAP[faceNameOrIndex] ?? 0);
  const sx = idx * 105;
  const sw = 105;
  const sh = 112;
  const w = canvas.width || 38;
  const h = canvas.height || 38;

  const render = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, 0, sw, sh, 0, 0, w, h);
  };

  if (img.complete && img.naturalWidth > 0) {
    render();
  } else {
    img.addEventListener('load', render, { once: true });
  }
}

const DEFAULT_USER_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="%230d1117"/><path d="M12 28 C12 22 16 18 20 18 C24 18 28 22 28 28" fill="none" stroke="%2300f0ff" stroke-width="2.5"/><circle cx="20" cy="14" r="6" fill="%2300f0ff" fill-opacity="0.2" stroke="%2300f0ff" stroke-width="2"/><rect x="15" y="12" width="10" height="3" rx="1.5" fill="%2300f0ff"/><line x1="8" y1="36" x2="32" y2="36" stroke="%2300f0ff" stroke-width="1.5"/></svg>';

function registerCapriAvatar(container, baseFace = 'normal', isLive = false) {
  const canvas = container.querySelector('canvas');
  if (!canvas) return null;

  if (container._avatarLoopTimer) {
    clearTimeout(container._avatarLoopTimer);
    container._avatarLoopTimer = null;
  }
  if (container._avatarSpeakTimer) {
    clearInterval(container._avatarSpeakTimer);
    container._avatarSpeakTimer = null;
  }

  container.dataset.face = baseFace;
  drawCapriAvatarOnCanvas(canvas, baseFace);

  let isSpeaking = isLive;
  let speakFrameIdx = 0;
  const speakFrames = [3, 1, 2, 1, 0, 1];

  const scheduleNextIdle = () => {
    if (container._avatarLoopTimer) clearTimeout(container._avatarLoopTimer);
    if (isSpeaking) return;

    const delay = 2500 + Math.random() * 2000;
    container._avatarLoopTimer = setTimeout(() => {
      if (!container.isConnected || isSpeaking) return;

      const rand = Math.random();
      const currentBase = container.dataset.face || baseFace;

      if (rand < 0.45) {
        // Quick blink
        drawCapriAvatarOnCanvas(canvas, 'glance');
        setTimeout(() => {
          if (container.isConnected && !isSpeaking) {
            drawCapriAvatarOnCanvas(canvas, currentBase);
          }
        }, 150);
      } else if (rand < 0.8) {
        // Glance or look aside
        const idleFaces = ['look', 'grin', 'zigzag', 'watch'];
        const chosen = idleFaces[Math.floor(Math.random() * idleFaces.length)];
        drawCapriAvatarOnCanvas(canvas, chosen);
        setTimeout(() => {
          if (container.isConnected && !isSpeaking) {
            drawCapriAvatarOnCanvas(canvas, currentBase);
          }
        }, 350 + Math.random() * 250);
      } else {
        // Subtle 1-frame glitch
        container.classList.add('is-glitching');
        drawCapriAvatarOnCanvas(canvas, 'all_eyes');
        setTimeout(() => {
          container.classList.remove('is-glitching');
          if (container.isConnected && !isSpeaking) {
            drawCapriAvatarOnCanvas(canvas, currentBase);
          }
        }, 100);
      }

      scheduleNextIdle();
    }, delay);
  };

  const startIdleLoop = () => {
    scheduleNextIdle();
  };

  const startSpeakingLoop = () => {
    if (container._avatarSpeakTimer) clearInterval(container._avatarSpeakTimer);
    container.classList.add('is-speaking', 'is-speaking-jitter');
    container._avatarSpeakTimer = setInterval(() => {
      if (!container.isConnected || !isSpeaking) {
        clearInterval(container._avatarSpeakTimer);
        container._avatarSpeakTimer = null;
        container.classList.remove('is-speaking', 'is-speaking-jitter');
        drawCapriAvatarOnCanvas(canvas, container.dataset.face || baseFace);
        startIdleLoop();
        return;
      }
      speakFrameIdx = (speakFrameIdx + 1) % speakFrames.length;
      drawCapriAvatarOnCanvas(canvas, speakFrames[speakFrameIdx]);
    }, 140);
  };

  const controller = {
    setSpeaking(val) {
      if (isSpeaking === val) return;
      isSpeaking = val;
      if (isSpeaking) {
        if (container._avatarLoopTimer) {
          clearTimeout(container._avatarLoopTimer);
          container._avatarLoopTimer = null;
        }
        startSpeakingLoop();
      } else {
        if (container._avatarSpeakTimer) {
          clearInterval(container._avatarSpeakTimer);
          container._avatarSpeakTimer = null;
        }
        container.classList.remove('is-speaking', 'is-speaking-jitter');
        drawCapriAvatarOnCanvas(canvas, container.dataset.face || baseFace);
        startIdleLoop();
      }
    },
    setFace(face) {
      container.dataset.face = face;
      if (!isSpeaking) {
        drawCapriAvatarOnCanvas(canvas, face);
      }
    },
    destroy() {
      if (container._avatarLoopTimer) clearTimeout(container._avatarLoopTimer);
      if (container._avatarSpeakTimer) clearInterval(container._avatarSpeakTimer);
    }
  };

  container._avatarController = controller;

  if (isLive) {
    startSpeakingLoop();
  } else {
    startIdleLoop();
  }

  return controller;
}

function createCapriAvatar(face = 'normal', isLive = false) {
  const container = document.createElement('div');
  container.className = `capri-chat-avatar holo-msg-avatar${isLive ? ' holo-msg-avatar--live is-speaking is-speaking-jitter' : ''}`;
  container.dataset.face = face;
  container.title = `Capri (${face})`;

  const idx = FACE_MAP[face] ?? 0;
  container.style.setProperty('--face-idx', idx);

  const canvas = document.createElement('canvas');
  canvas.width = 38;
  canvas.height = 38;
  canvas.className = 'capri-avatar-canvas';
  container.appendChild(canvas);

  registerCapriAvatar(container, face, isLive);

  return container;
}

function createUserAvatar(avatarUrl) {
  const container = document.createElement('div');
  container.className = 'user-chat-avatar holo-user-avatar';
  container.title = 'User';

  const img = document.createElement('img');
  img.className = 'user-avatar-img';
  img.alt = 'User';
  const validUrl = (typeof avatarUrl === 'string' && avatarUrl.trim() && avatarUrl !== 'undefined') ? avatarUrl.trim() : DEFAULT_USER_AVATAR;
  img.src = validUrl;
  img.onerror = () => {
    if (img.src !== DEFAULT_USER_AVATAR) {
      img.src = DEFAULT_USER_AVATAR;
    }
  };
  container.appendChild(img);
  return container;
}

export class Panel {
  constructor({ panel, ticker, labels }) {
    this.el = panel;
    this.tickerEl = ticker;
    this.labels = labels;

    // Legacy DOM element bindings
    this.line = panel.querySelector('.panel__line');
    this.portrait = panel.querySelector('.panel__face img');
    this.quote = panel.querySelector('.panel__quote');
    this.reply = panel.querySelector('.panel__reply');
    this.report = panel.querySelector('.panel__report');
    this.actions = panel.querySelector('.panel__actions');
    this.onAction = null;
    this.onDismiss = null;
    this.summary = panel.querySelector('.panel__summary');
    this.log = panel.querySelector('.panel__log');
    this.tag = panel.querySelector('.panel__tag');
    this.state = panel.querySelector('.panel__state');
    this.tickerVerb = ticker.querySelector('.ticker__verb');
    this.tickerTarget = ticker.querySelector('.ticker__target');

    // Header Ticker inside Hologram chat header
    this.headerTicker = panel.querySelector('#holo-header-ticker');
    this.headerTickerVerb = panel.querySelector('.holo-ticker-verb');
    this.headerTickerTarget = panel.querySelector('.holo-ticker-target');

    // Hologram Projection DOM bindings
    this.tabViewChat = panel.querySelector('#tab-view-chat');
    this.tabViewSettings = panel.querySelector('#tab-view-settings');
    this.navBtnChat = panel.querySelector('#nav-btn-chat');
    this.navBtnMedia = panel.querySelector('#nav-btn-media');
    this.navBtnSettings = panel.querySelector('#nav-btn-settings');
    this.moreBtn = panel.querySelector('#holo-more-btn');
    this.overflowMenu = panel.querySelector('#holo-overflow-menu');
    this.overflowBtnMedia = panel.querySelector('#overflow-btn-media');
    this.overflowBtnSettings = panel.querySelector('#overflow-btn-settings');
    this.minBtn = panel.querySelector('#holo-min-btn');
    this.closeBtn = panel.querySelector('#holo-close-btn') || panel.querySelector('.panel__close');
    this.mediaHud = panel.querySelector('#holo-media-hud');
    this.chatHistory = panel.querySelector('#holo-chat-history');
    this.chatLog = panel.querySelector('#holo-chat-log');
    this.timerBar = panel.querySelector('#holo-timer-bar') || panel.querySelector('.panel__hologram-timer-bar');
    this.resizeHandle = panel.querySelector('#holo-resize-handle');

    this.width = 680;
    this.height = 440;
    this.isAboveChip = true;

    try {
      const savedSize = localStorage.getItem('capri.hologramSize');
      if (savedSize) {
        const parsed = JSON.parse(savedSize);
        if (parsed.width && parsed.height) {
          this.width = clamp(Number(parsed.width), 380, window.innerWidth - 40);
          this.height = clamp(Number(parsed.height), 320, window.innerHeight - 60);
        }
      }
    } catch {}

    try {
      this.userAvatar = localStorage.getItem('capri_user_avatar') || localStorage.getItem('capri.userAvatar') || DEFAULT_USER_AVATAR;
    } catch {
      this.userAvatar = DEFAULT_USER_AVATAR;
    }

    try {
      const savedPos = localStorage.getItem('capri.tickerPosition');
      if (savedPos) {
        const parsed = JSON.parse(savedPos);
        // Reset legacy offsets to 0px if top-left preset was defaulted
        if (parsed.preset === 'top-left' && (parsed.offsetX === 8 || parsed.offsetX === undefined) && (parsed.offsetY === 8 || parsed.offsetY === undefined)) {
          parsed.offsetX = 0;
          parsed.offsetY = 0;
          parsed.statusBarOffsetX = 0;
          parsed.statusBarOffsetY = 0;
          localStorage.setItem('capri.tickerPosition', JSON.stringify(parsed));
        }
        this.setTickerPosition(parsed);
      } else {
        this.setTickerPosition({ preset: 'top-left', offsetX: 0, offsetY: 0, statusBarOffsetX: 0, statusBarOffsetY: 0 });
      }
    } catch {
      this.setTickerPosition({ preset: 'top-left', offsetX: 0, offsetY: 0, statusBarOffsetX: 0, statusBarOffsetY: 0 });
    }
    this.initTickerDragging();

    this.current = null;
    this.hideTimer = null;
    this.decodeTimer = null;
    this.onChar = null;
    this.onTalk = null;
    this.suspended = false;
    this.tickerAction = null;
    this.tickerShownAt = 0;
    this.tickerTimer = null;
    this.missed = null;
    this.chipCenterGetter = null;
    this.capriRef = null;

    // Chat form bindings
    this.chatForm = panel.querySelector('.panel__chat');
    this.chatInput = panel.querySelector('.panel__input');
    this.chatSend = panel.querySelector('.panel__send');
    this.chatClose = panel.querySelector('.panel__close');
    this.chatMic = panel.querySelector('.panel__mic');
    this.chatMicDot = panel.querySelector('.panel__mic-dot');
    this.note = panel.querySelector('.panel__note');

    this.onMicClick = null;
    this.onMicContextMenu = null;
    this.onSettingsClick = null;

    // State machine for Smart 8-10s Auto-Dismiss
    this.isSpeaking = false;
    this.isThinking = false;
    this.isMouseOver = false;
    this.isInputFocused = false;
    this.isSettingsOpen = false;
    this.isMediaOpen = false;

    this.dismissInterval = null;
    this.dismissPaused = false;
    this.dismissDuration = 9000; // 9s default
    this.dismissStart = 0;
    this.dismissRemaining = 9000;

    // Character drag isolation: stop all clicks inside panel
    this.el.addEventListener('mousedown', (e) => e.stopPropagation());
    this.el.addEventListener('click', (e) => e.stopPropagation());

    // Navigation buttons
    this.navBtnChat?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchTab('chat');
    });

    this.navBtnMedia?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMedia();
    });

    this.navBtnSettings?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.switchTab('settings');
    });

    this.moreBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.overflowMenu) {
        this.overflowMenu.hidden = !this.overflowMenu.hidden;
      }
    });

    this.overflowBtnMedia?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.overflowMenu) this.overflowMenu.hidden = true;
      this.navBtnMedia?.click();
    });

    this.overflowBtnSettings?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.overflowMenu) this.overflowMenu.hidden = true;
      this.navBtnSettings?.click();
    });

    this.el.addEventListener('click', () => {
      if (this.overflowMenu && !this.overflowMenu.hidden) {
        this.overflowMenu.hidden = true;
      }
    });

    this.minBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    this.closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });

    // Auto-detect responsive size changes via ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = entry.contentRect.width;
          if (w > 0) this.updateResponsiveClasses(w);
        }
      });
      ro.observe(this.el);
    }

    // Mic button
    this.chatMic?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onMicClick?.();
    });
    this.chatMic?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onMicContextMenu?.();
    });

    // Chat form input handling
    this.chatForm?.addEventListener('click', (e) => e.stopPropagation());
    this.chatForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const text = this.chatInput?.value.trim();
      if (!text || this.chatInput.disabled) return;
      this.chatInput.value = '';
      this.current?.onSend?.(text);
    });

    this.chatInput?.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      window.host?.setFocusable?.(true);
    });
    this.chatInput?.addEventListener('focus', () => {
      this.setInputFocused(true);
      window.host?.setFocusable?.(true);
    });
    this.chatInput?.addEventListener('blur', () => {
      this.setInputFocused(false);
    });
    this.chatInput?.addEventListener('input', () => {
      this.resetDismissCountdown();
    });
    this.chatInput?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') this.hide();
    });

    // Hover detection for Smart Countdown
    this.el.addEventListener('mouseenter', () => this.setMouseOver(true));
    this.el.addEventListener('mouseleave', () => this.setMouseOver(false));

    // Initialize Media Player UI inside Media HUD
    this.playerRef = null;
    this.musicMode = 'capri';
    this.musicEl = document.createElement('div');
    this.musicEl.className = 'panel__music holo-music holo-media-dock__bar';
    this.musicEl.innerHTML = `
      <div class="panel__music-head holo-media-dock__meta">
        <span class="holo-media-dock__icon">
          <svg class="dock-svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        </span>
        <div class="holo-media-dock__marquee">
          <span class="panel__music-title">Capri Cyber-Audio</span>
        </div>
        <span class="panel__music-time">00:00 / --:--</span>
      </div>
      <div class="panel__progress-wrap holo-media-progress-wrap" title="Tua bài hát">
        <div class="panel__progress-bar holo-media-progress-bar"></div>
      </div>
      <div class="panel__music-ctrls holo-media-dock__ctrls">
        <button class="panel__music-btn holo-music-btn" data-action="prev" type="button" title="Bài trước">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"></line></svg>
        </button>
        <button class="panel__music-btn is-toggle holo-music-btn" data-action="toggle" type="button" title="Phát / Tạm dừng">
          <svg class="play-svg" viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </button>
        <button class="panel__music-btn holo-music-btn" data-action="stop" type="button" title="Dừng">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>
        </button>
        <button class="panel__music-btn holo-music-btn" data-action="next" type="button" title="Bài tiếp">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"></line></svg>
        </button>
        <button class="panel__music-btn holo-music-btn" data-action="radio" type="button" title="Đổi đài Radio">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
        </button>
        <input class="panel__vol-slider holo-vol-slider" type="range" min="0" max="100" value="70" title="Âm lượng">
      </div>
    `;

    if (this.mediaHud) {
      this.mediaHud.appendChild(this.musicEl);
    }

    this.musicTitle = this.musicEl.querySelector('.panel__music-title');
    this.musicTime = this.musicEl.querySelector('.panel__music-time');
    this.musicProgressWrap = this.musicEl.querySelector('.panel__progress-wrap');
    this.musicProgressBar = this.musicEl.querySelector('.panel__progress-bar');
    this.musicToggleBtn = this.musicEl.querySelector('.is-toggle');
    this.musicVolSlider = this.musicEl.querySelector('.panel__vol-slider');

    this.musicEl.addEventListener('mousedown', (e) => e.stopPropagation());
    this.musicEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.target.closest('.panel__music-btn');
      if (btn) {
        const act = btn.dataset.action;
        if (act === 'toggle') this.playerRef?.toggle();
        else if (act === 'stop') this.playerRef?.stop();
        else if (act === 'next') this.playerRef?.next();
        else if (act === 'prev') this.playerRef?.prev();
        else if (act === 'radio') this.playerRef?.cycleRadio();
      }
    });

    this.musicProgressWrap?.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = this.musicProgressWrap.getBoundingClientRect();
      if (rect.width > 0) {
        const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
        this.playerRef?.seek(pct);
      }
    });

    this.musicVolSlider?.addEventListener('input', (e) => {
      e.stopPropagation();
      this.playerRef?.setVolume(Number(e.target.value) / 100);
    });
  }

  get visible() {
    return !this.el.hidden && !this.suspended && !this.leaving;
  }

  bindCapri(capri) {
    this.capriRef = capri;
  }

  bindChip(chip) {
    this.chipRef = chip;
    this.chip = chip;
  }

  setChipCenterGetter(fn) {
    this.chipCenterGetter = fn;
  }

  switchTab(tab) {
    if (tab === 'chat') {
      if (this.tabViewChat) this.tabViewChat.hidden = false;
      if (this.tabViewSettings) this.tabViewSettings.hidden = true;
      this.navBtnChat?.classList.add('is-active');
      this.navBtnSettings?.classList.remove('is-active');
      this.setSettingsOpen(false);
      this.chatInput?.focus();
    } else if (tab === 'settings') {
      if (this.tabViewChat) this.tabViewChat.hidden = true;
      if (this.tabViewSettings) this.tabViewSettings.hidden = false;
      this.navBtnSettings?.classList.add('is-active');
      this.navBtnChat?.classList.remove('is-active');
      this.setSettingsOpen(true);
      this.onSettingsClick?.(true);
    }
  }

  toggleMedia(force = null) {
    if (!this.mediaHud) return;
    const show = force !== null ? force : this.mediaHud.hidden;
    this.mediaHud.hidden = !show;
    this.isMediaOpen = show;
    this.navBtnMedia?.classList.toggle('is-active', show);
  }

  // --- SMART AUTO-DISMISS CONTROLLER ---
  canStartDismissCountdown() {
    return !this.isSpeaking &&
           !this.isThinking &&
           !this.isMouseOver &&
           !this.isInputFocused &&
           !this.isSettingsOpen;
  }

  checkDismissConditions() {
    if (this.canStartDismissCountdown()) {
      if (!this.dismissInterval) {
        this.startDismissCountdown(9000);
      } else if (this.dismissPaused) {
        this.resumeDismissCountdown();
      }
    } else {
      this.pauseDismissCountdown();
    }
  }

  startDismissCountdown(duration = 9000) {
    if (duration <= 0) {
      if (this.dismissInterval) clearInterval(this.dismissInterval);
      this.dismissInterval = null;
      if (this.timerBar) this.timerBar.style.width = '0%';
      return;
    }
    this.dismissDuration = duration;
    this.dismissStart = performance.now();
    this.dismissRemaining = duration;
    this.dismissPaused = !this.canStartDismissCountdown();

    if (this.dismissInterval) clearInterval(this.dismissInterval);
    if (this.timerBar) this.timerBar.style.width = '100%';

    this.dismissInterval = setInterval(() => {
      if (!this.canStartDismissCountdown()) {
        this.pauseDismissCountdown();
        return;
      }
      const elapsed = performance.now() - this.dismissStart;
      const remaining = Math.max(0, this.dismissDuration - elapsed);
      const pct = (remaining / this.dismissDuration) * 100;
      if (this.timerBar) this.timerBar.style.width = `${pct.toFixed(1)}%`;

      if (remaining <= 0) {
        clearInterval(this.dismissInterval);
        this.dismissInterval = null;
        this.hide();
      }
    }, 100);
  }

  pauseDismissCountdown() {
    if (this.dismissPaused) return;
    this.dismissPaused = true;
    if (this.timerBar) this.timerBar.style.width = '100%';
  }

  resumeDismissCountdown() {
    if (!this.canStartDismissCountdown()) return;
    this.dismissStart = performance.now() - (this.dismissDuration - this.dismissRemaining);
    this.dismissPaused = false;
  }

  resetDismissCountdown() {
    this.dismissPaused = true;
    this.dismissRemaining = this.dismissDuration || 9000;
    this.dismissStart = performance.now();
    if (this.timerBar) this.timerBar.style.width = '100%';
  }

  setMouseOver(isOver) {
    this.isMouseOver = Boolean(isOver);
    if (this.isMouseOver) {
      this.resetDismissCountdown();
    } else {
      this.checkDismissConditions();
    }
  }

  setInputFocused(isFocused) {
    this.isInputFocused = Boolean(isFocused);
    if (this.isInputFocused) {
      this.resetDismissCountdown();
    } else {
      this.checkDismissConditions();
    }
  }

  setSettingsOpen(isOpen) {
    this.isSettingsOpen = Boolean(isOpen);
    if (this.isSettingsOpen) {
      this.resetDismissCountdown();
    } else {
      this.checkDismissConditions();
    }
  }

  setThinking(isThinking) {
    this.isThinking = Boolean(isThinking);
    if (this.isThinking) {
      this.resetDismissCountdown();
    } else {
      this.checkDismissConditions();
    }
  }

  setSpeaking(isSpeaking, volume = 0) {
    this.isSpeaking = Boolean(isSpeaking);
    if (this.isSpeaking) {
      this.resetDismissCountdown();
      if (this.capriRef?.sprite) {
        this.capriRef.perform?.('talk');
      }
    } else {
      this.checkDismissConditions();
    }
  }

  setFace(name) {
    if (this.portrait) {
      const src = FACE_DIR + (FACES[name] || FACES.grin);
      if (this.portrait.getAttribute('src') !== src) {
        this.portrait.setAttribute('src', src);
        this.portrait.classList.remove('is-swapping');
        void this.portrait.offsetWidth; // trigger reflow
        this.portrait.classList.add('is-swapping');
      }
    }
  }

  // --- MESSAGE PRESENTATION ---
  say(msg) {
    // If the chat frame is closed and this is not an explicit user-initiated chat,
    // route speech exclusively to the Mini Biochip to honor on-demand Chat Frame policy.
    if (!this.visible && !msg.chat) {
      if (this.chipRef?.say) {
        this.chipRef.say({
          text: msg.line || msg.summary || msg.reply || '',
          badge: msg.badge ? `[ CAPRI // ${msg.badge} ]` : '[ CAPRI // SYS ]',
          duration: msg.hold || 6000,
          tts: Boolean(msg.speak || msg.tts)
        });
        return true;
      }
    }

    const cur = this.current;
    if (cur && this.visible && cur.kind !== msg.kind && PRIORITY[cur.kind] > PRIORITY[msg.kind] && performance.now() - cur.at < 2600) {
      return false;
    }
    if (cur?.reply && this.visible && PRIORITY[msg.kind] < 2) return false;
    if (cur?.report && this.visible && PRIORITY[msg.kind] < 3) return false;
    if (cur?.chat && !this.el.hidden && !this.leaving && PRIORITY[msg.kind] < 4) {
      if (PRIORITY[msg.kind] >= 3) this.missed = { ...msg, missedAt: performance.now() };
      return false;
    }
    if (cur && this.visible) this.onDismiss?.(cur);
    cur?.onLeave?.();
    this.current = { ...msg, at: performance.now() };
    clearTimeout(this.hideTimer);

    this.switchTab('chat');
    this.el.dataset.kind = msg.kind;
    this.setFace(msg.face || KIND_FACE[msg.kind] || 'grin');

    if (this.tag) this.tag.textContent = msg.tag || '';
    if (this.state) this.state.textContent = msg.badge || this.labels.state[msg.kind] || '';
    if (this.quote) {
      this.quote.textContent = msg.quote || '';
      this.quote.hidden = !msg.quote;
    }
    if (this.reply) {
      this.reply.textContent = msg.reply || '';
      this.reply.hidden = !msg.reply;
      this.reply.scrollTop = 0;
    }
    this.el.classList.toggle('has-reply', Boolean(msg.reply));
    this.el.classList.toggle('has-report', Boolean(msg.report));
    this.el.classList.toggle('is-guide', Boolean(msg.guide));

    this.renderReport(msg.report);
    this.renderActions(msg.actions, msg.onAction);
    this.renderChat(msg.chat);
    if (this.summary) {
      this.summary.textContent = msg.summary || '';
      this.summary.hidden = !msg.summary;
    }
    this.renderLog(msg.log || []);

    this.tickerEl.hidden = true;
    this.leaving = false;
    this.el.hidden = false;
    this.el.classList.remove('is-leaving');
    document.body.classList.add('is-panel-open');
    this.chip?.hideSpeech?.();
    this.chip?.hideQuickInput?.(true);
    this.chip?.clearStatusBadge?.();
    this.place();
    this.decode(msg.line || '', msg.kind);

    if (this.chatHistory) {
      this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
    }

    if (msg.hold) {
      this.startDismissCountdown(msg.hold);
    } else {
      this.startDismissCountdown(9000);
    }
    return true;
  }

  renderReport(report) {
    if (!this.report) return;
    clearInterval(this.countTimer);
    this.report.hidden = !report;
    if (!report) {
      this.report.replaceChildren();
      return;
    }
    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };
    const number = (className, value) => {
      const node = el('b', className, '0');
      node.dataset.value = value;
      return node;
    };
    const head = el('header', 'report__head');
    head.append(el('span', 'report__title', this.labels.report.title), el('span', 'report__date', report.date));
    const hero = el('div', 'report__hero');
    hero.append(number('report__big', report.hero.value), el('span', 'report__label', report.hero.label));
    const grid = el('dl', 'report__grid');
    for (const stat of report.stats) {
      const cell = el('div', stat.hot ? 'report__cell is-hot' : 'report__cell');
      const value = el('dd');
      value.append(number('report__num', stat.value));
      cell.append(el('dt', 'report__label', stat.label), value);
      grid.append(cell);
    }
    const parts = [head, hero, grid];
    if (report.longest) {
      const longest = el('p', 'report__longest');
      longest.append(el('span', 'report__chip', report.longest.label), el('span', 'report__project', report.longest.project), el('b', 'report__time', report.longest.time));
      parts.push(longest);
    }
    const foot = el('footer', 'report__foot');
    foot.append(el('span', '', report.foot), el('span', 'report__sign', 'CAPRI // PROJECT CAPRICORN'));
    parts.push(foot);
    this.report.replaceChildren(...parts);

    const numbers = [...this.report.querySelectorAll('[data-value]')];
    const show = (node, k) => {
      node.textContent = Math.round(Number(node.dataset.value) * k).toLocaleString(document.documentElement.lang);
    };
    if (reducedMotion.matches) {
      numbers.forEach((node) => show(node, 1));
      return;
    }
    const t0 = performance.now();
    const step = () => {
      let counting = false;
      numbers.forEach((node, i) => {
        const k = clamp((performance.now() - t0 - 180 - i * 70) / COUNT_MS, 0, 1);
        show(node, ease.out(k));
        if (k < 1) counting = true;
      });
      if (!counting) clearInterval(this.countTimer);
    };
    step();
    this.countTimer = setInterval(step, 1000 / 12);
  }

  renderActions(actions = [], onAction = null) {
    if (!this.actions) return;
    this.actions.replaceChildren(...actions.map(({ id, label, primary }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = primary ? 'panel__action is-primary' : 'panel__action';
      button.dataset.id = id;
      button.textContent = label;
      button.addEventListener('mousedown', (e) => e.stopPropagation());
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onAction) onAction(id);
        else this.onAction?.(id);
      });
      return button;
    }));
    this.actions.hidden = !actions.length;
  }

  setActions(actions, onAction) {
    if (!this.current) return;
    this.current.actions = actions;
    this.renderActions(actions, onAction);
    this.place();
  }

  renderChat(chat) {
    this.el.classList.toggle('is-chat', Boolean(chat));
    this.line?.classList.remove('is-streaming');
    if (this.chatForm) this.chatForm.hidden = !chat;
    if (this.note) this.note.hidden = !chat;
    if (!chat || !this.chatInput) return;

    this.chatInput.placeholder = chat.placeholder || 'Gửi tin nhắn hoặc ra lệnh cho Capri...';
    this.chatInput.setAttribute('aria-label', chat.placeholder);
    this.chatInput.disabled = false;
    if (this.chatSend) {
      this.chatSend.disabled = false;
      this.chatSend.textContent = chat.send || 'Gửi';
    }
    if (this.note) {
      const tag = document.createElement('b');
      tag.textContent = chat.noteTag || '';
      this.note.replaceChildren(tag, ` ${chat.note || ''}`);
    }
    requestAnimationFrame(() => this.chatInput?.focus());
  }

  renderChatHistory(messages = []) {
    if (!this.chatLog) this.chatLog = this.el.querySelector('#holo-chat-log');
    if (!this.chatLog) return;
    this.chatLog.replaceChildren();

    // Display recent conversation history (up to 50 messages)
    const recent = messages.slice(-50);
    for (const msg of recent) {
      if (msg.role === 'user') {
        const row = document.createElement('div');
        row.className = 'holo-msg-row holo-msg-row--user';
        const bubble = document.createElement('div');
        bubble.className = 'holo-bubble holo-bubble--user is-history';
        bubble.textContent = msg.content;
        const avatar = createUserAvatar(this.userAvatar);
        row.appendChild(bubble);
        row.appendChild(avatar);
        this.chatLog.appendChild(row);
      } else {
        const face = getMessageEmotion(msg.content);
        const row = document.createElement('div');
        row.className = 'holo-msg-row holo-msg-row--capri';
        const avatar = createCapriAvatar(face, false);
        const bubble = document.createElement('div');
        bubble.className = 'holo-bubble holo-bubble--capri is-history';
        const p = document.createElement('p');
        p.className = 'holo-line';
        p.textContent = msg.content.replace(/\[(normal|grin|laugh|watch|look|all_eyes|many|zigzag|aside|look_down|smug|glance|wide)\]/gi, '').trim();
        bubble.appendChild(p);
        row.appendChild(avatar);
        row.appendChild(bubble);
        this.chatLog.appendChild(row);
      }
    }

    if (this.chatHistory) {
      requestAnimationFrame(() => {
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
      });
    }
  }

  setUserAvatar(avatarUrl) {
    const validUrl = (typeof avatarUrl === 'string' && avatarUrl.trim() && avatarUrl !== 'undefined') ? avatarUrl.trim() : DEFAULT_USER_AVATAR;
    this.userAvatar = validUrl;
    try {
      localStorage.setItem('capri.userAvatar', validUrl);
    } catch {}
    if (this.chatLog) {
      this.chatLog.querySelectorAll('.holo-user-avatar').forEach((el) => {
        let img = el.querySelector('img.user-avatar-img');
        if (!img) {
          img = document.createElement('img');
          img.className = 'user-avatar-img';
          img.alt = 'User';
          el.appendChild(img);
        }
        img.onerror = () => {
          if (img.src !== DEFAULT_USER_AVATAR) {
            img.src = DEFAULT_USER_AVATAR;
          }
        };
        img.src = validUrl;
        el.style.backgroundImage = 'none';
      });
    }
  }

  appendChatMessage(role, text) {
    if (!this.chatLog) this.chatLog = this.el.querySelector('#holo-chat-log');
    if (!this.chatLog || !text) return;

    // Deduplication guard: ignore if last rendered message has identical role and text within 1500ms
    const now = performance.now();
    if (this._lastMsg && this._lastMsg.role === role && this._lastMsg.text.trim() === text.trim() && (now - this._lastMsg.time < 1500)) {
      return;
    }
    this._lastMsg = { role, text, time: now };

    if (role === 'user') {
      const row = document.createElement('div');
      row.className = 'holo-msg-row holo-msg-row--user';
      const bubble = document.createElement('div');
      bubble.className = 'holo-bubble holo-bubble--user';
      bubble.textContent = text;
      const avatar = createUserAvatar(this.userAvatar);
      row.appendChild(bubble);
      row.appendChild(avatar);
      this.chatLog.appendChild(row);
    } else {
      const face = getMessageEmotion(text);
      const row = document.createElement('div');
      row.className = 'holo-msg-row holo-msg-row--capri';
      const avatar = createCapriAvatar(face, false);
      const bubble = document.createElement('div');
      bubble.className = 'holo-bubble holo-bubble--capri';
      const p = document.createElement('p');
      p.className = 'holo-line';
      p.textContent = text.replace(/\[(normal|grin|laugh|watch|look|all_eyes|many|zigzag|aside|look_down|smug|glance|wide)\]/gi, '').trim();
      bubble.appendChild(p);
      row.appendChild(avatar);
      row.appendChild(bubble);
      this.chatLog.appendChild(row);
    }

    if (this.chatHistory) {
      requestAnimationFrame(() => {
        this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
      });
    }
  }

  clearHistoryDom() {
    if (!this.chatLog) this.chatLog = this.el.querySelector('#holo-chat-log');
    if (this.chatLog) this.chatLog.replaceChildren();
    if (this.quote) {
      this.quote.textContent = '';
      this.quote.hidden = true;
    }
    if (this.line) {
      this.line.textContent = '';
    }
    const liveRow = this.el.querySelector('.holo-current-reply');
    if (liveRow) liveRow.hidden = true;
  }

  chatTurn({ quote, face }) {
    if (!this.current?.chat) return;
    clearInterval(this.decodeTimer);
    const resolvedFace = face || 'watch';
    this.setFace(resolvedFace);
    if (this.quote) {
      this.quote.textContent = '';
      this.quote.hidden = true;
    }
    const liveRow = this.el.querySelector('.holo-current-reply');
    if (liveRow) {
      liveRow.hidden = false;
      const liveAvatar = liveRow.querySelector('.holo-msg-avatar');
      if (liveAvatar) {
        liveAvatar.dataset.face = resolvedFace;
        let canvas = liveAvatar.querySelector('canvas');
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = 38;
          canvas.height = 38;
          canvas.className = 'capri-avatar-canvas';
          liveAvatar.appendChild(canvas);
        }
        if (!liveAvatar._avatarController) {
          registerCapriAvatar(liveAvatar, resolvedFace, true);
        } else {
          liveAvatar._avatarController.setFace(resolvedFace);
          liveAvatar._avatarController.setSpeaking(true);
        }
      }
    }
    if (this.line) {
      this.line.textContent = '';
      this.line.classList.add('is-streaming');
    }
    this.setSpeaking(true);
    this.place();
    if (this.chatHistory) this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  stream(text, { done = false } = {}) {
    if (!this.current?.chat || !this.line) return;
    const liveRow = this.el.querySelector('.holo-current-reply');
    if (done) {
      this.line.textContent = '';
      this.line.classList.remove('is-streaming');
      if (liveRow) {
        liveRow.hidden = true;
        const liveAvatar = liveRow.querySelector('.holo-msg-avatar');
        if (liveAvatar) {
          if (liveAvatar._avatarController) {
            liveAvatar._avatarController.setSpeaking(false);
          } else {
            liveAvatar.classList.remove('is-speaking', 'is-speaking-jitter');
          }
        }
      }
      this.setSpeaking(false);
    } else {
      if (liveRow) liveRow.hidden = false;
      this.line.textContent = text;
      this.line.classList.add('is-streaming');
      const liveAvatar = liveRow?.querySelector('.holo-msg-avatar');
      if (liveAvatar?._avatarController) {
        liveAvatar._avatarController.setSpeaking(true);
      }
      this.setSpeaking(true);
    }
    this.place();
    if (this.chatHistory) this.chatHistory.scrollTop = this.chatHistory.scrollHeight;
  }

  setChatBusy(busy) {
    if (this.chatInput) this.chatInput.disabled = busy;
    if (this.chatSend) this.chatSend.disabled = busy;
    if (!busy && this.current?.chat) this.chatInput?.focus();
    this.setThinking(busy);
  }

  relabel(id, label) {
    const button = this.actions?.querySelector(`[data-id="${id}"]`);
    if (button) button.textContent = label;
  }

  async snapshot(copy) {
    this.el.classList.add('is-capturing');
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    await frame();
    const r = this.el.getBoundingClientRect();
    const pad = 18;
    const rect = {
      x: Math.max(0, Math.floor(r.left - pad)),
      y: Math.max(0, Math.floor(r.top - pad)),
      width: Math.ceil(r.width + pad * 2 + 6),
      height: Math.ceil(r.height + pad * 2 + 6),
    };
    const plate = document.createElement('div');
    plate.className = 'snap-plate';
    Object.assign(plate.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    document.body.append(plate);
    await frame();
    await frame();
    try {
      return await copy(rect);
    } finally {
      plate.remove();
      this.el.classList.remove('is-capturing');
    }
  }

  updateLog(log) {
    if (this.current && this.visible) this.renderLog(log);
  }

  renderLog(entries) {
    if (!this.log) return;
    this.log.replaceChildren(...entries.slice(-4).map((e) => {
      const li = document.createElement('li');
      if (e.error) li.className = 'is-error';
      const verb = document.createElement('span');
      verb.className = 'panel__verb';
      verb.textContent = e.verb;
      const target = document.createElement('span');
      target.className = 'panel__target';
      target.textContent = e.target || '';
      li.append(verb, target);
      return li;
    }));
    this.log.hidden = entries.length === 0;
  }

  show() {
    this.el.hidden = false;
    this.leaving = false;
    document.body.classList.add('is-panel-open');
    this.chip?.hideSpeech?.();
    this.chip?.hideQuickInput?.(true);
    this.chip?.clearStatusBadge?.();
    this.capriRef?.resumeLoop?.();
    this.place();
    this.chatInput?.focus();
    window.host?.setFocusable?.(true);
  }

  hide() {
    clearTimeout(this.hideTimer);
    clearInterval(this.decodeTimer);
    if (this.countTimer) {
      clearInterval(this.countTimer);
      this.countTimer = null;
    }
    if (this.dismissInterval) {
      clearInterval(this.dismissInterval);
      this.dismissInterval = null;
    }
    if (this.timerBar) this.timerBar.style.width = '100%';
    this.setSpeaking(false);
    this.onTalk?.(false);
    this.capriRef?.pauseLoop?.();

    // Hide holographic beam
    const beamSvg = document.getElementById('holo-beam');
    if (beamSvg) beamSvg.hidden = true;

    if (this.el.hidden || this.leaving) {
      document.body.classList.remove('is-panel-open');
      return;
    }
    const gone = this.current;
    this.current = null;
    this.leaving = true;
    if (gone) {
      this.onDismiss?.(gone);
      gone.onLeave?.();
    }
    const missed = gone?.chat && this.missed;
    this.missed = null;
    if (missed && performance.now() - missed.missedAt < 120000) setTimeout(() => this.say(missed), 400);

    this.el.hidden = true;
    this.leaving = false;
    document.body.classList.remove('is-panel-open');
    if (this.tickerAction) this.setTicker(this.tickerAction);
    this.onHide?.();
  }

  clearKind(kind) {
    if (this.current?.kind === kind) this.hide();
  }

  suspend() {
    this.suspended = true;
    this.el.style.visibility = 'hidden';
    this.tickerEl.style.visibility = 'hidden';
    const beamSvg = document.getElementById('holo-beam');
    if (beamSvg) beamSvg.hidden = true;
  }

  resume() {
    this.suspended = false;
    this.el.style.visibility = '';
    this.tickerEl.style.visibility = '';
    this.place();
  }

  forceRestore() {
    this.suspended = false;
    this.leaving = false;
    this.el.style.visibility = '';
    this.el.style.pointerEvents = 'auto';
    this.tickerEl.style.visibility = '';
    clearTimeout(this.hideTimer);
    clearInterval(this.decodeTimer);
    this.place();
  }

  decode(text, kind) {
    clearInterval(this.decodeTimer);
    if (reducedMotion.matches || !text || !this.line) {
      if (this.line) this.line.textContent = text;
      return;
    }
    const chars = [...text];
    let done = 0;
    this.setSpeaking(true);
    this.onTalk?.(true);

    const step = () => {
      done = Math.min(chars.length, done + 2);
      const head = chars.slice(0, done).join('');
      let tail = '';
      for (let i = done; i < Math.min(chars.length, done + 6); i++) {
        tail += chars[i] === ' ' ? ' ' : NOISE[Math.floor(Math.random() * NOISE.length)];
      }
      this.line.textContent = head + tail;
      if (chars[done - 1] && chars[done - 1] !== ' ') this.onChar?.(kind);
      if (done >= chars.length) {
        clearInterval(this.decodeTimer);
        this.line.textContent = text;
        this.setSpeaking(false);
        this.onTalk?.(false);
        this.checkDismissConditions();
      }
    };
    step();
    this.decodeTimer = setInterval(step, DECODE_STEP_MS);
  }

  bindPlayer(player) {
    this.playerRef = player;
  }

  showMusic(show = true) {
    this.toggleMedia(show);
  }

  setMusicMode(mode) {
    this.musicMode = mode;
    const title = this.playerRef?.currentTitle();

    if (mode === 'discord') {
      if (title && window.host?.discordCommand) {
        window.host.discordCommand('play', null, title).then((res) => {
          this.setTicker({ verb: 'DISCORD', target: res?.ok ? title : (res?.message || 'Lỗi phát Discord') });
        });
      }
    } else if (mode === 'external') {
      if (title && window.host?.openWebMusic) {
        window.host.openWebMusic('youtube', title);
      }
    } else if (mode === 'capri') {
      if (!this.playerRef?.playing) {
        this.playerRef?.play();
      }
    }
  }

  updateMusicProgress({ currentTime = 0, duration = 0, percent = 0, title }) {
    if (this.musicProgressBar) {
      this.musicProgressBar.style.width = `${Math.min(100, Math.max(0, percent)).toFixed(1)}%`;
    }
    if (this.musicTime) {
      const fmt = (s, isDur = false) => {
        if (!Number.isFinite(s) || isNaN(s) || s < 0) return isDur ? '--:--' : '00:00';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      };
      const durStr = (!Number.isFinite(duration) || duration <= 0) ? '--:--' : fmt(duration, true);
      this.musicTime.textContent = `${fmt(currentTime)} / ${durStr}`;
    }
    if (title && this.musicTitle) {
      this.musicTitle.textContent = title;
    }
  }

  updateMusicPlaying(playing) {
    if (this.musicToggleBtn) {
      this.musicToggleBtn.innerHTML = playing
        ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'
        : '<svg class="play-svg" viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
  }

  updateMusicVolume(volume) {
    if (this.musicVolSlider) {
      this.musicVolSlider.value = Math.round(volume * 100);
    }
  }

  setMusicIdle() {
    if (this.musicProgressBar) this.musicProgressBar.style.width = '0%';
    if (this.musicTime) this.musicTime.textContent = '00:00 / --:--';
    if (this.musicToggleBtn) {
      this.musicToggleBtn.innerHTML = '<svg class="play-svg" viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    }
    this.setTicker(null);
  }

  setMicStatus(status) {
    if (this.chatMic) {
      this.chatMic.classList.remove('is-listening', 'is-recording', 'is-off');
      if (status === 'recording') {
        this.chatMic.classList.add('is-recording');
      } else if (status === 'listening') {
        this.chatMic.classList.add('is-listening');
      } else {
        this.chatMic.classList.add('is-off');
      }
    }
    if (this.chatMicDot) {
      this.chatMicDot.classList.remove('is-listening', 'is-recording', 'is-off');
      if (status === 'recording') {
        this.chatMicDot.classList.add('is-recording');
      } else if (status === 'listening') {
        this.chatMicDot.classList.add('is-listening');
      } else {
        this.chatMicDot.classList.add('is-off');
      }
    }
  }

  setMicTooltip(tooltip) {
    if (this.chatMic) {
      this.chatMic.title = tooltip || '';
    }
  }

  setTicker(action) {
    this.tickerAction = action;
    clearTimeout(this.tickerTimer);

    const stripEmojis = (s) => String(s || '').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}⚡🎙️🟢🟣🎵💬]/gu, '').trim();

    if (this.headerTickerVerb) {
      if (action) {
        const cleanVerb = stripEmojis(action.verb) || 'IDLE';
        this.headerTickerVerb.textContent = cleanVerb;
        this.headerTickerTarget.textContent = action.target ? `: ${stripEmojis(action.target)}` : '';
      } else {
        this.headerTickerVerb.textContent = 'IDLE';
        this.headerTickerTarget.textContent = '';
      }
    }

    if (!action) {
      if (this.tickerEl) this.tickerEl.hidden = true;
      return;
    }
    const wait = Math.max(0, 150 - (performance.now() - this.tickerShownAt));
    this.tickerTimer = setTimeout(() => {
      this.tickerShownAt = performance.now();
      if (this.tickerVerb) this.tickerVerb.textContent = stripEmojis(action.verb);
      if (this.tickerTarget) this.tickerTarget.textContent = stripEmojis(action.target) || '';
      if (this.tickerEl) {
        this.tickerEl.dataset.error = action.error ? 'true' : 'false';
        this.tickerEl.dataset.thinking = action.thinking ? 'true' : 'false';
        this.tickerEl.hidden = false;
      }
    }, wait);
  }

  setTickerPosition(pos = {}) {
    if (!this.tickerEl) return;
    const preset = pos.preset || 'top-left';
    const offsetX = Number(pos.offsetX ?? pos.x ?? pos.statusBarOffsetX ?? 0);
    const offsetY = Number(pos.offsetY ?? pos.y ?? pos.statusBarOffsetY ?? 0);

    this.tickerPosition = { preset, offsetX, offsetY, statusBarOffsetX: offsetX, statusBarOffsetY: offsetY, x: pos.x, y: pos.y };
    try {
      localStorage.setItem('capri.tickerPosition', JSON.stringify(this.tickerPosition));
    } catch {}

    // Reset styles
    this.tickerEl.style.removeProperty('top');
    this.tickerEl.style.removeProperty('left');
    this.tickerEl.style.removeProperty('right');
    this.tickerEl.style.removeProperty('bottom');
    this.tickerEl.style.removeProperty('transform');

    switch (preset) {
      case 'top-center':
        this.tickerEl.style.setProperty('top', `${offsetY}px`, 'important');
        this.tickerEl.style.setProperty('left', '50%', 'important');
        this.tickerEl.style.setProperty('transform', 'translateX(-50%)', 'important');
        break;
      case 'top-right':
        this.tickerEl.style.setProperty('top', `${offsetY}px`, 'important');
        this.tickerEl.style.setProperty('right', `${offsetX}px`, 'important');
        this.tickerEl.style.setProperty('left', 'auto', 'important');
        break;
      case 'bottom-left':
        this.tickerEl.style.setProperty('bottom', `${offsetY}px`, 'important');
        this.tickerEl.style.setProperty('left', `${offsetX}px`, 'important');
        this.tickerEl.style.setProperty('top', 'auto', 'important');
        break;
      case 'custom':
        this.tickerEl.style.setProperty('top', `${offsetY}px`, 'important');
        this.tickerEl.style.setProperty('left', `${offsetX}px`, 'important');
        break;
      case 'top-left':
      default:
        this.tickerEl.style.setProperty('top', `${offsetY}px`, 'important');
        this.tickerEl.style.setProperty('left', `${offsetX}px`, 'important');
        break;
    }
  }

  initTickerDragging() {
    if (!this.tickerEl || this._tickerDragBound) return;
    this._tickerDragBound = true;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    this.tickerEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      this.tickerEl.classList.add('is-dragging');
      const rect = this.tickerEl.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('mousemove', (e) => {
      if (!dragging || !this.tickerEl) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const w = this.tickerEl.offsetWidth || 180;
      const h = this.tickerEl.offsetHeight || 32;
      const maxLeft = Math.max(0, window.innerWidth - w);
      const maxTop = Math.max(0, window.innerHeight - h);

      const newLeft = Math.max(0, Math.min(maxLeft, Math.round(initialLeft + dx)));
      const newTop = Math.max(0, Math.min(maxTop, Math.round(initialTop + dy)));

      this.tickerEl.style.removeProperty('right');
      this.tickerEl.style.removeProperty('bottom');
      this.tickerEl.style.setProperty('transform', 'none', 'important');
      this.tickerEl.style.setProperty('left', `${newLeft}px`, 'important');
      this.tickerEl.style.setProperty('top', `${newTop}px`, 'important');
    });

    window.addEventListener('mouseup', () => {
      if (!dragging || !this.tickerEl) return;
      dragging = false;
      this.tickerEl.classList.remove('is-dragging');
      const rect = this.tickerEl.getBoundingClientRect();
      const savedPos = {
        preset: 'custom',
        offsetX: Math.round(rect.left),
        offsetY: Math.round(rect.top),
        statusBarOffsetX: Math.round(rect.left),
        statusBarOffsetY: Math.round(rect.top),
        x: Math.round(rect.left),
        y: Math.round(rect.top),
      };
      this.setTickerPosition(savedPos);
      if (this.host?.setConfig) {
        this.host.setConfig({ system: { tickerPosition: savedPos } });
      }
    });
  }

  updateI18n(lang) {
    const isEn = lang === 'en';
    if (this.chatInput) {
      this.chatInput.placeholder = isEn
        ? 'Type a message or command for Capri...'
        : 'Gửi tin nhắn hoặc ra lệnh cho Capri...';
      this.chatInput.setAttribute('aria-label', this.chatInput.placeholder);
    }
    if (this.chatSend) {
      this.chatSend.textContent = isEn ? 'Send' : 'Gửi';
    }
    const settingsBtnLabel = this.navBtnSettings?.querySelector('.btn-label');
    if (settingsBtnLabel) {
      settingsBtnLabel.textContent = isEn ? 'Settings' : 'Cài đặt';
    }
    if (this.minBtn) {
      this.minBtn.title = isEn ? 'Minimize to Biochip' : 'Thu nhỏ về Biochip';
    }
    if (this.closeBtn) {
      this.closeBtn.title = isEn ? 'Close Projection' : 'Đóng màn hình chiếu';
    }
    const overflowSettings = this.el.querySelector('#overflow-btn-settings');
    if (overflowSettings) {
      overflowSettings.textContent = isEn ? 'Settings' : 'Cài đặt';
    }
  }

  setTheme(theme) {
    document.documentElement.dataset.theme = theme || 'system';
  }

  setOpacity(val) {
    const num = clamp(Number(val), 0.5, 1.0);
    document.documentElement.style.setProperty('--holo-opacity', num);
  }

  setSize(w, h) {
    this.width = Math.round(w);
    this.height = Math.round(h);
    this.el.style.width = `${this.width}px`;
    this.el.style.height = `${this.height}px`;
    this.updateResponsiveClasses(this.width);
    this.place();
  }

  updateResponsiveClasses(w = this.width) {
    const width = w || this.el.offsetWidth || 680;
    const isCompact = width < 500;
    const isUltraCompact = width < 420;
    this.el.classList.toggle('is-compact', isCompact);
    this.el.classList.toggle('is-ultra-compact', isUltraCompact);
    if (!isUltraCompact && this.overflowMenu) {
      this.overflowMenu.hidden = true;
    }
  }

  alignToChip(cc = null) {
    const chipCenter = cc || (this.chipCenterGetter ? this.chipCenterGetter() : { x: 152, y: innerHeight - 118 });
    const w = this.width || 680;
    const h = this.height || 440;
    const margin = 20;
    const gap = 26; // Safe gap above the biochip

    // Biochip visual top is approximately chipCenter.y - 65
    const biochipTop = chipCenter.y - 65;
    const biochipBottom = chipCenter.y + 65;

    let top = biochipTop - gap - h;
    let isAbove = true;

    // If not enough room above (e.g. biochip is dragged near top of the screen), place below
    if (top < margin) {
      if (biochipBottom + gap + h <= innerHeight - margin) {
        top = biochipBottom + gap;
        isAbove = false;
      } else {
        top = Math.max(margin, Math.min(top, innerHeight - h - margin));
      }
    }

    // Horizontally: align the left character stage (width 220, center 110) with chipCenter.x
    let left = chipCenter.x - 110;
    left = Math.max(margin, Math.min(left, innerWidth - w - margin));

    this.el.style.position = 'fixed';
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
    this.el.style.bottom = 'auto';
    this.el.style.width = `${Math.round(w)}px`;
    this.el.style.height = `${Math.round(h)}px`;

    this.isAboveChip = isAbove;
    this.updateHoloBeam(chipCenter);
  }

  setAnchor(_anchor, _view) {
    this.place();
  }

  // Smoothly positions above Mini Biochip without covering it
  place() {
    this.updateResponsiveClasses();
    this.alignToChip();
  }

  updateHoloBeam(cc = null) {
    const beamSvg = document.getElementById('holo-beam');
    const beamPoly = document.getElementById('holo-beam-poly');
    const beamScan = document.getElementById('holo-beam-scan');
    const beamLineL = document.getElementById('holo-beam-left');
    const beamLineR = document.getElementById('holo-beam-right');
    if (!beamSvg || !beamPoly) return;

    if (this.el.hidden || this.suspended || this.leaving) {
      beamSvg.hidden = true;
      return;
    }

    const r = this.rect();
    if (!r) {
      beamSvg.hidden = true;
      return;
    }

    const chipCenter = cc || (this.chipCenterGetter ? this.chipCenterGetter() : { x: 152, y: innerHeight - 118 });
    const sourceX = Math.round(chipCenter.x);
    const sourceY = Math.round(this.isAboveChip ? chipCenter.y - 45 : chipCenter.y + 45);

    const targetL_X = Math.round(r.left + 24);
    const targetL_Y = Math.round(this.isAboveChip ? r.bottom : r.top);
    const targetR_X = Math.round(r.right - 24);
    const targetR_Y = Math.round(this.isAboveChip ? r.bottom : r.top);

    const points = `${sourceX},${sourceY} ${targetL_X},${targetL_Y} ${targetR_X},${targetR_Y}`;
    beamPoly.setAttribute('points', points);
    if (beamScan) beamScan.setAttribute('points', points);

    if (beamLineL) {
      beamLineL.setAttribute('x1', sourceX);
      beamLineL.setAttribute('y1', sourceY);
      beamLineL.setAttribute('x2', targetL_X);
      beamLineL.setAttribute('y2', targetL_Y);
    }
    if (beamLineR) {
      beamLineR.setAttribute('x1', sourceX);
      beamLineR.setAttribute('y1', sourceY);
      beamLineR.setAttribute('x2', targetR_X);
      beamLineR.setAttribute('y2', targetR_Y);
    }
    beamSvg.hidden = false;
  }

  rect() {
    if (this.el.hidden || this.suspended || this.leaving) return null;
    return this.el.getBoundingClientRect();
  }
}
