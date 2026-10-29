// Capri Instant Replay Rolling Ring-Buffer Engine
// Continuous in-memory circular buffer (30s/60s), zero SSD wear.
// Muxes to MP4 on "Clip that" or Alt+F10.

export class InstantReplayBuffer {
  constructor({ host, panel, voice, fx, capri }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.fx = fx;
    this.capri = capri;

    this.active = false;
    this.bufferSeconds = 30; // 15, 30, 60, 90
    this.maxBytes = 120 * 1024 * 1024; // 120 MB RAM safety cap
    this.ringBuffer = []; // [{ blob, time, size }]
    this.currentBytes = 0;
    this.stream = null;
    this.mediaRecorder = null;
    this.chosenMime = '';
    this.isClipping = false;
    this.onCutin = null; // callback to trigger anime speedlines celebration
  }

  async start(seconds = 30) {
    if (this.active) return true;
    this.bufferSeconds = seconds;

    try {
      console.log(`[replay-buffer] Initializing rolling ring-buffer (${this.bufferSeconds}s)...`);
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
          setTimeout(() => this.start(this.bufferSeconds), 2000);
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

      const options = {
        videoBitsPerSecond: 8000000,
        mimeType: this.chosenMime,
      };

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.initChunk = null;
      this.ringBuffer = [];
      this.currentBytes = 0;

      this.mediaRecorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        const now = performance.now();
        if (!this.initChunk) {
          this.initChunk = e.data;
        }
        const chunk = { blob: e.data, time: now, size: e.data.size };

        this.ringBuffer.push(chunk);
        this.currentBytes += chunk.size;

        // Prune chunks older than bufferSeconds
        const cutoff = now - (this.bufferSeconds * 1000);
        while (this.ringBuffer.length > 0 && this.ringBuffer[0].time < cutoff) {
          const dropped = this.ringBuffer.shift();
          this.currentBytes -= dropped.size;
        }

        // Hard RAM safety cap (120 MB)
        while (this.currentBytes > this.maxBytes && this.ringBuffer.length > 5) {
          const dropped = this.ringBuffer.shift();
          this.currentBytes -= dropped.size;
        }
      };

      this.mediaRecorder.start(1000); // 1-second segments
      this.active = true;
      console.log('[replay-buffer] Rolling buffer active.');
      return true;
    } catch (err) {
      console.warn('[replay-buffer] Could not start instant replay buffer:', err.message);
      this.active = false;
      return false;
    }
  }

  stop() {
    this.active = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this.ringBuffer = [];
    this.currentBytes = 0;
  }

  /**
   * "Clip That" / "Clip That Shit" triggered!
   */
  async clip() {
    if (this.isClipping) return { ok: false, error: 'Đang xử lý clip khác.' };
    this.isClipping = true;

    try {
      this.voice.play('star');

      // If buffer is empty or not started, start and record 3s on the fly
      if (!this.active || this.ringBuffer.length === 0) {
        this.panel?.setTicker?.({ verb: 'RECORDING', target: 'Đang ghi lại clip 3s...' });
        const started = await this.start(this.bufferSeconds);
        if (!started) {
          this.isClipping = false;
          return { ok: false, error: 'Không thể truy cập màn hình để clip.' };
        }
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Request latest chunk from MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        try { this.mediaRecorder.requestData(); } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }

      if (this.ringBuffer.length === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        try { this.mediaRecorder?.requestData(); } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }

      if (this.ringBuffer.length === 0) {
        this.isClipping = false;
        return { ok: false, error: 'Chưa có đủ dữ liệu trong bộ đệm.' };
      }

      // Extract blobs: preserve initSegment container header
      const blobs = [];
      if (this.initChunk && (this.ringBuffer.length === 0 || this.ringBuffer[0].blob !== this.initChunk)) {
        blobs.push(this.initChunk);
      }
      blobs.push(...this.ringBuffer.map((c) => c.blob));
      const combinedBlob = new Blob(blobs, { type: this.chosenMime });
      const arrayBuffer = await combinedBlob.arrayBuffer();

      console.log(`[replay-buffer] Sending ${arrayBuffer.byteLength} bytes to ffmpeg remux...`);

      // Trigger Anime Cut-in celebration
      if (this.onCutin) {
        this.onCutin();
      }

      // Save to MP4 via host
      const res = await this.host.saveInstantReplay(arrayBuffer, this.chosenMime);

      if (res.ok) {
        this.voice.play('done');
        this.capri.perform?.('cheer');

        // Show celebration transmission panel
        this.panel.say({
          kind: 'done',
          face: 'smug',
          badge: 'CLIP CAPTURED',
          line: `ĐÃ LƯU PHA HIGHLIGHT VỪA RỒI! (${this.bufferSeconds}s)`,
          summary: `Đã đóng gói siêu tốc sang MP4: ${res.fileName}`,
          actions: [
            { id: 'watch', label: 'Xem ngay', primary: true },
            { id: 'discord', label: 'Gửi lên Discord' },
            { id: 'folder', label: 'Mở thư mục' }
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
        throw new Error(res.error || 'FFmpeg đóng gói thất bại');
      }
    } catch (err) {
      console.error('[replay-buffer] Clip failed:', err);
      this.voice.play('error');
      this.panel.say({
        kind: 'error',
        face: 'laugh',
        badge: 'REPLAY ERROR',
        line: `Không thể lưu clip: ${err.message}`,
        hold: 4000
      });
      return { ok: false, error: err.message };
    } finally {
      this.isClipping = false;
    }
  }
}
