// In-App Music Player for Capri: plays local audio tracks (.mp3, .wav, .ogg, .flac, .m4a),
// online YouTube streams, and 24/7 Cyberpunk Radio streams directly within the Capri application.

import { pick } from './util.js';

export const RADIO_STATIONS = [
  { id: 'plaza', title: 'Nightwave Plaza [Vaporwave / Cyberpunk 24/7]', url: 'https://radio.plaza.one/mp3' },
  { id: 'defcon', title: 'SomaFM DEF CON Radio [Hacker Synth Cyberpunk]', url: 'https://ice2.somafm.com/defcon-128-mp3' },
  { id: 'groovesalad', title: 'SomaFM Groove Salad [Chill Ambient Lofi]', url: 'https://ice4.somafm.com/groovesalad-128-mp3' },
];

export class Player {
  constructor({ host, capri, panel, voice, brain, fx }) {
    this.host = host;
    this.capri = capri;
    this.panel = panel;
    this.voice = voice;
    this.brain = brain;
    this.fx = fx;

    // Connect player instance with panel
    if (this.panel?.bindPlayer) {
      this.panel.bindPlayer(this);
    }

    this.audio = new Audio();
    this.audio.preload = 'auto';

    // Restore saved volume from localStorage
    let savedVol = 0.7;
    try {
      const stored = localStorage.getItem('capri:music:volume');
      if (stored !== null) savedVol = Math.max(0, Math.min(1, parseFloat(stored)));
    } catch {}
    this.audio.volume = savedVol;
    this.panel?.updateMusicVolume?.(savedVol);

    this.localTracks = [];
    this.currentIndex = -1;
    this.isRadio = false;
    this.isOnline = false;
    this.onlineTrack = null;
    this.currentStation = 0;
    this.playing = false;
    this.shuffle = false;
    this.history = [];
    this.queue = [];
    this.pulseTimer = null;
    this.isEnding = false;

    // --- HTML5 Audio Event Listeners ---
    this.audio.addEventListener('timeupdate', () => {
      const ct = this.audio.currentTime || 0;
      const dur = this.audio.duration || 0;
      const pct = dur > 0 ? (ct / dur) * 100 : 0;

      this.panel?.updateMusicProgress?.({
        currentTime: ct,
        duration: dur,
        percent: pct,
        title: this.currentTitle(),
      });

      // Watchdog check for stream / track ending (near end of duration)
      if (!this.isRadio && dur > 3 && ct >= dur - 0.45) {
        this.onEnded();
      }
    });

    this.audio.addEventListener('ended', () => {
      this.onEnded();
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('[capri:player] audio playback error:', e);
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        this.playOnline(next);
      } else {
        this.stop();
      }
    });

    this.audio.addEventListener('waiting', () => {
      if (this.playing && !this.isRadio) {
        this.panel?.setTicker?.({ verb: '⏳ BUFFERING', target: this.currentTitle() });
      }
    });

    this.audio.addEventListener('playing', () => {
      this.playing = true;
      this.startPulse();
      this.startBeatTracker();
      this.panel?.updateMusicPlaying?.(true);
      this.syncState();
    });

    this.audio.addEventListener('pause', () => {
      this.playing = false;
      this.stopPulse();
      this.stopBeatTracker();
      this.panel?.updateMusicPlaying?.(false);
      this.syncState();
    });

    // Listen to commands from host (Tray menu, Discord bot, IPC)
    if (this.host.onMusicCommand) {
      this.host.onMusicCommand((cmd) => this.handleCommand(cmd));
    }
    if (this.host.onMusicStopped) {
      this.host.onMusicStopped(() => this.stop());
    }

    this.refreshTracks();
  }

  onEnded() {
    if (this.isEnding) return;
    this.isEnding = true;
    setTimeout(() => {
      this.isEnding = false;
    }, 800);

    // If tracks are waiting in queue, play next
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.playOnline(next);
      return;
    }

    // If local tracks playlist has more tracks, cycle
    if (!this.isOnline && !this.isRadio && this.localTracks.length > 1) {
      this.next();
      return;
    }

    // Otherwise, finished completely: stop, clear ticker, reset UI to IDLE
    this.stop();
  }

  async refreshTracks() {
    try {
      this.localTracks = (await this.host.listMusic()) || [];
      if (this.currentIndex < 0 && this.localTracks.length > 0) {
        this.currentIndex = 0;
      }
      this.syncState();
      return this.localTracks;
    } catch {
      this.localTracks = [];
      return [];
    }
  }

  async play(indexOrId) {
    await this.refreshTracks();

    if (typeof indexOrId === 'number' && indexOrId >= 0 && indexOrId < this.localTracks.length) {
      return this.loadTrack(indexOrId);
    }
    if (typeof indexOrId === 'string' && indexOrId.startsWith('radio:')) {
      const idx = RADIO_STATIONS.findIndex((s) => s.id === indexOrId.slice(6));
      return this.playRadio(idx >= 0 ? idx : 0);
    }

    // If currently paused and has a source, simply resume
    if (this.audio.src && !this.playing) {
      try {
        await this.audio.play();
        this.announce(this.currentTitle());
        return this.currentTitle();
      } catch (err) {
        console.warn('[player] resume failed, falling back:', err);
      }
    }

    // If local tracks available, start local playback
    if (this.localTracks.length > 0) {
      const idx = this.currentIndex >= 0 ? this.currentIndex : 0;
      return this.loadTrack(idx);
    }

    // Otherwise, play Cyberpunk Radio
    return this.playRadio(this.currentStation);
  }

  // Play an online stream from YouTube / SoundCloud
  async playOnline(trackOrQuery) {
    const queryStr = typeof trackOrQuery === 'object' ? trackOrQuery.title : String(trackOrQuery || '').trim();
    // Immediate visual feedback on ticker
    this.panel?.setTicker?.({ verb: '⏳ LOADING', target: queryStr || 'YouTube Audio' });

    let track = null;
    try {
      if (typeof trackOrQuery === 'object' && trackOrQuery?.streamUrl) {
        track = trackOrQuery;
      } else {
        track = await this.host.musicResolve(queryStr);
      }
    } catch (err) {
      console.warn('[player] musicResolve error:', err);
      this.panel?.setTicker?.(null);
      return null;
    }

    if (!track) {
      this.panel?.setTicker?.(null);
      return null;
    }

    this.isRadio = false;
    this.isOnline = true;
    this.onlineTrack = track;
    this.audio.src = track.streamUrl;

    try {
      await this.audio.play();
      this.announce(track.title);
      this.syncState();
      return track.title;
    } catch (err) {
      console.warn('[player] failed to play online track:', err);
      this.panel?.setTicker?.(null);
      return null;
    }
  }

  addToQueue(track) {
    this.queue.push(track);
  }

  seek(percent) {
    if (this.audio.duration && !this.isRadio) {
      const targetTime = (percent / 100) * this.audio.duration;
      this.audio.currentTime = targetTime;
    }
  }

  pause() {
    this.audio.pause();
    this.panel?.setTicker?.(null);
    this.syncState();
  }

  stop() {
    this.playing = false;
    try {
      this.audio.pause();
      this.audio.currentTime = 0;
    } catch {}
    this.isOnline = false;
    this.onlineTrack = null;
    this.stopPulse();
    this.panel?.setTicker?.(null);
    this.panel?.setMusicIdle?.();
    this.capri?.setMode?.('idle');
    this.syncState();
  }

  toggle() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }

  next() {
    if (this.isRadio) {
      return this.cycleRadio();
    }

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      return this.playOnline(next);
    }

    if (this.isOnline) {
      return this.stop();
    }

    if (this.localTracks.length === 0) {
      return this.playRadio(0);
    }

    if (this.localTracks.length === 1) {
      this.audio.currentTime = 0;
      this.audio.play();
      return this.currentTitle();
    }

    let nextIdx;
    if (this.shuffle) {
      do {
        nextIdx = Math.floor(Math.random() * this.localTracks.length);
      } while (nextIdx === this.currentIndex && this.localTracks.length > 1);
    } else {
      nextIdx = (this.currentIndex + 1) % this.localTracks.length;
    }

    if (this.currentIndex >= 0) this.history.push(this.currentIndex);
    return this.loadTrack(nextIdx);
  }

  prev() {
    if (this.isRadio) {
      const prevStation = (this.currentStation - 1 + RADIO_STATIONS.length) % RADIO_STATIONS.length;
      return this.playRadio(prevStation);
    }

    if (this.localTracks.length === 0) {
      return this.playRadio(0);
    }

    let prevIdx;
    if (this.history.length > 0) {
      prevIdx = this.history.pop();
    } else {
      prevIdx = (this.currentIndex - 1 + this.localTracks.length) % this.localTracks.length;
    }
    return this.loadTrack(prevIdx);
  }

  async loadTrack(index) {
    if (index < 0 || index >= this.localTracks.length) return null;
    this.isRadio = false;
    this.isOnline = false;
    this.onlineTrack = null;
    this.currentIndex = index;
    const track = this.localTracks[index];

    try {
      this.audio.src = track.url;
      await this.audio.play();
      this.announce(track.title);
      this.syncState();
      return track.title;
    } catch (err) {
      console.warn('[player] could not play track:', track, err);
      return null;
    }
  }

  async playRadio(index = 0) {
    this.isRadio = true;
    this.isOnline = false;
    this.onlineTrack = null;
    this.currentStation = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
    const station = RADIO_STATIONS[this.currentStation];

    try {
      this.audio.src = station.url;
      await this.audio.play();
      this.announce(station.title);
      this.syncState();
      return station.title;
    } catch (err) {
      console.warn('[player] could not connect to radio:', station, err);
      return null;
    }
  }

  cycleRadio() {
    return this.playRadio(this.currentStation + 1);
  }

  setVolume(vol) {
    const v = Math.max(0, Math.min(1, vol));
    this.audio.volume = v;
    try {
      localStorage.setItem('capri:music:volume', String(v));
    } catch {}
    this.panel?.updateMusicVolume?.(v);
    this.syncState();
    return Math.round(v * 100);
  }

  volumeUp() {
    return this.setVolume(this.audio.volume + 0.15);
  }

  volumeDown() {
    return this.setVolume(this.audio.volume - 0.15);
  }

  currentTitle() {
    if (this.isOnline && this.onlineTrack) {
      return this.onlineTrack.title;
    }
    if (this.isRadio) {
      return RADIO_STATIONS[this.currentStation]?.title || 'Cyberpunk Radio';
    }
    if (this.currentIndex >= 0 && this.localTracks[this.currentIndex]) {
      return this.localTracks[this.currentIndex].title;
    }
    return this.brain.lang === 'vi' ? 'Chưa chọn bài' : 'No track selected';
  }

  statusText() {
    const isVi = this.brain.lang === 'vi';
    const vol = Math.round(this.audio.volume * 100);
    const state = this.playing ? (isVi ? 'Đang phát' : 'Playing') : (isVi ? 'Tạm dừng' : 'Paused');
    let source = '';
    if (this.isOnline) source = isVi ? 'Luồng YouTube' : 'YouTube Stream';
    else if (this.isRadio) source = isVi ? 'Đài Radio' : 'Radio';
    else source = `${this.localTracks.length} ${isVi ? 'bài trong máy' : 'local tracks'}`;

    return `[${state}] ${this.currentTitle()} (Âm lượng: ${vol}%, ${source})`;
  }

  announce(title) {
    this.capri.pulse();
    if (this.fx) {
      const h = this.capri.head();
      this.fx.glyph(h.x, h.y - 20);
      this.fx.burst(h.x, h.y - 15, { count: 6, power: 0.5 });
    }
    this.panel?.setTicker?.({ verb: 'PLAYING', target: title });
  }

  startPulse() {
    this.stopPulse();
    this.panel?.setTicker?.({ verb: 'PLAYING', target: this.currentTitle() });
    this.pulseTimer = setInterval(() => {
      if (this.playing && !this.capri.acting && !this.panel?.visible) {
        if (Math.random() < 0.5) {
          this.capri.pulse();
          if (this.fx) {
            const h = this.capri.head();
            this.fx.glyph(h.x, h.y - 25);
          }
        } else if (Math.random() < 0.25) {
          this.capri.perform('hop');
        }
      }
    }, 12000);
  }

  stopPulse() {
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    this.panel?.setTicker?.(null);
  }

  setupBeatAnalyser() {
    if (this.analyser) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx) this.audioCtx = new AudioCtx();
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (err) {
      console.warn('[player] Web Audio Analyser setup:', err.message);
    }
  }

  startBeatTracker() {
    this.stopBeatTracker();
    this.setupBeatAnalyser();
    if (!this.analyser) return;
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    let lastBeat = 0;
    const loop = () => {
      if (!this.playing) {
        this.stopBeatTracker();
        return;
      }

      this.analyser.getByteFrequencyData(this.freqData);
      const bassEnergy = (this.freqData[1] + this.freqData[2] + this.freqData[3]) / 3;
      const now = performance.now();

      if (bassEnergy > 160 && now - lastBeat > 320) {
        lastBeat = now;
        if (!this.capri.busy && !this.capri.dragging) {
          const act = this.capri.stance === 'sit' ? 'perch_dance' : 'dance';
          this.capri.perform?.(act);
        }
      }

      this.beatAnimId = requestAnimationFrame(loop);
    };

    this.beatAnimId = requestAnimationFrame(loop);
  }

  stopBeatTracker() {
    if (this.beatAnimId) {
      cancelAnimationFrame(this.beatAnimId);
      this.beatAnimId = null;
    }
    if (this.capri && !this.capri.busy && !this.capri.dragging) {
      this.capri.endAct?.(false);
    }
  }

  syncState() {
    if (!this.host.sendMusicState) return;
    this.host.sendMusicState({
      playing: this.playing,
      title: this.currentTitle(),
      isRadio: this.isRadio,
      isOnline: this.isOnline,
      station: this.currentStation,
      volume: Math.round(this.audio.volume * 100),
      shuffle: this.shuffle,
      tracks: this.localTracks.map((t, i) => ({ id: t.id, title: t.title, index: i })),
    });
  }

  handleCommand(cmd) {
    switch (cmd.action) {
      case 'play':
        this.play();
        break;
      case 'playOnline':
        this.playOnline(cmd.track || cmd.query);
        break;
      case 'pause':
        this.pause();
        break;
      case 'stop':
      case 'stopped':
        this.stop();
        break;
      case 'toggle':
        this.toggle();
        break;
      case 'next':
      case 'skip':
        this.next();
        break;
      case 'prev':
        this.prev();
        break;
      case 'track':
        this.loadTrack(cmd.index);
        break;
      case 'radio':
        this.playRadio(cmd.index);
        break;
      case 'volume':
        this.setVolume(cmd.value);
        break;
      case 'shuffle':
        this.shuffle = !this.shuffle;
        this.syncState();
        break;
      case 'openFolder':
        this.host.openMusicFolder();
        break;
      case 'refresh':
        this.refreshTracks();
        break;
      default:
        break;
    }
  }
}
