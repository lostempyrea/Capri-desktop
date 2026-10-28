'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { app, desktopCapturer, clipboard, nativeImage, shell } = require('electron');
const rawFfmpegPath = require('ffmpeg-static');
const ffmpegPath = rawFfmpegPath ? rawFfmpegPath.replace('app.asar', 'app.asar.unpacked') : 'ffmpeg';
const configStore = require('./config-store');

function pad(n) {
  return String(n).padStart(2, '0');
}

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function getScreenshotsDir() {
  const picturesDir = app.getPath('pictures') || path.join(app.getPath('home'), 'Pictures');
  const dir = path.join(picturesDir, 'Capri_Screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getRecordingsDir() {
  const videosDir = app.getPath('videos') || path.join(app.getPath('home'), 'Videos');
  const dir = path.join(videosDir, 'Capri_Recordings');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getReplaysDir() {
  const config = configStore.load();
  const dir = config.system.replayDir || path.join(app.getPath('videos') || path.join(app.getPath('home'), 'Videos'), 'Capri_Clips');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function powershell(script) {
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${script}`,
    ], { windowsHide: true, timeout: 15000 }, (err, out) => (err ? reject(err) : resolve(out.trim())));
  });
}

/**
 * Capture full desktop screen, save PNG, copy to clipboard
 */
async function takeScreenshot({ overlay = null, hideOverlay = true } = {}) {
  const dir = getScreenshotsDir();
  const fileName = `Screenshot_${timestamp()}.png`;
  const filePath = path.join(dir, fileName);

  const wasVisible = overlay && !overlay.isDestroyed() && overlay.isVisible();
  if (wasVisible && hideOverlay) {
    overlay.hide();
    await new Promise((r) => setTimeout(r, 120));
  }

  try {
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save("${filePath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
Write-Output "OK"
`;
    await powershell(psScript);

    if (fs.existsSync(filePath)) {
      const img = nativeImage.createFromPath(filePath);
      if (!img.isEmpty()) {
        clipboard.writeImage(img);
      }
      return { ok: true, filePath, dirPath: dir, fileName };
    } else {
      throw new Error('Screenshot file was not created');
    }
  } catch (err) {
    console.error('[screen-capture] Screenshot error:', err.message);
    return { ok: false, error: err.message };
  } finally {
    if (wasVisible && hideOverlay && overlay && !overlay.isDestroyed()) {
      overlay.show();
    }
  }
}

/**
 * Get screen sources for MediaRecorder in renderer
 */
async function getScreenSources() {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources.map((s) => ({ id: s.id, name: s.name }));
  } catch (err) {
    console.error('[screen-capture] getScreenSources failed:', err.message);
    return [{ id: 'screen:0:0', name: 'Primary Screen' }];
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(ffmpegPath, args, { windowsHide: true, timeout: 60000 }, (err, stdout, stderr) => {
      if (err) {
        console.error('[screen-capture] ffmpeg error:', err.message, stderr);
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

/**
 * Save screen recording buffer, convert/remux to standard MP4 (H.264 + AAC) using ffmpeg-static
 */
async function saveScreenRecording(arrayBuffer, mimeType = 'video/webm') {
  try {
    const dir = getRecordingsDir();
    const timeTag = timestamp();
    const isH264 = mimeType.includes('mp4') || mimeType.includes('avc1') || mimeType.includes('h264');
    const tempExt = isH264 ? 'mp4' : 'webm';
    const tempPath = path.join(dir, `_temp_${timeTag}.${tempExt}`);
    const mp4FileName = `Capri_Record_${timeTag}.mp4`;
    const mp4Path = path.join(dir, mp4FileName);

    const buf = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
    fs.writeFileSync(tempPath, buf);

    console.log(`[screen-capture] Converting recording to MP4 via FFmpeg (${buf.length} bytes, mime: ${mimeType})...`);

    const ffmpegArgs = ['-y', '-i', tempPath];

    if (isH264) {
      ffmpegArgs.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        mp4Path
      );
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '22',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        mp4Path
      );
    }

    try {
      await runFfmpeg(ffmpegArgs);
    } catch (ffErr) {
      console.warn('[screen-capture] FFmpeg transcode failed, attempting fallback remux:', ffErr.message);
      try {
        await runFfmpeg(['-y', '-i', tempPath, '-movflags', '+faststart', mp4Path]);
      } catch {
        fs.copyFileSync(tempPath, mp4Path);
      }
    }

    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}

    const stat = fs.existsSync(mp4Path) ? fs.statSync(mp4Path) : { size: buf.length };
    console.log(`[screen-capture] MP4 export complete: ${mp4Path} (${stat.size} bytes)`);

    return {
      ok: true,
      filePath: mp4Path,
      dirPath: dir,
      fileName: mp4FileName,
      size: stat.size,
    };
  } catch (err) {
    console.error('[screen-capture] saveScreenRecording failed:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Save Instant Replay buffer from rolling ring-buffer in RAM
 */
async function saveInstantReplay(arrayBuffer, mimeType = 'video/webm') {
  try {
    const dir = getReplaysDir();
    const timeTag = timestamp();
    const isH264 = mimeType.includes('mp4') || mimeType.includes('avc1') || mimeType.includes('h264');
    const tempExt = isH264 ? 'mp4' : 'webm';
    const tempPath = path.join(dir, `_clip_temp_${timeTag}.${tempExt}`);
    const clipFileName = `Clip_${timeTag}.mp4`;
    const clipPath = path.join(dir, clipFileName);

    const buf = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
    if (!buf || buf.length < 5000) {
      return { ok: false, error: 'Dữ liệu bộ đệm Instant Replay quá nhỏ hoặc trống.' };
    }

    fs.writeFileSync(tempPath, buf);
    console.log(`[instant-replay] Muxing ring buffer (${buf.length} bytes) to MP4: ${clipPath}...`);

    const ffmpegArgs = ['-y', '-i', tempPath];

    if (isH264) {
      ffmpegArgs.push(
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        clipPath
      );
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        clipPath
      );
    }

    try {
      await runFfmpeg(ffmpegArgs);
    } catch (ffErr) {
      console.warn('[instant-replay] Fast remux failed, fallback simple copy:', ffErr.message);
      try {
        await runFfmpeg(['-y', '-i', tempPath, '-c', 'copy', clipPath]);
      } catch {
        fs.copyFileSync(tempPath, clipPath);
      }
    }

    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}

    if (!fs.existsSync(clipPath) || fs.statSync(clipPath).size < 1024) {
      throw new Error('File clip MP4 tạo ra không hợp lệ');
    }

    const stat = fs.statSync(clipPath);
    console.log(`[instant-replay] Clip saved successfully: ${clipPath} (${stat.size} bytes)`);

    return {
      ok: true,
      filePath: clipPath,
      fileName: clipFileName,
      dirPath: dir,
      size: stat.size
    };
  } catch (err) {
    console.error('[instant-replay] Failed to save instant replay:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Open folder or file in Windows
 */
async function openFolder(targetPath) {
  const dir = targetPath || getScreenshotsDir();
  try {
    await shell.openPath(dir);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function openFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return { ok: true };
    }
    return { ok: false, error: 'File does not exist' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  takeScreenshot,
  getScreenSources,
  saveScreenRecording,
  saveInstantReplay,
  openFolder,
  openFile,
  getScreenshotsDir,
  getRecordingsDir,
  getReplaysDir
};
