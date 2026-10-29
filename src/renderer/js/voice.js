// Capri's sounds, synthesized with Web Audio so nothing has to ship with the repo.
// Any file dropped in the custom sounds folder (tray > Son) named after a cue
// (teleport-out.mp3, done.wav, alert.ogg...) replaces the synth for that cue.

import { rand, pick } from './util.js';

// a minor-pentatonic set for the talking blips; three detuned voices = a chorus of minds
const BLIP_NOTES = [62, 65, 67, 69, 72, 74, 77, 79];
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const CUES = ['teleport-out', 'teleport-in', 'done', 'alert', 'error', 'hello', 'blip', 'tick', 'star', 'land', 'rise', 'bolt', 'charge', 'possess', 'shutter'];

export class Voice {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.volume = 0.7;
    this.custom = new Map(); // cue -> AudioBuffer
    this.lastBlip = 0;
    this.ttsEnabled = true;
    this.voiceMode = 'pack'; // 'pack' | 'synth' | 'tts' | 'muted'
    this.voicePackClips = new Map();
    this.vfxVolume = 0.8;
    this.vfxGain = null;
    this.onSpeakingState = null; // (isSpeaking: boolean, volume: number) => void
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.vfxGain = ctx.createGain();
    this.vfxGain.gain.value = (typeof this.vfxVolume === 'number') ? this.vfxVolume : 0.8;
    this.vfxGain.connect(this.master);
    // soft clip so stacked cues never get harsh
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
    }
    shaper.curve = curve;
    this.master.connect(shaper).connect(ctx.destination);
    this.noise = this.makeNoise();
    return ctx;
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (err) {
        console.warn('[capri] voice ctx resume failed:', err);
      }
    }
  }

  setVfxVolume(vol) {
    const v = Math.max(0, Math.min(1, Number(vol)));
    this.vfxVolume = isNaN(v) ? 0.8 : v;
    if (this.vfxGain) {
      this.vfxGain.gain.value = this.vfxVolume;
    }
  }

  configure(cfg = {}) {
    if (typeof cfg.muted === 'boolean') this.muted = cfg.muted;
    if (typeof cfg.volume === 'number') {
      this.volume = cfg.volume;
      if (this.master) this.master.gain.value = cfg.volume;
    }
    if (typeof cfg.vfxVolume === 'number') {
      this.setVfxVolume(cfg.vfxVolume);
    } else if (typeof cfg.voice?.vfxVolume === 'number') {
      this.setVfxVolume(cfg.voice.vfxVolume);
    }
    if (cfg.voice?.ttsEnabled !== undefined) {
      this.ttsEnabled = Boolean(cfg.voice.ttsEnabled);
    } else if (cfg.ttsEnabled !== undefined) {
      this.ttsEnabled = Boolean(cfg.ttsEnabled);
    }
    if (cfg.voice?.voiceMode) {
      this.voiceMode = cfg.voice.voiceMode;
    } else if (cfg.voiceMode) {
      this.voiceMode = cfg.voiceMode;
    }
  }

  async playCapriVoicePack(context = 'auto', { onMouthVolume, onEnd } = {}) {
    if (this.muted || this.voiceMode === 'muted') {
      onEnd?.();
      return;
    }
    try {
      const ctx = this.ensure();
      if (ctx.state === 'suspended') await ctx.resume();

      // Contextual selection: morning / late / miss
      let clipKey = 'miss';
      const hour = new Date().getHours();
      if (context === 'morning' || (context === 'auto' && hour >= 5 && hour < 12)) {
        clipKey = 'morning';
      } else if (context === 'late' || (context === 'auto' && (hour >= 22 || hour < 5))) {
        clipKey = 'late';
      } else {
        clipKey = 'miss';
      }

      let buf = this.voicePackClips.get(clipKey);
      if (!buf) {
        // Original voice pack assets: hello-morning.wav, hello-miss.wav, hello-late.wav
        const clipFileName = { morning: 'hello-morning.wav', miss: 'hello-miss.wav', late: 'hello-late.wav' }[clipKey] || `hello-${clipKey}.wav`;
        const candidates = [
          `../../assets/voice/${clipFileName}`,
          `assets/voice/${clipFileName}`,
          `src/renderer/assets/voice/${clipFileName}`,
        ];
        for (const url of candidates) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const data = await res.arrayBuffer();
              buf = await ctx.decodeAudioData(data);
              this.voicePackClips.set(clipKey, buf);
              break;
            }
          } catch {}
        }
      }

      if (!buf) {
        this.play('hello');
        onEnd?.();
        return;
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;
      // Slight pitch & speed modulation for organic variation
      src.playbackRate.value = 0.97 + Math.random() * 0.08;

      const gain = ctx.createGain();
      gain.gain.value = this.volume;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const dataArr = new Uint8Array(analyser.frequencyBinCount);

      src.connect(gain);
      gain.connect(analyser);
      gain.connect(this.vfxGain || this.master);

      let animId = null;
      const trackMouth = () => {
        analyser.getByteFrequencyData(dataArr);
        let sum = 0;
        for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
        const avg = sum / dataArr.length;
        const norm = Math.min(1, avg / 55);
        onMouthVolume?.(norm);
        this.onSpeakingState?.(true, norm);
        animId = requestAnimationFrame(trackMouth);
      };
      trackMouth();

      src.onended = () => {
        if (animId) cancelAnimationFrame(animId);
        onMouthVolume?.(0);
        this.onSpeakingState?.(false, 0);
        onEnd?.();
      };

      src.start();
    } catch (err) {
      console.warn('[voice] playCapriVoicePack error:', err);
      onEnd?.();
    }
  }

  async loadCustom(list) {
    const ctx = this.ensure();
    this.custom.clear();
    for (const { name, url } of list) {
      if (!CUES.includes(name)) continue;
      try {
        const data = await (await fetch(url)).arrayBuffer();
        this.custom.set(name, await ctx.decodeAudioData(data));
      } catch (err) {
        console.warn('[capri] could not load sound', name, err);
      }
    }
  }

  async playSoundFile(url) {
    if (this.muted) return;
    try {
      const ctx = this.ensure();
      if (ctx.state === 'suspended') await ctx.resume();
      let res;
      try {
        res = await fetch(url);
      } catch {
        res = await fetch(`../../${url}`);
      }
      if (!res || !res.ok) {
        res = await fetch(`../../${url}`);
      }
      const data = await res.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(data);
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      const gain = ctx.createGain();
      gain.gain.value = this.volume;
      src.connect(gain).connect(this.vfxGain || this.master);
      src.start();
    } catch (err) {
      console.warn('[voice] playSoundFile failed:', url, err.message);
    }
  }

  play(cue, opts = {}) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const custom = this.custom.get(cue);
    if (custom) {
      const src = ctx.createBufferSource();
      src.buffer = custom;
      src.connect(this.vfxGain || this.master);
      src.start();
      return;
    }
    const fn = {
      'teleport-out': () => this.zap(false),
      'teleport-in': () => this.zap(true),
      done: () => this.done(),
      alert: () => this.alert(),
      error: () => this.error(),
      hello: () => this.hello(),
      blip: () => this.blip(opts.mood),
      tick: () => this.tick(),
      star: () => this.star(),
      land: () => this.land(),
      rise: () => this.rise(),
      bolt: () => this.bolt(opts.soft),
      charge: () => this.charge(),
      possess: () => this.possess(),
      shutter: () => this.shutter(),
    }[cue];
    fn?.();
  }

  shutter() {
    const ctx = this.ensure();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.07);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(gain).connect(this.vfxGain || this.master);
    osc.start(t);
    osc.stop(t + 0.07);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1800, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(180, t + 0.13);
    gain2.gain.setValueAtTime(0.4, t + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
    osc2.connect(gain2).connect(this.vfxGain || this.master);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.13);
  }

  makeNoise() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  env(gain, t, a, peak, d) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  osc(type, freq, t, dur, peak, dest = (this.vfxGain || this.master)) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    this.env(g, t, 0.004, peak, dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  noiseBurst(t, dur, peak, from, to, q = 2) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = q;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    this.env(g, t, 0.005, peak, dur);
    src.connect(bp).connect(g).connect(this.vfxGain || this.master);
    src.start(t, rand(0, 0.5));
    src.stop(t + dur + 0.05);
  }

  // teleport: saw sweep + filtered noise, upward when leaving, downward when landing
  zap(arriving) {
    const t = this.ctx.currentTime;
    const o = this.osc('sawtooth', arriving ? 1600 : 180, t, 0.22, 0.12);
    o.frequency.exponentialRampToValueAtTime(arriving ? 140 : 2400, t + 0.2);
    this.noiseBurst(t, 0.2, 0.22, arriving ? 6000 : 400, arriving ? 500 : 7000, 3);
    // bit-crushy stutter
    for (let i = 0; i < 4; i++) this.osc('square', rand(800, 3200), t + 0.02 + i * 0.035, 0.02, 0.05);
    if (arriving) this.osc('triangle', 70, t + 0.16, 0.18, 0.3);
  }

  blip(mood = 'talk') {
    const now = performance.now();
    if (now - this.lastBlip < 45) return;
    this.lastBlip = now;
    const t = this.ctx.currentTime;
    const base = pick(BLIP_NOTES) + (mood === 'alert' ? 5 : mood === 'error' ? -7 : 0);
    const f = midi(base);
    this.osc('square', f, t, 0.035, 0.035);
    this.osc('triangle', f * 1.498, t + 0.004, 0.03, 0.025); // a fifth up
    this.osc('square', f * 0.501, t + 0.008, 0.03, 0.018);   // an octave down, slightly off
  }

  tick() {
    const t = this.ctx.currentTime;
    this.noiseBurst(t, 0.03, 0.06, 3000, 9000, 8);
  }

  // red lightning: a buzz under a crackle of tiny bursts (soft: the small hacking sparks)
  bolt(soft = false) {
    const t = this.ctx.currentTime;
    const k = soft ? 0.35 : 1;
    const o = this.osc('sawtooth', 62, t, 0.3 * k + 0.05, 0.08 * k);
    o.frequency.setValueAtTime(58, t + 0.05);
    for (let i = 0; i < (soft ? 3 : 8); i++) {
      this.noiseBurst(t + i * rand(0.02, 0.045), 0.025, 0.14 * k, rand(2500, 6000), rand(4000, 9000), 6);
    }
  }

  // charging up before the red light goes up: a buzz swelling and climbing, crackling more and more
  charge() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(55, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.66);
    o.connect(g).connect(this.vfxGain || this.master);
    o.start(t);
    o.stop(t + 0.7);
    for (let i = 0; i < 6; i++) this.noiseBurst(t + 0.08 + i * 0.09, 0.02, 0.04 + i * 0.016, 3000, 7000, 6);
  }

  // the window she took over laughs with all her voices: three falling chirps, each a detuned
  // chord, over a hiss
  possess() {
    const t = this.ctx.currentTime;
    [79, 76, 72].forEach((n, i) => {
      const at = t + i * 0.11;
      this.osc('square', midi(n), at, 0.07, 0.05);
      this.osc('square', midi(n) * 1.012, at + 0.004, 0.06, 0.035);
      this.osc('triangle', midi(n - 12), at + 0.008, 0.07, 0.04);
    });
    this.noiseBurst(t, 0.3, 0.05, 1200, 5000, 3);
  }

  // the launch into the victory pose: a quick upward whoosh
  rise() {
    const t = this.ctx.currentTime;
    const o = this.osc('sawtooth', 160, t, 0.2, 0.07);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.18);
    this.noiseBurst(t, 0.18, 0.12, 500, 6000, 2);
  }

  // touching down: a soft digital thump
  land() {
    const t = this.ctx.currentTime;
    const o = this.osc('triangle', 150, t, 0.14, 0.22);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    this.noiseBurst(t, 0.06, 0.08, 1800, 400, 1.5);
  }

  // the satellite: two soft, high pings and a shimmer
  star() {
    const t = this.ctx.currentTime;
    this.osc('sine', midi(93), t, 0.9, 0.05);
    this.osc('sine', midi(100), t + 0.14, 1.2, 0.035);
    this.noiseBurst(t + 0.05, 0.6, 0.015, 9000, 12000, 6);
  }

  hello() {
    const t = this.ctx.currentTime;
    [69, 76, 81].forEach((n, i) => this.osc('square', midi(n), t + i * 0.06, 0.07, 0.06));
    this.noiseBurst(t + 0.18, 0.08, 0.06, 2000, 8000, 5);
  }

  // bright arpeggio and a glitchy tail
  done() {
    const t = this.ctx.currentTime;
    [64, 68, 71, 75, 76].forEach((n, i) => {
      this.osc('triangle', midi(n + 12), t + i * 0.07, 0.28, 0.09);
      this.osc('square', midi(n), t + i * 0.07, 0.12, 0.035);
    });
    for (let i = 0; i < 7; i++) this.osc('square', rand(1200, 4200), t + 0.4 + i * 0.03, 0.018, 0.035);
  }

  alert() {
    const t = this.ctx.currentTime;
    for (let r = 0; r < 2; r++) {
      this.osc('square', 988, t + r * 0.28, 0.09, 0.07);
      this.osc('square', 740, t + r * 0.28 + 0.11, 0.11, 0.07);
    }
  }

  error() {
    const t = this.ctx.currentTime;
    const o = this.osc('sawtooth', 110, t, 0.32, 0.14);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.3);
    this.noiseBurst(t, 0.25, 0.15, 900, 200, 1.2);
    for (let i = 0; i < 5; i++) this.noiseBurst(t + 0.05 + i * 0.05, 0.02, 0.12, 4000, 4000, 10);
  }

  /**
   * Cyberpunk Neural Speech Synthesis with Cyber-Capri Timbre Filter & Lip-Sync
   * Speaks the exact input text with female cybernetic cadence (pitch 1.10, highshelf 3500Hz)
   */
  async speakCyberpunk(text, { onMouthVolume, onEnd } = {}) {
    if (!text || this.muted || this.voiceMode === 'muted') {
      onEnd?.();
      return;
    }

    // 1. Capri Voice Pack: only for greetings or when text is empty / greeting flag
    if (this.voiceMode === 'pack') {
      if (!text || text === '__greeting__') {
        await this.playCapriVoicePack('auto', { onMouthVolume, onEnd });
        return;
      }
    }

    // 2. Cyber Glitch Synth fallback if explicitly selected or TTS disabled
    if (this.voiceMode === 'synth' || !this.ttsEnabled) {
      this.play('blip', { mood: 'chat' });
      let count = 0;
      const blipFlap = setInterval(() => {
        count++;
        const vol = count % 2 === 0 ? 0.6 : 0.2;
        onMouthVolume?.(vol);
        this.onSpeakingState?.(true, vol);
        if (count >= 6) {
          clearInterval(blipFlap);
          onMouthVolume?.(0);
          this.onSpeakingState?.(false, 0);
          onEnd?.();
        }
      }, 70);
      return;
    }

    // 2. Neural / System TTS Engine with Cyber-Capri Vocal Filter
    this.onSpeakingState?.(true, 0.3);

    try {
      const ctx = this.ensure();
      if (ctx.state === 'suspended') await ctx.resume();

      const res = await window.host.synthesizeSpeech(text);

      if (res && res.success && res.audioBase64) {
        // Decode base64 MP3 to AudioBuffer
        const binaryStr = atob(res.audioBase64);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const audioBuf = await ctx.decodeAudioData(bytes.buffer);
        const source = ctx.createBufferSource();
        source.buffer = audioBuf;

        // Cyber-Capri Vocal Timbre: Pitch adjustment (1.08 - 1.12)
        source.playbackRate.value = 1.10;

        // High-shelf filter at 3500Hz (+4.5dB) for crisp cyber clarity
        const highShelf = ctx.createBiquadFilter();
        highShelf.type = 'highshelf';
        highShelf.frequency.value = 3500;
        highShelf.gain.value = 4.5;

        // Cybernetic Peaking filter at 2200Hz (+2.0dB)
        const cyberTone = ctx.createBiquadFilter();
        cyberTone.type = 'peaking';
        cyberTone.frequency.value = 2200;
        cyberTone.Q.value = 1.5;
        cyberTone.gain.value = 2.0;

        // Lip-sync Analyser Node
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const dataArr = new Uint8Array(analyser.frequencyBinCount);

        // Robotic subtle comb delay effect
        const dryGain = ctx.createGain();
        dryGain.gain.value = 0.88;

        const delay = ctx.createDelay();
        delay.delayTime.value = 0.024; // 24ms robotic offset

        const wetGain = ctx.createGain();
        wetGain.gain.value = 0.18;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 2400;
        filter.Q.value = 2.2;

        source.connect(analyser);
        source.connect(highShelf).connect(cyberTone);
        cyberTone.connect(dryGain).connect(this.master);
        cyberTone.connect(delay).connect(filter).connect(wetGain).connect(this.master);

        // Real-time lip-sync mouth flapping loop
        let animId = null;
        const trackMouth = () => {
          analyser.getByteFrequencyData(dataArr);
          let sum = 0;
          for (let i = 0; i < dataArr.length; i++) sum += dataArr[i];
          const avg = sum / dataArr.length;
          const norm = Math.min(1, avg / 55);
          onMouthVolume?.(norm);
          this.onSpeakingState?.(true, norm);
          animId = requestAnimationFrame(trackMouth);
        };
        trackMouth();

        source.onended = () => {
          if (animId) cancelAnimationFrame(animId);
          onMouthVolume?.(0);
          this.onSpeakingState?.(false, 0);
          onEnd?.();
        };

        source.start();
        return;
      }

      // Fallback: Web Speech Synthesis API with Female Cyber Timbre
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = 1.05;
        utterance.pitch = 1.15; // Female cyber timbre

        const voices = window.speechSynthesis.getVoices?.() || [];
        const femaleVoice = voices.find((v) =>
          v.lang?.startsWith('en') &&
          (v.name.includes('Zira') || v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Natural') || v.name.includes('Ava') || v.name.includes('Jenny') || v.name.includes('Hazel'))
        ) || voices.find((v) => v.lang?.startsWith('en')) || null;
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }

        let mouthInterval = setInterval(() => {
          const v = Math.random() > 0.4 ? 0.65 : 0.25;
          onMouthVolume?.(v);
          this.onSpeakingState?.(true, v);
        }, 110);

        utterance.onend = () => {
          clearInterval(mouthInterval);
          onMouthVolume?.(0);
          this.onSpeakingState?.(false, 0);
          onEnd?.();
        };
        utterance.onerror = () => {
          clearInterval(mouthInterval);
          onMouthVolume?.(0);
          this.onSpeakingState?.(false, 0);
          onEnd?.();
        };

        window.speechSynthesis.speak(utterance);
      } else {
        this.onSpeakingState?.(false, 0);
        onEnd?.();
      }
    } catch (err) {
      console.warn('[voice] speakCyberpunk error:', err);
      this.onSpeakingState?.(false, 0);
      onEnd?.();
    }
  }
}
