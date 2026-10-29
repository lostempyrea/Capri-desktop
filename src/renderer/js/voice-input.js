// Capri Speech Recognition & "Hey Capri" Wake Word Engine
// Captures mic via Web Audio API + AnalyserNode for VAD (Voice Activity Detection),
// and uses MediaRecorder + Main Process Groq Whisper STT API for transcription.

export class VoiceInput {
  constructor({ host, capri, panel, voice, brain, player, chat, fx, chip, micDeviceId = null, replayBuffer = null, timerGuardian = null }) {
    this.host = host;
    this.capri = capri;
    this.panel = panel;
    this.voice = voice;
    this.brain = brain;
    this.player = player;
    this.chat = chat;
    this.fx = fx;
    this.chip = chip;
    this.replayBuffer = replayBuffer;
    this.timerGuardian = timerGuardian;

    this.currentMicId = micDeviceId || null;
    this.microphones = [];
    this.audioSourceNode = null;
    this.currentVolume = 0;

    this.enabled = true;
    this.wakeWordEnabled = true;
    this.state = 'STANDBY'; // 'STANDBY' | 'COMMAND_ACTIVE'
    this.mediaStream = null;
    this.audioContext = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isProcessing = false;
    this.processingStartTime = 0;
    this.commandActiveStartTime = 0;
    this.onWake = null;

    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    this.recordingStartTime = 0;
    this.loopTimer = null;
    this.commandTimer = null;
    this.selfHealTimer = null;
    this.savedVolume = 0.7;

    this.noiseFloor = 0.015;
    this.threshold = 0.026;

    // Connect panel mic button
    if (this.panel) {
      this.panel.onMicClick = () => {
        if (this.state === 'COMMAND_ACTIVE') {
          this.deactivateCommandMode();
        } else {
          this.activateCommandMode();
        }
      };
      this.panel.onMicContextMenu = () => {
        this.cycleMicrophone();
      };
    }

    // Listen to global shortcut Alt+V from host
    if (this.host.onVoiceListen) {
      this.host.onVoiceListen(() => {
        this.activateCommandMode();
      });
    }

    // Listen to wake word toggle from Tray
    if (this.host.onToggleWakeWord) {
      this.host.onToggleWakeWord((enabled) => {
        this.setWakeWordEnabled(enabled);
      });
    }

    // Listen to microphone switch request from host / tray
    if (this.host.onSetMicrophone) {
      this.host.onSetMicrophone((deviceId) => {
        this.setMicrophone(deviceId, true);
      });
    }

    // Listen for device plug/unplug events
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', async () => {
        console.log('[voice-input] Audio devices changed, re-enumerating...');
        await this.listMicrophones();
      });
    }

    // Self-healing watchdog timer: check and revive suspended audio or dead mic every 30s
    this.selfHealTimer = setInterval(() => {
      this.selfHeal();
    }, 30000);

    this.initAudio(this.currentMicId);
  }

  bindChip(chip) {
    this.chip = chip;
  }

  setMicStatus(status) {
    this.panel?.setMicStatus?.(status);
    this.chip?.setMicStatus?.(status);
  }

  showResponse({ line, badge = 'VOICE', hold = 5000, tts = true }) {
    if (this.panel?.visible) {
      this.panel.say({ kind: 'info', badge, line, hold });
    } else {
      this.chip?.say?.({ text: line, badge: `[ CAPRI // ${badge} ]`, duration: hold, tts });
    }
  }

  initMicrophone(deviceId) {
    return this.initAudio(deviceId);
  }

  getCurrentVolume() {
    return this.currentVolume || 0;
  }

  async selfHeal() {
    try {
      // 1. Resume AudioContext if suspended
      if (this.audioContext && this.audioContext.state === 'suspended') {
        console.log('[voice-input] Self-healing: AudioContext suspended, resuming...');
        await this.audioContext.resume();
      }

      // Also ensure synth Voice context is resumed
      if (this.voice?.resume) {
        await this.voice.resume();
      }

      // 2. Check MediaStream tracks
      let streamValid = false;
      if (this.mediaStream && this.mediaStream.active) {
        const audioTracks = this.mediaStream.getAudioTracks();
        if (audioTracks.length > 0 && audioTracks.every((t) => t.readyState === 'live' && t.enabled)) {
          streamValid = true;
        }
      }

      if (!streamValid) {
        console.warn('[voice-input] Self-healing: Mic stream inactive or ended, re-initializing microphone...');
        await this.initAudio(this.currentMicId);
      }

      // 3. Watchdog: check stuck recording or processing
      const now = performance.now();
      if (this.isRecording && this.recordingStartTime && now - this.recordingStartTime > 10000) {
        console.warn('[voice-input] Self-healing: Recording stuck > 10s, forcing stop...');
        this.stopRecording();
      }
      if (this.isProcessing && this.processingStartTime && now - this.processingStartTime > 10000) {
        console.warn('[voice-input] Self-healing: STT processing stuck > 10s, resetting...');
        this.isProcessing = false;
        this.deactivateCommandMode();
      }
      if (this.state === 'COMMAND_ACTIVE' && this.commandActiveStartTime && now - this.commandActiveStartTime > 10000) {
        console.warn('[voice-input] Self-healing: COMMAND_ACTIVE stuck > 10s, resetting to STANDBY...');
        this.deactivateCommandMode();
      }
    } catch (err) {
      console.warn('[voice-input] Self-healing error:', err);
    }
  }

  async initAudio(deviceId = this.currentMicId) {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('[voice-input] getUserMedia not supported in this environment');
        this.setMicStatus('off');
        return;
      }

      if (this.isRecording) {
        this.stopRecording();
      }

      // Stop old tracks and disconnect old audio source
      if (this.mediaStream) {
        try {
          this.mediaStream.getTracks().forEach((t) => t.stop());
        } catch {}
        this.mediaStream = null;
      }
      if (this.audioSourceNode) {
        try {
          this.audioSourceNode.disconnect();
        } catch {}
        this.audioSourceNode = null;
      }

      const constraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.mediaStream = stream;
      this.currentMicId = deviceId || 'default';

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      } else if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.audioSourceNode = this.audioContext.createMediaStreamSource(stream);
      if (!this.analyser) {
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 512;
      }
      this.audioSourceNode.connect(this.analyser);

      this.setMicStatus(this.wakeWordEnabled ? 'idle' : 'off');
      this.startVADLoop();
      console.log(`[voice-input] Microphone listening loop initialized (deviceId: ${this.currentMicId})`);

      // Refresh microphone list and tooltip
      await this.listMicrophones();
      this.updateMicTooltip();
    } catch (err) {
      console.warn('[voice-input] Microphone access error:', err.message);
      this.setMicStatus('off');
      if (deviceId && deviceId !== 'default') {
        console.log('[voice-input] Falling back to default microphone...');
        await this.initAudio('default');
      }
    }
  }

  async listMicrophones() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');

      const mics = audioInputs.map((d, index) => ({
        id: d.deviceId,
        label: d.label || `Microphone ${index + 1}`,
      }));

      this.microphones = mics;
      this.host?.sendMicrophones?.(mics);
      this.updateMicTooltip();
      return mics;
    } catch (err) {
      console.warn('[voice-input] listMicrophones error:', err);
      return [];
    }
  }

  async setMicrophone(deviceId, announce = true) {
    if (this.currentMicId === deviceId && this.mediaStream) {
      return;
    }
    console.log(`[voice-input] Switching microphone to: ${deviceId}`);
    await this.initAudio(deviceId);

    const found = this.microphones.find((m) => m.id === deviceId);
    const micName = found?.label || (deviceId === 'default' || !deviceId ? 'System Default' : 'Microphone');

    if (announce) {
      this.showResponse({
        line: `Switched microphone: ${micName}`,
        badge: 'MIC',
        hold: 4000,
        tts: false,
      });
      this.voice?.play?.('blip');
    }
    this.updateMicTooltip();
  }

  cycleMicrophone() {
    if (!this.microphones || !this.microphones.length) return null;
    let currentIndex = this.microphones.findIndex((m) => m.id === this.currentMicId);
    if (currentIndex === -1) currentIndex = 0;
    const nextIndex = (currentIndex + 1) % this.microphones.length;
    const nextMic = this.microphones[nextIndex];
    this.setMicrophone(nextMic.id, true);
    if (this.host?.setConfig) {
      this.host.setConfig({ micDeviceId: nextMic.id });
    }
    return nextMic;
  }

  updateMicTooltip() {
    const current = this.microphones.find((m) => m.id === this.currentMicId);
    const name = current?.label || (this.currentMicId === 'default' || !this.currentMicId ? 'System Default' : 'Microphone');
    this.panel?.setMicTooltip?.(`[ MIC ] ${name}\n• Click: Toggle Voice Listening\n• Right-click: Switch Microphone`);
  }

  setWakeWordEnabled(enabled) {
    this.wakeWordEnabled = Boolean(enabled);
    if (!this.wakeWordEnabled && this.state !== 'COMMAND_ACTIVE') {
      this.setMicStatus('off');
    } else if (this.wakeWordEnabled && this.state === 'STANDBY') {
      this.setMicStatus('idle');
    }
  }

  startVADLoop() {
    if (this.loopTimer) clearInterval(this.loopTimer);
    const data = new Float32Array(this.analyser.fftSize);

    this.loopTimer = setInterval(() => {
      if (!this.enabled || !this.analyser) return;

      this.analyser.getFloatTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      this.currentVolume = rms;

      // In STANDBY: NEVER send audioRms to chip, so chip remains 100% IDLE with no reactive neon animation
      if (this.state === 'COMMAND_ACTIVE') {
        this.chip?.setAudioRms(rms);
      } else {
        this.chip?.setAudioRms(0);
      }

      // Adaptive noise floor when quiet
      if (!this.isRecording && rms < 0.02) {
        this.noiseFloor = this.noiseFloor * 0.95 + rms * 0.05;
        this.threshold = Math.max(0.024, this.noiseFloor * 2.6);
      }

      const now = performance.now();
      const isSpeaking = rms > this.threshold;

      if (!this.isRecording) {
        // Only start recording if wake word is on OR we are in COMMAND_ACTIVE mode
        if (!this.wakeWordEnabled && this.state !== 'COMMAND_ACTIVE') return;

        if (isSpeaking) {
          if (!this.speechStartTime) this.speechStartTime = now;
          // Must sustain speech for > 150ms to ignore short clicks/clatters
          if (now - this.speechStartTime > 150) {
            this.startRecording();
          }
        } else {
          this.speechStartTime = 0;
        }
      } else {
        // Currently recording
        if (isSpeaking) {
          this.silenceStartTime = 0;
        } else {
          if (!this.silenceStartTime) this.silenceStartTime = now;
          // Silence duration: 1.1s for STANDBY, 1.4s for COMMAND_ACTIVE
          const silenceThreshold = this.state === 'COMMAND_ACTIVE' ? 1400 : 1100;
          if (now - this.silenceStartTime > silenceThreshold) {
            this.stopRecording();
          }
        }

        // Max recording safeguard (8 seconds)
        if (this.recordingStartTime && now - this.recordingStartTime > 8000) {
          this.stopRecording();
        }
      }
    }, 40);
  }

  startRecording() {
    if (this.isRecording || !this.mediaStream) return;
    this.isRecording = true;
    this.recordingStartTime = performance.now();
    this.silenceStartTime = 0;
    this.audioChunks = [];

    try {
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.audioChunks.push(e.data);
      };
      this.mediaRecorder.onstop = () => {
        this.handleRecordingFinished();
      };
      this.mediaRecorder.start(100);
      if (this.state === 'COMMAND_ACTIVE') {
        this.setMicStatus('recording');
      }
    } catch (err) {
      console.warn('[voice-input] MediaRecorder start error:', err);
      this.isRecording = false;
    }
  }

  stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) return;
    this.isRecording = false;
    this.speechStartTime = 0;
    this.silenceStartTime = 0;
    try {
      if (this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
    } catch (err) {
      console.warn('[voice-input] MediaRecorder stop error:', err);
    }
  }

  async handleRecordingFinished() {
    if (this.audioChunks.length === 0) return;
    const blob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
    this.audioChunks = [];

    // Ignore tiny audio fragments (< 1KB)
    if (blob.size < 1200) return;

    this.isProcessing = true;
    this.processingStartTime = performance.now();
    if (this.state === 'COMMAND_ACTIVE') {
      this.panel?.setTicker?.({ verb: 'VOICE', target: 'DECODING AUDIO...', thinking: true });
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);

      // Watchdog timeout (10s max for STT API request)
      const transcribePromise = this.host.transcribeAudio(bytes, 'audio/webm');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('STT transcription timeout (> 10s)')), 10000)
      );

      const res = await Promise.race([transcribePromise, timeoutPromise]);
      this.isProcessing = false;

      if (!res || !res.ok || !res.text) {
        if (this.state === 'COMMAND_ACTIVE') {
          this.panel?.setTicker?.({ verb: 'VOICE ERROR', target: 'CANNOT RECOGNIZE', error: true });
          setTimeout(() => this.panel?.setTicker?.(null), 2500);
        } else {
          this.panel?.setTicker?.(null);
        }
        return;
      }

      this.panel?.setTicker?.(null);
      const text = res.text.trim();
      console.log(`[voice-input] Transcribed: "${text}" [State: ${this.state}]`);

      if (this.state === 'STANDBY') {
        this.handleStandbySpeech(text);
      } else if (this.state === 'COMMAND_ACTIVE') {
        this.handleCommandSpeech(text);
      }
    } catch (err) {
      console.warn('[voice-input] Transcription handling failed or timed out:', err.message);
      if (this.state === 'COMMAND_ACTIVE') {
        this.deactivateCommandMode();
      }
    } finally {
      this.isProcessing = false;
      this.chip?.unlockQuickInput?.();
    }
  }

  handleStandbySpeech(text) {
    // Strict Wake-Word Enforcement: MUST contain wake word to activate or execute any command
    const WAKE_REGEX = /\b(hey|hi|hello|okay|ok|yo|hê|ê|này|chào|ơi)?\s*(capri|kapri|cabri|copy|cáp ri|ca pri)(?:\s*(ơi|nè|đấy|nào))?\b/i;
    const match = text.match(WAKE_REGEX);
    if (!match) {
      // Speech does not contain wake word - completely ignore to avoid accidental triggers
      return;
    }

    // Inspect what follows the wake word
    const matchEnd = match.index + match[0].length;
    const after = text.slice(matchEnd).trim();
    const wordsAfter = after.split(/\s+/).filter(Boolean);

    // Case A: Wake word + command in single utterance (>= 1 command word following wake word)
    // Example: "Hey Capri take a screenshot", "Capri ơi clip that", "Hey Capri chụp màn hình"
    if (wordsAfter.length >= 1 && !/^(ơi|nè|đấy)$/i.test(wordsAfter[0])) {
      console.log('[voice-input] Strict wake word verified. Executing command:', after);
      this.wakeUpCapri();
      this.executeCommand(after);
      return;
    }

    // Case B: Only called "Hey Capri" or "Capri ơi" -> enter active listening mode
    console.log('[voice-input] Strict wake word invoked, entering COMMAND_ACTIVE mode');
    this.activateCommandMode();
  }

  toggleCommandMode() {
    if (this.state === 'COMMAND_ACTIVE') {
      this.deactivateCommandMode();
    } else {
      this.activateCommandMode();
    }
  }

  activateCommandMode() {
    this.state = 'COMMAND_ACTIVE';
    this.commandActiveStartTime = performance.now();
    this.wakeUpCapri();
    this.voice?.play?.('hello');
    this.capri?.perform?.('hop');

    if (this.fx) {
      const h = this.capri.head();
      this.fx.glyph(h.x, h.y - 20);
      this.fx.burst(h.x, h.y - 15, { count: 8, power: 0.6 });
    }

    // Audio Ducking: temporarily lower player volume to 20% to hear user
    if (this.player) {
      this.savedVolume = this.player.audio.volume;
      this.player.setVolume(Math.min(0.2, this.savedVolume * 0.28));
    }

    this.panel?.setTicker?.({ verb: 'VOICE', target: 'LISTENING...' });
    this.setMicStatus('recording');

    // 7-second timeout: return to STANDBY if user does not speak
    clearTimeout(this.commandTimer);
    this.commandTimer = setTimeout(() => {
      console.log('[voice-input] Command mode 7s timeout reached');
      this.deactivateCommandMode();
    }, 7000);
  }

  deactivateCommandMode() {
    clearTimeout(this.commandTimer);
    this.state = 'STANDBY';
    this.commandActiveStartTime = 0;
    this.chip?.clearStatusBadge();
    this.chip?.setAudioRms?.(0);
    this.chip?.unlockQuickInput?.();

    // Restore music volume
    if (this.player && this.savedVolume !== undefined) {
      this.player.setVolume(this.savedVolume);
    }

    this.panel?.setTicker?.(null);
    this.setMicStatus(this.wakeWordEnabled ? 'idle' : 'off');
  }

  wakeUpCapri() {
    window.dispatchEvent(new CustomEvent('capri:activity'));
    this.selfHeal();
    if (this.onWake) {
      this.onWake();
    } else {
      window.dispatchEvent(new CustomEvent('capri:wake'));
      if (this.chip?.visible) {
        this.chip.wake();
      }
      if (this.capri?.stowed) {
        if (this.host?.setConfig) this.host.setConfig({ visible: true });
        this.capri.unstow();
      }
      if (this.capri?.dormant) this.capri.wake();
    }
  }

  handleCommandSpeech(text) {
    this.deactivateCommandMode();
    // Strip leading "Hey Capri" if user repeated it
    const cleanText = text
      .replace(/^\s*(hey|hi|hello|yo|okay|ok|hê|ê|này|chào|ơi)?\s*(capri|kapri|cabri|copy|cáp ri|ca pri)(?:\s+ơi)?\s*/i, '')
      .trim();

    if (!cleanText) return;
    this.executeCommand(cleanText);
  }

  getUserNick() {
    const custom = (this.brain?.userName || '').trim();
    const nicks = ['partner', 'choom', 'blue'];
    if (custom && custom.toLowerCase() !== 'tèo' && custom.toLowerCase() !== 'partner') {
      return Math.random() < 0.6 ? custom : nicks[Math.floor(Math.random() * nicks.length)];
    }
    return nicks[Math.floor(Math.random() * nicks.length)];
  }

  async executeCommand(rawText) {
    window.dispatchEvent(new CustomEvent('capri:activity'));
    const text = String(rawText || '')
      .trim()
      .replace(/^[,\.\?!]+|[,\.\?!]+$/g, '');

    if (!text) return;

    const lower = text.toLowerCase();

    // 1. Fast media controls
    if (/^(pause|pause music|hold music)$/i.test(lower)) {
      this.player?.pause();
      this.showResponse({ line: `Paused music, ${this.getUserNick()}!`, badge: 'MEDIA', hold: 3000 });
      return;
    }
    if (/^(resume|unpause|play music|continue)$/i.test(lower)) {
      this.player?.play();
      this.showResponse({ line: `Resumed music playback, ${this.getUserNick()}!`, badge: 'MEDIA', hold: 3000 });
      return;
    }
    if (/^(next|skip|next track|next song)$/i.test(lower)) {
      this.player?.next();
      this.host?.discordCommand?.('skip');
      this.showResponse({ line: 'Skipped to next track!', badge: 'MEDIA', hold: 3000 });
      return;
    }
    if (/^(stop|stop music|shut up)$/i.test(lower)) {
      this.player?.stop();
      this.host?.discordCommand?.('stop');
      this.showResponse({ line: 'Music stopped.', badge: 'MEDIA', hold: 3000 });
      return;
    }
    if (/^(leave discord|disconnect discord|exit discord)$/i.test(lower)) {
      this.host?.discordCommand?.('leave');
      this.showResponse({ line: 'Disconnected bot from Discord voice channel!', badge: 'DISCORD', hold: 3000 });
      return;
    }
    if (/^(volume up|louder|turn it up)$/i.test(lower)) {
      const v = this.player?.volumeUp();
      this.showResponse({ line: `Volume raised to ${v}%!`, badge: 'VOLUME', hold: 3000 });
      return;
    }
    if (/^(volume down|quieter|turn it down)$/i.test(lower)) {
      const v = this.player?.volumeDown();
      this.showResponse({ line: `Volume lowered to ${v}%!`, badge: 'VOLUME', hold: 3000 });
      return;
    }
    const volM = /^(?:volume)\s+(\d+)/i.exec(lower);
    if (volM) {
      const val = parseInt(volM[1], 10);
      const v = this.player?.setVolume(val / 100);
      this.showResponse({ line: `Volume set to ${v}%!`, badge: 'VOLUME', hold: 3000 });
      return;
    }

    // 2. Cyberpunk Instant Replay ("Clip That" / "Record That")
    if (/(clip\s+that(\s+shit)?|record\s+that)/i.test(lower)) {
      if (this.replayBuffer) {
        await this.replayBuffer.clip();
        return;
      }
    }

    // 3. Screen Vision AI ("Look at my screen")
    if (/(look at my screen|check screen|explain screen)/i.test(lower)) {
      if (this.chat?.analyzeScreen) {
        await this.chat.analyzeScreen(text);
        return;
      }
    }

    // 4. Sleep & Vanish modes
    if (/^(sleep|go to sleep|hibernate)$/i.test(lower)) {
      this.chip?.hibernate();
      this.showResponse({
        line: `Capri entered 1 FPS standby mode. Call "Hey Capri" to wake me up, ${this.getUserNick()}!`,
        badge: 'SLEEP',
        hold: 4000,
        tts: true
      });
      return;
    }
    if (/^(vanish|hide|disappear)$/i.test(lower)) {
      this.chip?.vanish();
      this.panel?.hide();
      return;
    }

    // 5. Voice Timer & Reminder
    const timerMatch = lower.match(/(?:remind me in|set a timer for|timer)\s+(\d+)\s*(?:minutes|mins?)/i);
    if (timerMatch) {
      const mins = parseInt(timerMatch[1], 10);
      this.timerGuardian?.setTimer(mins, 'Task');
      return;
    }

    // 6. Music, Discord, external apps and conversation via chat handler
    if (this.chat?.handleSpokenCommand) {
      await this.chat.handleSpokenCommand(text);
    } else {
      this.showResponse({ line: `"${text}"`, badge: 'VOICE', hold: 4000, tts: false });
    }
  }

  destroy() {
    this.enabled = false;
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.commandTimer) clearTimeout(this.commandTimer);
    if (this.selfHealTimer) clearInterval(this.selfHealTimer);
    try {
      this.stopRecording();
      if (this.audioSourceNode) {
        try { this.audioSourceNode.disconnect(); } catch {}
        this.audioSourceNode = null;
      }
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((t) => t.stop());
      }
    } catch {}
  }
}
