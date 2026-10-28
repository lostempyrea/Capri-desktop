'use strict';

// Capri Online & Local Music Service
// Uses yt-search and @distube/ytdl-core to search, resolve, and stream audio directly.

const path = require('node:path');
const fs = require('node:fs');
const yts = require('yt-search');
const { Ytdl, chooseFormat } = require('@distube/ytdl-core');

const ytdl = new Ytdl();
const SOUND_EXT = /\.(mp3|wav|ogg|m4a|flac|aac)$/i;

// In-memory stream registry for active YouTube audio streams
const activeStreams = new Map(); // streamId -> { videoUrl, title, author, thumbnail, duration, created }
const localTracksMap = new Map(); // id -> absolute file path

const RADIO_STATIONS = [
  { id: 'plaza', title: 'Nightwave Plaza 🌌 (Vaporwave / Cyberpunk 24/7)', url: 'https://radio.plaza.one/mp3' },
  { id: 'defcon', title: 'SomaFM DEF CON Radio ⚡ (Hacker Synth Cyberpunk)', url: 'https://ice2.somafm.com/defcon-128-mp3' },
  { id: 'groovesalad', title: 'SomaFM Groove Salad ☕ (Chill Ambient Lofi)', url: 'https://ice4.somafm.com/groovesalad-128-mp3' },
];

function getMusicDirs(appPathMusic, appPathUserData, rootDir) {
  const dirs = [];
  try {
    const winMusic = path.join(appPathMusic, 'Capri');
    if (!fs.existsSync(winMusic)) fs.mkdirSync(winMusic, { recursive: true });
    dirs.push(winMusic);
  } catch {}
  try {
    const userAppMusic = path.join(appPathUserData, 'music');
    if (!fs.existsSync(userAppMusic)) fs.mkdirSync(userAppMusic, { recursive: true });
    dirs.push(userAppMusic);
  } catch {}
  if (rootDir) {
    const repoMusic = path.join(rootDir, 'assets', 'music');
    if (fs.existsSync(repoMusic)) dirs.push(repoMusic);
  }
  return dirs;
}

function scanLocalMusic(dirs) {
  localTracksMap.clear();
  const list = [];
  let id = 1;
  for (const dir of dirs) {
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!SOUND_EXT.test(file)) continue;
        const fullPath = path.join(dir, file);
        const strId = String(id++);
        localTracksMap.set(strId, fullPath);
        const title = file.replace(SOUND_EXT, '').replace(/[-_]+/g, ' ');
        list.push({ id: strId, title, filename: file, dir, url: `capri://music/${strId}` });
      }
    } catch {}
  }
  return list;
}

function getLocalTrackPath(id) {
  return localTracksMap.get(id);
}

// Search YouTube by keywords
async function searchYouTube(query, limit = 5) {
  if (!query || !String(query).trim()) return [];
  try {
    const res = await yts(String(query).trim());
    const videos = (res.videos || []).slice(0, limit).map((v) => ({
      id: v.videoId,
      title: v.title,
      url: v.url,
      author: v.author?.name || 'Unknown Artist',
      duration: v.timestamp || `${Math.floor(v.seconds / 60)}:${String(v.seconds % 60).padStart(2, '0')}`,
      seconds: v.seconds,
      thumbnail: v.thumbnail || v.image,
    }));
    return videos;
  } catch (err) {
    console.error('[music] search error:', err.message);
    return [];
  }
}

// Resolve a song query or direct YouTube URL to a streamable audio item
async function resolveTrack(queryOrUrl, port = 47823) {
  const q = String(queryOrUrl || '').trim();
  if (!q) throw new Error('No song query provided');

  let videoUrl = q;
  let videoDetails = null;

  // Check if it's already a YouTube URL
  const isYtUrl = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(q);

  if (isYtUrl) {
    videoUrl = q;
  } else {
    // Search YouTube
    const results = await searchYouTube(q, 1);
    if (!results || results.length === 0) {
      throw new Error(`Không tìm thấy bài hát nào cho từ khóa: "${q}"`);
    }
    const top = results[0];
    videoUrl = top.url;
    videoDetails = {
      title: top.title,
      author: top.author,
      duration: top.duration,
      thumbnail: top.thumbnail,
    };
  }

  // Generate stream ID and register
  const streamId = 'stream_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

  let formatDetails = null;
  try {
    const info = await ytdl.getInfo(videoUrl);
    const bestFormat = chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: (f) => f.hasAudio && !f.hasVideo,
    });

    formatDetails = {
      contentLength: Number(bestFormat?.contentLength) || null,
      mimeType: bestFormat?.mimeType?.split(';')?.[0] || 'audio/mp4',
      durationSeconds: Number(info.videoDetails.lengthSeconds) || (videoDetails?.seconds || 0),
    };

    if (!videoDetails) {
      videoDetails = {
        title: info.videoDetails.title,
        author: info.videoDetails.author?.name || 'YouTube',
        duration: info.videoDetails.lengthSeconds
          ? `${Math.floor(info.videoDetails.lengthSeconds / 60)}:${String(info.videoDetails.lengthSeconds % 60).padStart(2, '0')}`
          : '',
        thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
      };
    }
  } catch (err) {
    console.warn('[music] ytdl.getInfo failed, using basic details:', err.message);
    if (!videoDetails) {
      videoDetails = { title: q, author: 'YouTube', duration: '', thumbnail: '' };
    }
    formatDetails = { contentLength: null, mimeType: 'audio/mp4', durationSeconds: 0 };
  }

  activeStreams.set(streamId, {
    videoUrl,
    title: videoDetails.title,
    author: videoDetails.author,
    duration: videoDetails.duration,
    durationSeconds: formatDetails.durationSeconds,
    thumbnail: videoDetails.thumbnail,
    contentLength: formatDetails.contentLength,
    mimeType: formatDetails.mimeType,
    created: Date.now(),
  });

  // Clean old streams
  const ONE_HOUR = 60 * 60 * 1000;
  for (const [sId, item] of activeStreams.entries()) {
    if (Date.now() - item.created > ONE_HOUR) activeStreams.delete(sId);
  }

  return {
    id: streamId,
    title: videoDetails.title,
    author: videoDetails.author,
    duration: videoDetails.duration,
    durationSeconds: formatDetails.durationSeconds,
    thumbnail: videoDetails.thumbnail,
    originalUrl: videoUrl,
    streamUrl: `http://127.0.0.1:${port}/audio/stream?id=${streamId}`,
  };
}

// HTTP handler for audio streaming (called from bridge.js)
// Supports Range requests for smooth playback and seeking in HTML5 <audio>
function handleAudioStream(req, res, url) {
  const streamId = url.searchParams.get('id');
  const directUrl = url.searchParams.get('url');

  let entry = null;
  let videoUrl = null;

  if (streamId && activeStreams.has(streamId)) {
    entry = activeStreams.get(streamId);
    videoUrl = entry.videoUrl;
  } else if (directUrl) {
    videoUrl = directUrl;
  }

  if (!videoUrl) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false, error: 'stream not found' }));
    return;
  }

  const range = req.headers.range;
  const total = entry?.contentLength || null;
  const mimeType = entry?.mimeType || 'audio/mp4';

  try {
    let downloadOptions = {
      filter: (f) => f.hasAudio && !f.hasVideo,
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    };

    if (range && total) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      const chunkSize = end - start + 1;

      downloadOptions.range = { start, end };

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache',
      });
    } else {
      res.writeHead(200, {
        'Content-Type': mimeType,
        ...(total ? { 'Content-Length': total } : { 'Transfer-Encoding': 'chunked' }),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache',
      });
    }

    const audioStream = ytdl.download(videoUrl, downloadOptions);
    audioStream.pipe(res);

    audioStream.on('error', (err) => {
      console.warn('[music] audio stream error:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      } else {
        res.end();
      }
    });

    req.on('close', () => {
      try {
        audioStream.destroy();
      } catch {}
    });
  } catch (err) {
    console.error('[music] failed to initiate download stream:', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    } else {
      res.end();
    }
  }
}

// Get raw readable stream (for Discord bot voice)
function getDiscordAudioStream(videoUrl) {
  return ytdl.download(videoUrl, {
    filter: (f) => f.hasAudio && !f.hasVideo,
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
  });
}

module.exports = {
  RADIO_STATIONS,
  getMusicDirs,
  scanLocalMusic,
  getLocalTrackPath,
  searchYouTube,
  resolveTrack,
  handleAudioStream,
  getDiscordAudioStream,
};
