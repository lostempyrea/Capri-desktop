// Her small forms on their own canvases.
// Cyberpunk Hologram Construct Assistant v2.5
// 3 Mini States: Awake Mini (living eyes, gazing, breathing, shards, audio ring)
//                Hibernated Mini (shut eyes, 1 FPS energy saver)
//                Vanish Mode (stealth, opacity 0)

import { COLORS, drawMask } from './fx.js';
import { rand, reducedMotion } from './util.js';

const STEP = 1000 / 12;

class Small {
  constructor(canvas, w, h) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = w;
    this.h = h;
    this.visible = false;
    this.pointer = null;
    this.shownAt = 0;
    this.last = 0;
    this.x = 0;
    this.y = 0;
    this.loop = this.loop.bind(this);
  }

  moveTo(x, y) {
    const dpr = window.devicePixelRatio || 1;
    if (this.canvas.width !== Math.round(this.w * dpr)) {
      this.canvas.width = Math.round(this.w * dpr);
      this.canvas.height = Math.round(this.h * dpr);
      this.canvas.style.width = `${this.w}px`;
      this.canvas.style.height = `${this.h}px`;
    }
    this.x = x;
    this.y = y;
    this.canvas.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  contains(x, y, pad = 8) {
    if (this.miniState === 'vanish' || this.canvas?.hidden) return false;
    if (this.containsQuickInput && this.containsQuickInput(x, y)) return true;
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        if (x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad) {
          return true;
        }
      }
    }
    return x >= this.x - pad && x <= this.x + this.w + pad && y >= this.y - pad && y <= this.y + this.h + pad;
  }

  show() {
    this.visible = true;
    this.canvas.hidden = false;
    this.canvas.style.pointerEvents = 'auto';
    this.shownAt = performance.now();
    requestAnimationFrame(this.loop);
  }

  hide() {
    this.hideSpeech();
    this.visible = false;
    this.canvas.hidden = true;
    this.pointer = null;
  }

  reset() {
    this.pointer = null;
    this.canvas.style.pointerEvents = 'auto';
  }

  loop(now) {
    if (!this.visible) return;
    requestAnimationFrame(this.loop);
    if (now - this.last < STEP - 1) return;
    this.last = now;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.draw(now, Math.floor(now / STEP));
  }

  get landing() {
    return performance.now() - this.shownAt < STEP * 1.5 && !reducedMotion.matches;
  }
}

// ---------- Mask, asleep in place (DEPRECATED & MUTED: SINGLE BIOCHIP GUARANTEE) ----------
export class Mask extends Small {
  constructor(canvas) {
    super(canvas, 160, 200);
    this.k = 0.66;
    this.wokeAt = 0;
    this.nextPeek = 0;
    this.peek = null;
    if (this.canvas) {
      this.canvas.hidden = true;
      this.canvas.style.display = 'none';
    }
  }

  place() {
    if (this.canvas) {
      this.canvas.hidden = true;
      this.canvas.style.display = 'none';
    }
  }

  show() {
    // Single Biochip Architecture: Mask canvas must NEVER spawn or render on screen
    this.visible = false;
    if (this.canvas) {
      this.canvas.hidden = true;
      this.canvas.style.display = 'none';
    }
  }

  wake() {}
  reset() {}
  draw() {}
}

// ---------- Cyberpunk Mini Biochip Construct ----------
// Docked right on top of the Windows Taskbar with minimal gap
const MARGIN = { left: 24, bottom: -48 };
const K = 0.65;

export class Chip extends Small {
  constructor(canvas) {
    if (Chip.instance) {
      return Chip.instance;
    }
    // Generous canvas width/height to accommodate floating shards, status badge and audio ring
    super(canvas, 240, 220);
    Chip.instance = this;
    this.mode = 'idle';
    this.miniState = 'awake'; // 'awake' | 'hibernated' | 'vanish'
    this.audioRms = 0;
    this.statusBadge = null; // { text, type, until }

    // Natural blinking
    this.nextBlink = performance.now() + rand(2500, 5000);
    this.isBlinking = false;
    this.blinkEnd = 0;

    // Mouse tracking
    this.mousePos = null;

    // Static pool of 8 red data shards orbiting around the mask
    this.shards = Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      dist: rand(44, 75),
      speed: rand(0.015, 0.035) * (i % 2 === 0 ? 1 : -1),
      size: rand(2.5, 5),
      driftY: rand(-10, 10)
    }));

    this.rafId = null;
    this.sleepTimeout = null;

    // High-Tech Speech Bubble controller
    this.speechEl = null;
    this.speechTextEl = null;
    this.speechBadgeEl = null;
    this.speechIconEl = null;
    this.speechCursorEl = null;
    this.typewriterTimer = null;
    this.speechDismissTimer = null;
    this.voiceRef = null;
    this.isStatusActive = false;

    // Quick-Chat Input controller
    this.quickInputEl = null;
    this.quickInputField = null;
    this.quickSendBtn = null;
    this.chatRef = null;
    this.isQuickInputHovered = false;
    this.isQuickInputFocused = false;
    this.quickInputHideTimer = null;

    // Drag vs Click Tracking on Mini Biochip (Threshold > 8px)
    this.isMouseDown = false;
    this.hasDragged = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragDownTime = 0;
    this._pointerBound = false;
    this.capriRef = null;
  }

  bindChat(chat) {
    this.chatRef = chat;
  }

  bindVoiceInput(voiceInput) {
    this.voiceInput = voiceInput;
  }

  bindPanel(panel) {
    this.panel = panel;
    this.initPointerInteraction();
  }

  bindCapri(capri) {
    this.capriRef = capri;
    this.initPointerInteraction();
  }

  initPointerInteraction() {
    if (this._pointerBound || !this.canvas) return;
    this._pointerBound = true;

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target?.closest?.('#biochip-quick-input, #biochip-speech, #biochip-voice-pill')) return;
      this.isMouseDown = true;
      this.hasDragged = false;
      this.dragStartX = e.screenX;
      this.dragStartY = e.screenY;
      this.dragDownTime = Date.now();
      window.host?.setInteractive?.(true);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const dist = Math.hypot(e.screenX - this.dragStartX, e.screenY - this.dragStartY);
      if (dist > 8) {
        this.hasDragged = true;
        if (this.capriRef && typeof this.capriRef.perform === 'function' && !this.capriRef.busy) {
          try {
            this.capriRef.perform('dangle');
          } catch {}
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isMouseDown) return;
      const wasDragged = this.hasDragged;
      this.isMouseDown = false;
      this.hasDragged = false;

      if (!wasDragged) {
        // Distance <= 8px: Open/close large chat panel immediately
        if (this.panel) {
          if (this.panel.visible) {
            this.panel.hide();
            this.chat?.close?.();
          } else {
            if (typeof this.chat?.start === 'function') {
              this.chat.start();
            } else if (typeof this.panel.openPanel === 'function') {
              this.panel.openPanel();
            } else {
              this.panel.show();
            }
          }
        }
        window.dispatchEvent(new CustomEvent('capri:toggle-chat'));
      }
    });
  }

  initVoicePill() {
    this.voicePillEl = document.getElementById('biochip-voice-pill');
    if (this.voicePillEl) {
      this.voicePillEl.hidden = true;
      this.voicePillEl.style.display = 'none';
    }
  }

  lockQuickInput(placeholder = null) {
    if (!this.quickInputField) return;
    const text = placeholder || 'Listening to voice transmission...';
    this.quickInputField.disabled = true;
    this.quickInputField.placeholder = text;
    this.quickInputEl?.classList.add('is-recording');
  }

  unlockQuickInput() {
    if (!this.quickInputField) return;
    this.quickInputField.disabled = false;
    this.quickInputField.style.pointerEvents = 'auto';
    this.quickInputEl?.classList.remove('is-recording');
    this.updateI18n('en');
  }

  updateI18n(_lang = 'en') {
    if (this.quickInputField && !this.quickInputField.disabled) {
      this.quickInputField.placeholder = 'Quick message or command...';
    }
  }

  initQuickInput() {
    this.quickInputEl = document.getElementById('biochip-quick-input');
    if (!this.quickInputEl) return;
    this.quickInputField = document.getElementById('biochip-quick-input-field');
    this.quickMicBtn = document.getElementById('biochip-quick-mic-btn') || document.getElementById('biochip-quick-send-btn');

    // Block context menu on Biochip and Quick-Input
    this.quickInputEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.canvas?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Prevent any mouse/pointer events inside Quick-Input from bubbling up to window/Biochip
    ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'].forEach((evt) => {
      this.quickInputEl.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
      this.quickInputField?.addEventListener(evt, (e) => {
        e.stopPropagation();
      });
    });

    // Keep visible on input hover or interaction
    this.quickInputEl.addEventListener('mouseenter', () => {
      this.isQuickInputHovered = true;
      this.cancelQuickInputHide();
    });

    this.quickInputEl.addEventListener('mouseleave', () => {
      this.isQuickInputHovered = false;
      this.hideQuickInput();
    });

    // Biochip canvas hover listeners
    this.canvas.addEventListener('mouseenter', () => {
      this.showQuickInput();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hideQuickInput();
    });

    // Input focus and click tracking (ensures unlock)
    this.quickInputField?.addEventListener('click', () => {
      this.unlockQuickInput();
      window.host?.setFocusable?.(true);
      this.quickInputField.focus();
    });

    this.quickInputField?.addEventListener('focus', () => {
      this.unlockQuickInput();
      this.isQuickInputFocused = true;
      this.cancelQuickInputHide();
      window.host?.setFocusable?.(true);
    });

    this.quickInputField?.addEventListener('blur', () => {
      this.isQuickInputFocused = false;
      setTimeout(() => this.hideQuickInput(), 150);
    });

    this.quickInputField?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitQuickInput();
      } else if (e.key === 'Escape') {
        this.quickInputField.value = '';
        this.quickInputField.blur();
        this.hideQuickInput(true);
      }
    });

    this.quickMicBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.voiceInput?.toggleCommandMode) {
        this.voiceInput.toggleCommandMode();
      } else {
        window.dispatchEvent(new CustomEvent('capri:mic'));
      }
    });
  }

  submitQuickInput() {
    if (!this.quickInputField) return;
    const text = this.quickInputField.value.trim();
    if (!text) return;
    this.quickInputField.value = '';
    this.quickInputField.blur();
    this.hideQuickInput(true);

    if (this.chatRef?.handleSpokenCommand) {
      this.chatRef.handleSpokenCommand(text);
    } else if (this.chatRef?.handleSpokenQueryOnChip) {
      this.chatRef.handleSpokenQueryOnChip(text);
    }
  }

  showQuickInput() {
    if (!this.quickInputEl) this.initQuickInput();
    if (!this.quickInputEl || this.miniState === 'vanish' || this.panel?.visible) return;
    this.cancelQuickInputHide();
    this.updateLayoutPositions();
    this.quickInputEl.hidden = false;
    void this.quickInputEl.offsetWidth;
    this.quickInputEl.classList.add('is-visible');
  }

  hideQuickInput(immediate = false) {
    if (this.isQuickInputFocused && !immediate) return;
    this.cancelQuickInputHide();
    if (immediate) {
      if (this.quickInputEl) {
        this.quickInputEl.classList.remove('is-visible');
        this.quickInputEl.hidden = true;
      }
      return;
    }
    this.quickInputHideTimer = setTimeout(() => {
      if (!this.isQuickInputHovered && !this.isQuickInputFocused && this.quickInputEl) {
        this.quickInputEl.classList.remove('is-visible');
        setTimeout(() => {
          if (!this.quickInputEl.classList.contains('is-visible')) {
            this.quickInputEl.hidden = true;
          }
        }, 250);
      }
    }, 320); // Bridge timeout allows seamless movement across gaps
  }

  cancelQuickInputHide() {
    if (this.quickInputHideTimer) {
      clearTimeout(this.quickInputHideTimer);
      this.quickInputHideTimer = null;
    }
  }

  updateQuickInputPosition() {
    this.updateLayoutPositions();
  }

  containsQuickInput(x, y) {
    if (!this.quickInputEl || this.quickInputEl.hidden) return false;
    const r = this.quickInputEl.getBoundingClientRect();
    return x >= r.left - 6 && x <= r.right + 6 && y >= r.top - 6 && y <= r.bottom + 6;
  }

  initSpeechBubble() {
    this.speechEl = document.getElementById('biochip-speech');
    if (!this.speechEl) return;
    this.speechTextEl = this.speechEl.querySelector('.biochip-speech__text');
    this.speechBadgeEl = this.speechEl.querySelector('.biochip-speech__badge');
    this.speechIconEl = this.speechEl.querySelector('.biochip-speech__icon');
    this.speechCursorEl = this.speechEl.querySelector('.biochip-speech__cursor');
    if (!this._resizeBound) {
      this._resizeBound = true;
      window.addEventListener('resize', () => {
        if (this.speechEl && !this.speechEl.hidden) {
          this.updateSpeechPosition();
        }
      });
    }
  }

  bindVoice(voice) {
    this.voiceRef = voice;
  }

  say({ text = '', icon = '', badge = '[ CAPRI // VOICE ]', duration = 6000, tts = true }) {
    if (this.panel?.visible || !this.panel?.el?.hidden || document.body.classList.contains('is-panel-open')) {
      return;
    }
    this.isStatusActive = false;
    if (!this.speechEl) this.initSpeechBubble();
    if (!this.speechEl) return;

    const cleanText = (text || '').trim();
    if (!cleanText) return;

    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    if (this.speechDismissTimer) {
      clearTimeout(this.speechDismissTimer);
      this.speechDismissTimer = null;
    }

    if (this.speechBadgeEl) this.speechBadgeEl.textContent = badge;
    if (this.speechIconEl) this.speechIconEl.textContent = icon;
    if (this.speechTextEl) this.speechTextEl.textContent = '';
    if (this.speechCursorEl) this.speechCursorEl.style.display = 'inline';

    this.speechEl.hidden = false;
    void this.speechEl.offsetWidth; // trigger reflow for smooth CSS transition
    this.speechEl.classList.add('is-visible');
    this.updateLayoutPositions();

    // Smooth typewriter text effect
    const chars = [...cleanText];
    let i = 0;
    const stepSpeed = Math.max(12, Math.min(28, Math.floor(1600 / (chars.length || 1))));

    this.typewriterTimer = setInterval(() => {
      if (i < chars.length) {
        this.speechTextEl.textContent += chars[i];
        i++;
        if (i % 8 === 0) {
          this.updateLayoutPositions();
        }
      } else {
        clearInterval(this.typewriterTimer);
        this.typewriterTimer = null;
        this.updateLayoutPositions();
        if (this.speechCursorEl) {
          setTimeout(() => {
            if (!this.typewriterTimer && this.speechCursorEl) {
              this.speechCursorEl.style.display = 'none';
            }
          }, 800);
        }

        if (duration > 0) {
          this.speechDismissTimer = setTimeout(() => {
            this.hideSpeech();
          }, duration);
        }
      }
    }, stepSpeed);

    if (tts && this.voiceRef?.speakCyberpunk) {
      this.voiceRef.speakCyberpunk(cleanText);
    }
  }

  hideSpeech() {
    if (this.typewriterTimer) {
      clearInterval(this.typewriterTimer);
      this.typewriterTimer = null;
    }
    if (this.speechDismissTimer) {
      clearTimeout(this.speechDismissTimer);
      this.speechDismissTimer = null;
    }
    if (!this.speechEl) return;
    this.speechEl.classList.remove('is-visible');
    setTimeout(() => {
      if (this.speechEl && !this.speechEl.classList.contains('is-visible')) {
        this.speechEl.hidden = true;
        if (this.speechTextEl) this.speechTextEl.textContent = '';
      }
    }, 350);
  }

  updateLayoutPositions() {
    const vw = window.innerWidth || document.documentElement.clientWidth || 1920;
    const vh = window.innerHeight || document.documentElement.clientHeight || 1080;
    const margin = 12;
    const chipCenter = this.center();
    const isLowerHalf = (this.y + this.cy) > (vh / 2);

    const centerHorizontally = (el, defaultW) => {
      const rect = el.getBoundingClientRect();
      const elW = Math.max(120, rect.width > 0 ? rect.width : (el.offsetWidth || defaultW));
      let left = chipCenter.x - elW / 2;
      left = Math.max(margin, Math.min(vw - margin - elW, left));
      el.style.left = `${Math.round(left)}px`;
      el.style.transform = 'none';
      return { elW, rect };
    };

    const hasQuickInput = Boolean(this.quickInputEl && !this.quickInputEl.hidden);
    const hasSpeech = Boolean(this.speechEl && !this.speechEl.hidden);

    const quickH = 34;
    const speechH = hasSpeech ? Math.max(40, this.speechEl.getBoundingClientRect().height || this.speechEl.offsetHeight || 60) : 0;

    const chipHeadY = this.y + 45;
    const chipBottomY = this.y + 190;

    if (isLowerHalf) {
      // Stack upwards: [Speech Bubble] -> [Quick Input] -> [Biochip]
      let quickTop = chipHeadY - quickH - 8;
      quickTop = Math.max(margin, Math.min(vh - margin - quickH, quickTop));
      if (this.quickInputEl) {
        centerHorizontally(this.quickInputEl, 250);
        this.quickInputEl.style.top = `${Math.round(quickTop)}px`;
      }

      const baseAboveSpeech = hasQuickInput ? (quickTop - 8) : chipHeadY;
      let speechTop = baseAboveSpeech - speechH - (hasQuickInput ? 0 : 8);
      speechTop = Math.max(margin, Math.min(vh - margin - speechH, speechTop));
      if (this.speechEl) {
        centerHorizontally(this.speechEl, 240);
        this.speechEl.style.top = `${Math.round(speechTop)}px`;
      }

      if (this.voicePillEl) {
        this.voicePillEl.hidden = true;
        this.voicePillEl.style.display = 'none';
      }
    } else {
      // Stack downwards: [Biochip] -> [Quick Input] -> [Speech Bubble]
      let quickTop = chipBottomY + 8;
      quickTop = Math.max(margin, Math.min(vh - margin - quickH, quickTop));
      if (this.quickInputEl) {
        centerHorizontally(this.quickInputEl, 250);
        this.quickInputEl.style.top = `${Math.round(quickTop)}px`;
      }

      const baseBelowSpeech = hasQuickInput ? (quickTop + quickH + 8) : (chipBottomY + 8);
      let speechTop = baseBelowSpeech;
      speechTop = Math.max(margin, Math.min(vh - margin - speechH, speechTop));
      if (this.speechEl) {
        centerHorizontally(this.speechEl, 240);
        this.speechEl.style.top = `${Math.round(speechTop)}px`;
      }

      if (this.voicePillEl) {
        this.voicePillEl.hidden = true;
        this.voicePillEl.style.display = 'none';
      }
    }
  }

  updateSpeechPosition() {
    this.updateLayoutPositions();
  }

  moveTo(x, y) {
    super.moveTo(x, y);
    this.updateLayoutPositions();
  }

  place(w, h, customX = null, customY = null) {
    this.cx = 120;
    this.cy = 130;
    const targetX = customX !== null ? customX : MARGIN.left;
    const targetY = customY !== null ? customY : (h - MARGIN.bottom - this.h);
    this.moveTo(targetX, targetY);
    this.face = { x: this.x + this.cx, y: this.y + this.cy };
  }

  setPosition(x, y) {
    this.moveTo(x, y);
    this.face = { x: this.x + this.cx, y: this.y + this.cy };
  }

  teleport(customX = null, customY = null) {
    const maxX = Math.max(100, window.innerWidth - this.w - 50);
    const maxY = Math.max(100, window.innerHeight - this.h - 50);
    const targetX = customX !== null ? customX : Math.floor(50 + Math.random() * (maxX - 50));
    const targetY = customY !== null ? customY : Math.floor(50 + Math.random() * (maxY - 50));

    this.canvas.classList.add('is-glitching');
    this.canvas.style.opacity = '0.2';
    setTimeout(() => {
      this.moveTo(targetX, targetY);
      this.face = { x: this.x + this.cx, y: this.y + this.cy };
      try {
        localStorage.setItem('capri.chipPosition', JSON.stringify({ x: targetX, y: targetY }));
      } catch {}
      this.canvas.style.opacity = '1';
      this.canvas.classList.remove('is-glitching');
      this.wake();
    }, 150);
  }

  center() {
    return { x: this.x + this.cx, y: this.y + this.cy };
  }


  setMiniState(state) {
    if (this.miniState === state) return;
    this.miniState = state;
    console.log(`[chip] Mini State -> ${state}`);

    if (state === 'vanish') {
      this.hideSpeech();
      this.canvas.style.opacity = '0';
      this.canvas.style.pointerEvents = 'none';
      return;
    } else {
      this.canvas.style.opacity = '1';
      this.canvas.style.pointerEvents = 'auto';
    }

    if (state === 'hibernated') {
      // Slow down to 1 FPS loop
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.scheduleSleepLoop();
    } else if (state === 'awake') {
      if (this.sleepTimeout) {
        clearTimeout(this.sleepTimeout);
        this.sleepTimeout = null;
      }
      if (!this.rafId && this.visible) {
        this.rafId = requestAnimationFrame(this.loop);
      }
    }
  }

  setAudioRms(rms) {
    this.audioRms = Math.max(0, Math.min(1, rms));
  }

  setStatusBadge(text, type = 'listen', duration = 0) {
    if (!text) {
      this.clearStatusBadge();
      return;
    }
    if (this.voicePillEl) {
      this.voicePillEl.hidden = true;
      this.voicePillEl.style.display = 'none';
    }

    if (this.voicePillTimer) {
      clearTimeout(this.voicePillTimer);
      this.voicePillTimer = null;
    }

    this.isStatusActive = true;
    let verb = 'VOICE';
    let target = 'LISTENING...';
    let error = false;
    let thinking = false;

    if (type === 'listen') {
      verb = 'VOICE';
      target = 'LISTENING...';
    } else if (type === 'stt') {
      verb = 'VOICE';
      target = 'DECODING AUDIO...';
      thinking = true;
    } else if (type === 'error') {
      verb = 'VOICE ERROR';
      target = 'CANNOT RECOGNIZE';
      error = true;
    } else {
      verb = 'VOICE';
      target = String(text).toUpperCase();
    }

    this.panel?.setTicker?.({ verb, target, error, thinking });

    if (duration > 0) {
      this.voicePillTimer = setTimeout(() => {
        this.clearStatusBadge();
      }, duration);
    }
  }

  clearStatusBadge() {
    this.isStatusActive = false;
    if (this.voicePillTimer) {
      clearTimeout(this.voicePillTimer);
      this.voicePillTimer = null;
    }
    if (this.voicePillEl) {
      this.voicePillEl.hidden = true;
      this.voicePillEl.style.display = 'none';
    }
    this.panel?.setTicker?.(null);
  }

  setMode(mode) {
    this.mode = mode;
  }

  setPointer(mouse) {
    this.pointer = mouse;
  }

  wake() {
    this.setMiniState('awake');
  }

  hibernate() {
    this.setMiniState('hibernated');
  }

  vanish() {
    this.setMiniState('vanish');
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.canvas.hidden = false;
    this.shownAt = performance.now();
    if (this.miniState === 'hibernated') {
      this.scheduleSleepLoop();
    } else {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  hide() {
    this.hideSpeech();
    this.visible = false;
    this.canvas.hidden = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.sleepTimeout) {
      clearTimeout(this.sleepTimeout);
      this.sleepTimeout = null;
    }
  }

  scheduleSleepLoop() {
    if (!this.visible || this.miniState !== 'hibernated') return;
    this.sleepTimeout = setTimeout(() => {
      if (!this.visible || this.miniState !== 'hibernated') return;
      const dpr = window.devicePixelRatio || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.w, this.h);
      this.draw(performance.now(), 0);
      this.scheduleSleepLoop();
    }, 1000); // 1 FPS in hibernate mode
  }

  loop(now) {
    if (!this.visible || this.miniState === 'hibernated') return;
    this.rafId = requestAnimationFrame(this.loop);
    if (now - this.last < STEP - 1) return;
    this.last = now;
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.draw(now, Math.floor(now / STEP));
  }

  draw(now, frame) {
    const { ctx } = this;
    const calm = reducedMotion.matches;

    if (this.miniState === 'vanish') return;

    // --- 1. Audio Reactive Neon Ring ---
    const isListening = this.statusBadge && this.statusBadge.type === 'listen';
    const effectiveRms = isListening ? Math.max(this.audioRms, 0.25 + 0.15 * Math.sin(now / 150)) : this.audioRms;

    if (effectiveRms > 0.05) {
      const baseRadius = 38 * K;
      const pulse = effectiveRms * 28;
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.cx, this.cy - 10, baseRadius + pulse, 0, Math.PI * 2);
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 12;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(this.cx, this.cy - 10, baseRadius + pulse * 1.4, 0, Math.PI * 2);
      ctx.strokeStyle = '#9d4edd';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#9d4edd';
      ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.restore();
    }

    // --- 2. Floating Red Data Shards (Only in Awake Mode) ---
    if (this.miniState === 'awake' && !calm) {
      ctx.save();
      ctx.fillStyle = '#ff2a5f';
      ctx.shadowColor = '#ff2a5f';
      ctx.shadowBlur = 6;
      for (const s of this.shards) {
        s.angle += s.speed;
        const sx = this.cx + Math.cos(s.angle) * s.dist;
        const sy = this.cy - 12 + Math.sin(s.angle) * (s.dist * 0.45) + s.driftY;
        ctx.fillRect(sx, sy, s.size, s.size);
      }
      ctx.restore();
    }

    // --- 3. Mask & Eyes Logic ---
    let eyes = [0, 0];
    let look = null;
    let bob = 0;

    if (this.miniState === 'awake') {
      // Breathing float: smooth sin wave
      bob = calm ? 0 : Math.sin(now / 450) * 3;

      // Natural eye blinking
      if (!this.isBlinking && now > this.nextBlink) {
        this.isBlinking = true;
        this.blinkEnd = now + 140;
        this.nextBlink = now + rand(2500, 6000);
      }
      if (this.isBlinking) {
        if (now > this.blinkEnd) {
          this.isBlinking = false;
          eyes = [1, 1];
        } else {
          eyes = [0, 0];
        }
      } else {
        eyes = [1, 1];
      }

      // Gaze follows cursor if pointer nearby
      if (this.pointer) {
        const dx = (this.pointer.x - (this.x + this.cx)) * 0.12;
        const dy = (this.pointer.y - (this.y + this.cy)) * 0.12;
        look = { x: Math.max(-10, Math.min(10, dx)), y: Math.max(-8, Math.min(8, dy)) };
      }
    } else {
      // Hibernated Mini: eyes closed v v, no breathing bob
      eyes = [0, 0];
      look = null;
      bob = 0;
    }

    const shake = this.pointer && !calm ? rand(-1, 1) : 0;
    drawMask(ctx, this.cx + shake, this.cy + bob, K, { eyes, look });

    // --- 4. Bulletproof Floating Status Badges ---
    if (this.statusBadge) {
      if (now > this.statusBadge.until) {
        this.statusBadge = null;
      } else if (!this.speechEl || this.speechEl.hidden) {
        this.drawBadge(ctx, this.statusBadge.text, this.statusBadge.type, now);
      }
    }
  }

  drawBadge(ctx, text, type, now) {
    ctx.save();
    ctx.font = '600 11px "Chakra Petch", monospace';
    const textWidth = ctx.measureText(text).width;
    const boxW = Math.max(120, textWidth + 24);
    const boxH = 26;
    const bx = this.cx - boxW / 2;
    const by = 16;

    let bg = '#0f172a';
    let border = '#00f0ff';
    let textColor = '#38bdf8';

    if (type === 'listen') {
      border = '#22c55e';
      textColor = '#4ade80';
    } else if (type === 'stt') {
      border = '#a855f7';
      textColor = '#c084fc';
    } else if (type === 'error') {
      border = '#ef4444';
      textColor = '#f87171';
    }

    // Chamfered badge background
    ctx.beginPath();
    ctx.moveTo(bx + 6, by);
    ctx.lineTo(bx + boxW, by);
    ctx.lineTo(bx + boxW - 6, by + boxH);
    ctx.lineTo(bx, by + boxH);
    ctx.closePath();

    ctx.fillStyle = bg;
    ctx.shadowColor = border;
    ctx.shadowBlur = 8;
    ctx.fill();

    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, this.cx, by + boxH / 2);
    ctx.restore();
  }
}
