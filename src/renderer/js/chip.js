// Her small forms on their own canvases.
// Cyberpunk Hologram Construct Assistant v2.5
// 3 Mini States: Awake Mini (living eyes, gazing, breathing, shards, audio ring)
//                Hibernated Mini (shut eyes, 1 FPS energy saver)
//                Vanish Mode (stealth, opacity 0)

import { COLORS, drawMask } from './fx.js';
import { BiochipMatrixRig } from './biochip-matrix.js';
import { rand, reducedMotion } from './util.js';

const STEP = 1000 / 12;

class Small {
  constructor(canvas, w, h) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
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

  contains(x, y, pad = 0) {
    if (this.miniState === 'vanish' || this.canvas?.hidden) return false;
    if (typeof this.isAlphaSolid === 'function') {
      return this.isAlphaSolid(x, y, 25);
    }
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return x >= rect.left - pad && x <= rect.right + pad && y >= rect.top - pad && y <= rect.bottom + pad;
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
    // Tight container fitting actual mask silhouette with headroom for pulse ring & shards
    super(canvas, 180, 180);
    Chip.instance = this;
    this.cx = 90;
    this.cy = 95;
    this.mode = 'idle';
    this.miniState = 'awake'; // 'awake' | 'hibernated' | 'vanish'
    this.audioRms = 0;
    this.statusBadge = null; // { text, type, until }

    // Procedural 60 FPS Biochip Behavior Matrix Rig (8 States)
    this.matrixRig = new BiochipMatrixRig();
    this.matrixState = 'idle';
    this.nextFlourishTime = performance.now() + rand(8000, 16000);

    // Natural blinking
    this.nextBlink = performance.now() + rand(2500, 5000);
    this.isBlinking = false;
    this.blinkEnd = 0;

    // Mouse tracking
    this.mousePos = null;

    // Static pool of 8 red data shards orbiting around the mask
    this.shards = Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      dist: rand(36, 64),
      speed: rand(0.015, 0.035) * (i % 2 === 0 ? 1 : -1),
      size: rand(2.5, 5),
      driftY: rand(-8, 8)
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

    // Quick-Chat Input controller (Collapsed 2-button -> Expanded 250px)
    this.quickInputEl = null;
    this.quickInputField = null;
    this.quickTypeBtn = null;
    this.quickMicBtn = null;
    this.isQuickExpanded = false;
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

  // Pixel-Accurate Alpha Hit-Testing on Biochip canvas
  isAlphaSolid(clientX, clientY, threshold = 25) {
    if (this.miniState === 'vanish' || this.canvas?.hidden || !this.canvas) return false;
    const rect = this.canvas.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return false;
    }
    try {
      const dprX = this.canvas.width / rect.width;
      const dprY = this.canvas.height / rect.height;
      const localX = Math.floor((clientX - rect.left) * dprX);
      const localY = Math.floor((clientY - rect.top) * dprY);
      if (localX >= 0 && localX < this.canvas.width && localY >= 0 && localY < this.canvas.height) {
        const pixel = this.ctx.getImageData(localX, localY, 1, 1).data;
        return pixel[3] > threshold;
      }
    } catch {}
    return false;
  }

  contains(x, y) {
    if (this.miniState === 'vanish' || this.canvas?.hidden) return false;
    return this.isAlphaSolid(x, y, 25);
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
      if (
        e.target?.closest?.('.chip-quick-bar, .quick-input-btn, .quick-mic-btn, .quick-chat-input, #biochip-quick-input, .biochip-quick-input, #biochip-speech, #biochip-voice-pill') ||
        this.isQuickExpanded ||
        this.containsQuickInput(e.clientX, e.clientY)
      ) {
        this.isMouseDown = false;
        this.hasDragged = false;
        return;
      }
      // Pixel-Accurate Alpha Hit-Testing: ignore clicks in transparent margin
      if (!this.isAlphaSolid(e.clientX, e.clientY, 25)) {
        return;
      }
      this.isMouseDown = true;
      this.hasDragged = false;
      this.dragStartX = e.screenX;
      this.dragStartY = e.screenY;
      this.dragDownTime = Date.now();
      window.host?.setInteractive?.(true);
    });

    this.canvas.addEventListener('mousemove', (e) => {
      // 1. TextPopup hit-testing priority: bypass canvas alpha when over popup or expanded
      if (this.isQuickExpanded || this.containsQuickInput(e.clientX, e.clientY)) {
        window.host?.setInteractive?.(true);
        document.body.style.cursor = 'default';
        return;
      }

      const solid = this.isAlphaSolid(e.clientX, e.clientY, 25);
      if (solid) {
        document.body.style.cursor = 'pointer';
        window.host?.setInteractive?.(true);
      } else {
        document.body.style.cursor = '';
        if (!this.panel?.visible && !document.body.classList.contains('is-panel-open')) {
          window.host?.setInteractive?.(false);
        }
      }

      if (!this.isMouseDown) return;
      const dist = Math.hypot(e.screenX - this.dragStartX, e.screenY - this.dragStartY);
      if (dist > 8) {
        this.hasDragged = true;
        this.setMatrixState('panic');
        if (this.capriRef && typeof this.capriRef.perform === 'function' && !this.capriRef.busy) {
          try {
            this.capriRef.perform('dangle');
          } catch {}
        }
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.isQuickExpanded || (this.quickInputEl && !this.quickInputEl.hidden && this.isQuickInputHovered)) {
        window.host?.setInteractive?.(true);
        return;
      }
      document.body.style.cursor = '';
      if (!this.panel?.visible && !document.body.classList.contains('is-panel-open')) {
        window.host?.setInteractive?.(false);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (
        e.target?.closest?.('.chip-quick-bar, .quick-input-btn, .quick-mic-btn, .quick-chat-input, #biochip-quick-input, .biochip-quick-input') ||
        (this.containsQuickInput && this.containsQuickInput(e.clientX, e.clientY))
      ) {
        this.isMouseDown = false;
        this.hasDragged = false;
        return;
      }
      if (!this.isMouseDown) return;
      const wasDragged = this.hasDragged;
      this.isMouseDown = false;
      this.hasDragged = false;
      if (this.matrixState === 'panic') {
        this.setMatrixState(this.miniState === 'hibernated' ? 'sleep' : 'idle');
      }

      if (!wasDragged) {
        // Distance <= 8px: Open/close large chat panel immediately ONLY if on solid mask alpha
        if (typeof this.isAlphaSolid !== 'function' || this.isAlphaSolid(e.clientX, e.clientY, 25)) {
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
    // State 3: Type button must NEVER be disabled when mic is active
    if (this.quickTypeBtn) {
      this.quickTypeBtn.disabled = false;
      this.quickTypeBtn.style.pointerEvents = 'auto';
    }
  }

  unlockQuickInput() {
    if (!this.quickInputEl) return;
    this.quickInputEl.classList.remove('is-recording');
    if (this.quickInputField) {
      this.quickInputField.disabled = false;
      this.quickInputField.readOnly = false;
      this.quickInputField.style.pointerEvents = 'auto';
    }
    if (this.quickTypeBtn) {
      this.quickTypeBtn.disabled = false;
      this.quickTypeBtn.style.pointerEvents = 'auto';
    }
    if (this.quickMicBtn) {
      this.quickMicBtn.disabled = false;
      this.quickMicBtn.style.pointerEvents = 'auto';
    }
    this.updateI18n('en');
  }

  setMicStatus(status) {
    if (!this.quickMicBtn) return;
    const dot = this.quickMicBtn.querySelector('.panel__mic-dot');
    if (dot) {
      dot.classList.remove('is-listening', 'is-recording', 'is-off');
      if (status === 'recording') {
        dot.classList.add('is-recording');
        this.quickInputEl?.classList.add('is-recording');
      } else if (status === 'listening' || status === 'idle') {
        dot.classList.add('is-listening');
        this.quickInputEl?.classList.remove('is-recording');
      } else {
        dot.classList.add('is-off');
        this.quickInputEl?.classList.remove('is-recording');
      }
    }
  }

  updateI18n(_lang = 'en') {
    if (this.quickInputField && !this.quickInputField.disabled) {
      this.quickInputField.placeholder = 'Type a message...';
    }
  }

  initQuickInput() {
    this.quickInputEl = document.getElementById('biochip-quick-input');
    if (!this.quickInputEl) return;
    this.quickInputField = document.getElementById('biochip-quick-input-field');
    this.quickTypeBtn = document.getElementById('biochip-quick-type-btn');
    this.quickMicBtn = document.getElementById('biochip-quick-mic-btn') || document.getElementById('biochip-quick-send-btn');
    this.isQuickExpanded = false;

    // Block context menu on Biochip and Quick-Input
    this.quickInputEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    this.canvas?.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Step 2: Prevent all pointer/mouse events inside Quick-Input from bubbling up to window/Biochip
    const stopEvents = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick'];
    [this.quickInputEl, this.quickTypeBtn, this.quickMicBtn, this.quickInputField].forEach((el) => {
      if (!el) return;
      stopEvents.forEach((evt) => {
        el.addEventListener(evt, (e) => {
          e.stopPropagation();
        });
      });
    });

    // Outside click collapse for State 2 (EXPANDED_INPUT)
    window.addEventListener('pointerdown', (e) => {
      if (!this.isQuickExpanded) return;
      if (e.target?.closest?.('.chip-quick-bar, .biochip-quick-input, #biochip-quick-input, .biochip-popup')) {
        return;
      }
      this.collapseQuickInput();
    });

    // Keep visible on input hover or interaction
    this.quickInputEl.addEventListener('mouseenter', () => {
      this.isQuickInputHovered = true;
      this.cancelQuickInputHide();
    });

    this.quickInputEl.addEventListener('mouseleave', () => {
      this.isQuickInputHovered = false;
      if (!this.isQuickInputFocused && !this.isQuickExpanded) {
        this.hideQuickInput();
      }
    });

    // Biochip canvas hover listeners
    this.canvas.addEventListener('mouseenter', () => {
      this.showQuickInput();
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (!this.isQuickExpanded) {
        this.hideQuickInput();
      }
    });

    // Type button click: switches to EXPANDED_INPUT, interrupts mic if recording
    const handleTypeAction = (e) => {
      e.preventDefault();
      e.stopPropagation();
      // Interrupt active mic session cleanly
      if (
        this.voiceInput?.state === 'COMMAND_ACTIVE' ||
        this.voiceInput?.state === 'COMMAND' ||
        this.voiceInput?.isProcessing ||
        this.quickInputEl?.classList.contains('is-recording')
      ) {
        this.voiceInput?.deactivateCommandMode?.();
        this.unlockQuickInput();
      }
      if (!this.isQuickExpanded) {
        this.expandQuickInput();
      } else {
        const text = this.quickInputField?.value?.trim();
        if (text) {
          this.submitQuickInput();
        } else {
          this.collapseQuickInput();
        }
      }
    };
    this.quickTypeBtn?.addEventListener('click', handleTypeAction);
    this.quickTypeBtn?.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      window.host?.focusInput?.();
      window.host?.setFocusable?.(true);
      window.host?.setInteractive?.(true);
    });

    // Input focus and click tracking
    this.quickInputField?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.unlockQuickInput();
      window.host?.focusInput?.();
      window.host?.setFocusable?.(true);
      window.host?.setInteractive?.(true);
      this.quickInputField.focus();
    });

    this.quickInputField?.addEventListener('focus', () => {
      this.unlockQuickInput();
      this.isQuickInputFocused = true;
      this.cancelQuickInputHide();
      window.host?.focusInput?.();
      window.host?.setFocusable?.(true);
      window.host?.setInteractive?.(true);
    });

    this.quickInputField?.addEventListener('blur', () => {
      this.isQuickInputFocused = false;
      const text = this.quickInputField?.value?.trim();
      if (!text) {
        this.collapseQuickInput();
      }
      setTimeout(() => {
        if (!this.isQuickExpanded) {
          this.hideQuickInput();
        }
      }, 200);
    });

    this.quickInputField?.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        this.submitQuickInput();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.quickInputField.value = '';
        this.collapseQuickInput();
        this.hideQuickInput(true);
      }
    });

    // Mic button click: toggles ACTIVE_MIC state without disabling Type button
    this.quickMicBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.isQuickExpanded) {
        this.collapseQuickInput();
      }
      if (this.voiceInput?.toggleCommandMode) {
        this.voiceInput.toggleCommandMode();
      } else {
        window.dispatchEvent(new CustomEvent('capri:mic'));
      }
    });
  }

  expandQuickInput() {
    if (!this.quickInputEl) return;
    this.isQuickExpanded = true;
    this.quickInputEl.classList.add('is-expanded', 'expanded');
    this.unlockQuickInput();
    window.host?.focusInput?.();
    window.host?.setFocusable?.(true);
    window.host?.setInteractive?.(true);
    if (this.quickInputField) {
      this.quickInputField.disabled = false;
      this.quickInputField.readOnly = false;
      this.quickInputField.style.display = 'block';
      this.quickInputField.style.pointerEvents = 'auto';
      // Multiple focus attempts with increasing delays for Electron overlay timing
      this.quickInputField.focus();
      requestAnimationFrame(() => {
        this.quickInputField?.focus();
      });
      setTimeout(() => {
        if (this.isQuickExpanded && this.quickInputField) {
          this.quickInputField.focus();
        }
      }, 80);
      setTimeout(() => {
        if (this.isQuickExpanded && this.quickInputField) {
          this.quickInputField.focus();
        }
      }, 150);
    }
    this.updateLayoutPositions();
  }

  collapseQuickInput() {
    if (!this.quickInputEl) return;
    this.isQuickExpanded = false;
    this.quickInputEl.classList.remove('is-expanded', 'expanded');
    if (this.quickInputField) {
      this.quickInputField.value = '';
      this.quickInputField.blur();
    }
    setTimeout(() => {
      if (!this.isQuickExpanded && this.quickInputField) {
        this.quickInputField.style.display = 'none';
      }
    }, 220);
    this.updateLayoutPositions();
  }

  submitQuickInput() {
    if (!this.quickInputField) return;
    const text = this.quickInputField.value.trim();
    if (!text) return;
    this.quickInputField.value = '';
    this.collapseQuickInput();
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
    if ((this.isQuickInputFocused || this.isQuickExpanded) && !immediate) return;
    this.cancelQuickInputHide();
    if (immediate) {
      if (this.quickInputEl) {
        this.collapseQuickInput();
        this.quickInputEl.classList.remove('is-visible');
        this.quickInputEl.hidden = true;
      }
      return;
    }
    this.quickInputHideTimer = setTimeout(() => {
      if (!this.isQuickInputHovered && !this.isQuickInputFocused && !this.isQuickExpanded && this.quickInputEl) {
        this.collapseQuickInput();
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
    const el = this.quickInputEl || document.getElementById('biochip-quick-input') || document.querySelector('.chip-quick-bar, .biochip-popup');
    if (!el || el.hidden) return false;
    const r = el.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return false;
    const padX = 12;
    const padTop = 16;
    const padBottom = 12;
    return x >= r.left - padX && x <= r.right + padX && y >= r.top - padTop && y <= r.bottom + padBottom;
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
    if (this.panel?.visible || document.body.classList.contains('is-panel-open')) {
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
      const elW = Math.max(40, rect.width > 0 ? rect.width : (el.offsetWidth || defaultW));
      let left = chipCenter.x - elW / 2;
      left = Math.max(margin, Math.min(vw - margin - elW, left));
      el.style.left = `${Math.round(left)}px`;
      el.style.transform = 'none';
      return { elW, rect };
    };

    const hasQuickInput = Boolean(this.quickInputEl && !this.quickInputEl.hidden);
    const hasSpeech = Boolean(this.speechEl && !this.speechEl.hidden);

    const quickH = 32;
    const quickW = this.isQuickExpanded ? 250 : 96;
    const speechH = hasSpeech ? Math.max(40, this.speechEl.getBoundingClientRect().height || this.speechEl.offsetHeight || 60) : 0;

    // Mask visual boundaries: center is at (this.x + this.cx, this.y + this.cy)
    // Mask top edge is ~36px above center; bottom edge is ~36px below center
    const maskVisualTopY = this.y + (this.cy - 36);
    const maskVisualBottomY = this.y + (this.cy + 36);

    const positionQuickBar = (topY) => {
      if (!this.quickInputEl) return;
      this.quickInputEl.style.top = `${Math.round(topY)}px`;
      if (this.isQuickExpanded) {
        // Expand smoothly to the right from the collapsed anchor point
        let anchorLeft = chipCenter.x - 96 / 2;
        anchorLeft = Math.max(margin, Math.min(vw - margin - 250, anchorLeft));
        this.quickInputEl.style.left = `${Math.round(anchorLeft)}px`;
        this.quickInputEl.style.transform = 'none';
      } else {
        centerHorizontally(this.quickInputEl, 96);
      }
    };

    if (isLowerHalf) {
      // Stack upwards: [Speech Bubble] -> [Quick Input] -> [Biochip Mask]
      // Quick Input sits snug 6px above mask top (no floating gap)
      let quickTop = maskVisualTopY - quickH - 6;
      quickTop = Math.max(margin, Math.min(vh - margin - quickH, quickTop));
      positionQuickBar(quickTop);

      const baseAboveSpeech = hasQuickInput ? (quickTop - 6) : (maskVisualTopY - 6);
      let speechTop = baseAboveSpeech - speechH;
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
      // Stack downwards: [Biochip Mask] -> [Quick Input] -> [Speech Bubble]
      // Quick Input sits snug 6px below mask bottom (no floating gap)
      let quickTop = maskVisualBottomY + 6;
      quickTop = Math.max(margin, Math.min(vh - margin - quickH, quickTop));
      positionQuickBar(quickTop);

      const baseBelowSpeech = hasQuickInput ? (quickTop + quickH + 6) : (maskVisualBottomY + 6);
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
    this.cx = 90;
    this.cy = 95;
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

    this.setMatrixState('transit');
    this.canvas.classList.add('is-glitching');
    this.canvas.style.opacity = '0.4';
    setTimeout(() => {
      this.moveTo(targetX, targetY);
      this.face = { x: this.x + this.cx, y: this.y + this.cy };
      try {
        localStorage.setItem('capri.chipPosition', JSON.stringify({ x: targetX, y: targetY }));
      } catch {}
      this.canvas.style.opacity = '1';
      this.canvas.classList.remove('is-glitching');
      this.setMatrixState('idle');
      this.wake();
    }, 200);
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

  setMatrixState(state) {
    if (this.matrixState === state) return;
    this.matrixState = state;
    console.log(`[chip] Matrix State -> ${state}`);
  }

  setMode(mode) {
    this.mode = mode;
    const m = String(mode).toLowerCase();
    if (m === 'sleep' || m === 'dormant' || m === 'hibernated') {
      this.setMatrixState('sleep');
    } else if (m === 'dangle' || m === 'panic' || m === 'drag' || m === 'alert') {
      this.setMatrixState('panic');
    } else if (m === 'active' || m === 'talk' || m === 'sing' || m === 'joy') {
      this.setMatrixState('active');
    } else if (m === 'wink') {
      this.setMatrixState('wink');
    } else if (m === 'glitch' || m === 'error') {
      this.setMatrixState('glitch');
    } else if (m === 'overdrive') {
      this.setMatrixState('overdrive');
    } else if (m === 'transit' || m === 'teleport' || m === 'warp') {
      this.setMatrixState('transit');
    } else if (m === 'idle' || m === 'standby' || m === 'work') {
      this.setMatrixState('idle');
    }
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

    // --- 3. Mask & Eyes Logic (Procedural 60 FPS 8-State Rig) ---
    let eyes = [1, 1];
    let look = null;
    let bob = 0;

    // Resolve current active matrix state
    let state = this.matrixState || 'idle';
    if (this.miniState === 'hibernated') {
      state = 'sleep';
    } else if (this.isMouseDown && this.hasDragged) {
      state = 'panic';
    } else if (this.audioRms > 0.08 || this.mode === 'active' || this.mode === 'talk' || this.mode === 'sing') {
      state = 'active';
    } else if (state === 'idle' && !calm) {
      // Natural idle flourishes: occasional wink or micro-glitch
      if (now > this.nextFlourishTime) {
        const flourish = Math.random() < 0.7 ? 'wink' : 'glitch';
        this.matrixState = flourish;
        const duration = flourish === 'wink' ? 750 : 220;
        setTimeout(() => {
          if (this.matrixState === flourish) {
            this.matrixState = 'idle';
          }
        }, duration);
        this.nextFlourishTime = now + rand(9000, 18000);
      }
    }

    if (state === 'sleep' || this.miniState === 'hibernated') {
      // Hibernated Mini: eyes closed v v, no breathing bob
      eyes = [0, 0];
      look = null;
      bob = 0;
    } else {
      // Breathing float: smooth sin wave
      bob = calm ? 0 : Math.sin(now / 360) * 3;

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
    }

    const shake = (this.pointer && !calm && state === 'panic') ? rand(-2, 2) : 0;

    // Render Procedural 60 FPS Biochip Behavior Matrix Rig
    this.matrixRig.render(ctx, this.cx + shake, this.cy + bob, K, {
      state,
      now,
      look,
      eyes,
      audioRms: effectiveRms,
      calm
    });

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
    const by = 8;

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
