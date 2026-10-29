// Capri Instant Replay Rolling Ring-Buffer Engine
// Rotating 15-second independent self-contained WebM segments, zero SSD wear.
// Muxes & concatenates to MP4 on "Clip that" or Alt+F10.

export class InstantReplayBuffer {
  constructor({ host, panel, voice, fx, capri }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.fx = fx;
    this.capri = capri;

    this.active = false;
    this.segmentDurationSec = 15; // 15s per segment
    this.maxSegments = 3; // Keep last 3 completed segments (~45s)
    this.completedSegments = []; // Array of complete standalone WebM Blobs
    this.currentChunks = [];
    this.stream = null;
    this.mediaRecorder = null;
    this.rotateTimer = null;
    this.chosenMime = '';
    this.isClipping = false;
    this.onCutin = null; // callback to trigger anime speedlines celebration
  }

  async start(seconds = 30) {
    if (this.active) return true;
    this.maxSegments = Math.max(2, Math.ceil(seconds / 15));

    try {
      console.log(`[replay-buffer] Initializing segmented rolling buffer (keeping last ${this.maxSegments} x 15s segments)...`);
      let stream = null;

      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 60 } },
          audio: true,
        });
      } catch (e) {
        console.warn('[replay-buffer] getDisplayMedia fallback to desktop source:', e.message);
      }

      if (!stream) {
        const sources = await this.host.getScreenSources();
        const sourceId = sources?.[0]?.id || 'screen:0:0';
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxFrameRate: 60,
            },
          },
        });
      }

      this.stream = stream;

      // Handle track interruption watchdog
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.warn('[replay-buffer] Display track ended, restarting buffer...');
          this.active = false;
          setTimeout(() => this.start(seconds), 2000);
        };
      }

      const candidates = [
        'video/webm;codecs=h264,opus',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      this.chosenMime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm';

      this.completedSegments = [];
      this.active = true;
      this.startSegment();
      console.log('[replay-buffer] Rolling segmented buffer active.');
      return true;
    } catch (err) {
      console.warn('[replay-buffer] Could not start instant replay buffer:', err.message);
      this.active = false;
      return false;
    }
  }

  startSegment() {
    if (!this.active || !this.stream) return;
    if (this.rotateTimer) {
      clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }

    try {
      this.currentChunks = [];
      const options = {
        videoBitsPerSecond: 8000000,
        mimeType: this.chosenMime,
      };

      const recorder = new MediaRecorder(this.stream, options);
      this.mediaRecorder = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.currentChunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (this.currentChunks.length > 0) {
          const segBlob = new Blob(this.currentChunks, { type: this.chosenMime });
          if (segBlob.size > 1000) {
            this.completedSegments.push(segBlob);
            while (this.completedSegments.length > this.maxSegments) {
              this.completedSegments.shift();
            }
          }
        }
        this.currentChunks = [];
      };

      recorder.start(1000);

      this.rotateTimer = setTimeout(() => {
        if (this.active && !this.isClipping) {
          this.rotateSegment();
        }
      }, this.segmentDurationSec * 1000);
    } catch (e) {
      console.warn('[replay-buffer] startSegment error:', e);
    }
  }

  rotateSegment() {
    if (!this.active || !this.mediaRecorder) return;
    try {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
    } catch {}
    this.startSegment();
  }

  stop() {
    this.active = false;
    if (this.rotateTimer) {
      clearTimeout(this.rotateTimer);
      this.rotateTimer = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.completedSegments = [];
    this.currentChunks = [];
  }

  /**
   * "Clip That" / "Clip That Shit" triggered!
   */
  async clip() {
    if (this.isClipping) return { ok: false, error: 'Already processing another clip.' };
    this.isClipping = true;

    try {
      this.voice.play('star');

      // If buffer is empty or not started, start and record 3s on the fly
      if (!this.active || (this.completedSegments.length === 0 && this.currentChunks.length === 0)) {
        this.panel?.setTicker?.({ verb: 'RECORDING', target: 'Recording 3s clip...' });
        const started = await this.start(30);
        if (!started) {
          this.isClipping = false;
          return { ok: false, error: 'Cannot access display for instant replay.' };
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Finalize current segment to capture the most recent seconds
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        await new Promise((resolve) => {
          this.mediaRecorder.onstop = () => {
            if (this.currentChunks.length > 0) {
              const segBlob = new Blob(this.currentChunks, { type: this.chosenMime });
              if (segBlob.size > 1000) {
                this.completedSegments.push(segBlob);
                while (this.completedSegments.length > this.maxSegments) {
                  this.completedSegments.shift();
                }
              }
            }
            this.currentChunks = [];
            resolve();
          };
          try {
            this.mediaRecorder.stop();
          } catch {
            resolve();
          }
        });
      }

      if (this.completedSegments.length === 0) {
        this.isClipping = false;
        return { ok: false, error: 'Insufficient data in replay buffer.' };
      }

      console.log(`[replay-buffer] Sending ${this.completedSegments.length} segment(s) to ffmpeg concat remux...`);

      // Trigger Anime Cut-in celebration
      if (this.onCutin) {
        this.onCutin();
      }

      // Convert all segment blobs to ArrayBuffers
      const segmentBuffers = await Promise.all(this.completedSegments.map((b) => b.arrayBuffer()));

      // Save to MP4 via host
      const res = await this.host.saveInstantReplay(segmentBuffers, this.chosenMime);

      // Restart recording rotation immediately
      this.startSegment();

      if (res.ok) {
        this.voice.play('done');
        this.capri.perform?.('cheer');

        // Show celebration transmission panel
        this.panel.say({
          kind: 'done',
          face: 'smug',
          badge: 'CLIP CAPTURED',
          line: `SAVED HIGHLIGHT REPLAY CLIP! (${this.completedSegments.length * 15}s)`,
          summary: `Ultra-fast remux to MP4 complete: ${res.fileName}`,
          actions: [
            { id: 'watch', label: 'Watch Now', primary: true },
            { id: 'discord', label: 'Send to Discord' },
            { id: 'folder', label: 'Open Folder' }
          ],
          onAction: (id) => {
            if (id === 'watch') this.host.openReplayFile(res.filePath);
            else if (id === 'discord') this.host.shareReplayDiscord(res.filePath);
            else if (id === 'folder') this.host.openFolder(res.dirPath);
            this.panel.hide();
          },
          hold: 12000
        });

        return { ok: true, filePath: res.filePath };
      } else {
        throw new Error(res.error || 'FFmpeg remux failed');
      }
    } catch (err) {
      console.error('[replay-buffer] Clip failed:', err);
      this.voice.play('error');
      this.panel.say({
        kind: 'error',
        face: 'laugh',
        badge: 'REPLAY ERROR',
        line: `Could not save replay clip: ${err.message}`,
        hold: 4000
      });
      return { ok: false, error: err.message };
    } finally {
      this.isClipping = false;
    }
  }
}
