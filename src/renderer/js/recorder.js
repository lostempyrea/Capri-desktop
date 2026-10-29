// Capri Screen Recorder Engine
// Captures 60 FPS desktop screen with Windows WASAPI Loopback System Audio,
// and exports standard MP4 (H.264 + AAC) using FFmpeg in Main Process.

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${pad(m)}:${pad(s)}`;
}

export class ScreenRecorder {
  constructor({ host, panel, voice, fx, capri }) {
    this.host = host;
    this.panel = panel;
    this.voice = voice;
    this.fx = fx;
    this.capri = capri;

    this.isRecording = false;
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.timer = null;
    this.startTime = 0;
    this.chosenMime = '';
  }

  async start() {
    if (this.isRecording) {
      return { ok: false, message: 'Screen recording is already in progress, choom!' };
    }

    try {
      window.dispatchEvent(new CustomEvent('capri:activity'));

      let stream = null;

      // 1. Primary method: getDisplayMedia with System Audio (Windows WASAPI loopback)
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 60 } },
          audio: true,
        });
        console.log('[recorder] Captured via getDisplayMedia with audio tracks:', stream.getAudioTracks().length);
      } catch (dispErr) {
        console.warn('[recorder] getDisplayMedia fallback to getUserMedia:', dispErr.message);
      }

      // 2. Fallback method: getUserMedia with desktop source
      if (!stream) {
        const sources = await this.host.getScreenSources();
        const sourceId = sources?.[0]?.id || 'screen:0:0';

        stream = await navigator.mediaDevices.getUserMedia({
          audio: false, // Avoid passing chromeMediaSourceId to audio on Windows
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sourceId,
              maxFrameRate: 60,
            },
          },
        });
      }

      this.mediaStream = stream;
      this.recordedChunks = [];

      // Prioritize H.264 codecs for fast MP4 remuxing
      const candidates = [
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4;codecs=avc1,opus',
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      this.chosenMime = candidates.find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const options = {
        videoBitsPerSecond: 8000000,
      };
      if (this.chosenMime) {
        options.mimeType = this.chosenMime;
      }

      this.mediaRecorder = new MediaRecorder(stream, options);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(250);
      this.isRecording = true;
      this.startTime = Date.now();

      this.voice?.play?.('blip');
      this.capri?.perform?.('hop');

      // Ticker updates elapsed time every second
      this.timer = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
        this.panel?.setTicker?.({
          verb: 'REC',
          target: formatDuration(elapsedSec),
        });
      }, 1000);

      this.panel?.setTicker?.({ verb: 'REC', target: '00:00' });
      this.panel?.say?.({
        kind: 'info',
        badge: 'REC',
        line: 'Screen recording started (60 FPS + Audio)! Say "Stop recording" or click button to finish.',
        actions: [{ id: 'stop', label: 'Stop Recording', primary: true }],
        onAction: (id) => {
          if (id === 'stop') this.stop();
        },
        hold: 5000,
      });

      return { ok: true };
    } catch (err) {
      console.error('[recorder] Start recording failed:', err);
      this.isRecording = false;
      return { ok: false, error: err.message };
    }
  }

  async stop() {
    if (!this.isRecording) {
      return { ok: false, message: 'No screen recording is currently active.' };
    }

    this.isRecording = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    // Show saving status on ticker
    this.panel?.setTicker?.({ verb: 'SAVING', target: 'MP4 EXPORT...' });

    return new Promise((resolve) => {
      const finalize = async () => {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((t) => t.stop());
          this.mediaStream = null;
        }

        if (this.recordedChunks.length === 0) {
          this.panel?.setTicker?.(null);
          this.panel?.say?.({
            kind: 'error',
            badge: 'REC',
            line: 'Recording too short or no video frames captured!',
            hold: 4000,
          });
          resolve({ ok: false, error: 'No data recorded' });
          return;
        }

        try {
          const mime = this.chosenMime || 'video/webm';
          const blob = new Blob(this.recordedChunks, { type: mime });
          this.recordedChunks = [];
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          const res = await this.host.saveScreenRecording(bytes, mime);
          this.panel?.setTicker?.(null);

          if (res?.ok) {
            this.voice?.play?.('done');
            this.capri?.perform?.('hop');
            this.panel?.say?.({
              kind: 'done',
              badge: 'REC',
              line: `High-quality MP4 video exported: ${res.fileName}!`,
              actions: [
                { id: 'play', label: 'Open Video', primary: true },
                { id: 'folder', label: 'Open Folder' },
                { id: 'ok', label: 'Close' },
              ],
              onAction: (id) => {
                if (id === 'play') this.host.openFolder(res.filePath);
                else if (id === 'folder') this.host.openFolder(res.dirPath);
                this.panel.hide();
              },
              hold: 14000,
            });
            resolve({ ok: true, res });
          } else {
            this.panel?.say?.({
              kind: 'error',
              badge: 'REC',
              line: `Error saving MP4 video: ${res?.error || 'Unknown error'}`,
              hold: 6000,
            });
            resolve({ ok: false, error: res?.error });
          }
        } catch (err) {
          console.error('[recorder] Finalize failed:', err);
          this.panel?.setTicker?.(null);
          resolve({ ok: false, error: err.message });
        }
      };

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = finalize;
        this.mediaRecorder.stop();
      } else {
        finalize();
      }
    });
  }
}
