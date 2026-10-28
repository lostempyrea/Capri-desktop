'use strict';

// Capri Speech-to-Text (STT) Module
// Uses Groq's high-speed Whisper Large v3 Turbo endpoint with native fetch & FormData

const ollama = require('./ollama');

async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  if (ollama.loadEnv) ollama.loadEnv();
  const apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY || '';

  if (!apiKey || apiKey.length < 15 || apiKey.includes('your_')) {
    return {
      ok: false,
      error: 'Chưa cấu hình GROQ_API_KEY hoặc AI_API_KEY trong file .env!',
    };
  }

  try {
    const buf = Buffer.isBuffer(audioBuffer)
      ? audioBuffer
      : Buffer.from(audioBuffer?.buffer || audioBuffer);

    if (buf.length < 500) {
      return { ok: false, error: 'Dữ liệu âm thanh quá ngắn để giải mã.' };
    }

    let ext = 'webm';
    if (mimeType.includes('wav')) ext = 'wav';
    else if (mimeType.includes('ogg')) ext = 'ogg';
    else if (mimeType.includes('mp4') || mimeType.includes('m4a')) ext = 'm4a';
    else if (mimeType.includes('mp3')) ext = 'mp3';

    const blob = new Blob([buf], { type: mimeType });
    const form = new FormData();
    form.append('file', blob, `voice_input.${ext}`);
    form.append('model', process.env.STT_MODEL || 'whisper-large-v3-turbo');

    const sttLang = (process.env.STT_LANGUAGE || '').trim().toLowerCase();
    if (sttLang && sttLang !== 'auto') {
      form.append('language', sttLang);
    }

    form.append(
      'prompt',
      'Hey Capri, Hi Capri, Capri ơi. Open app, take a screenshot, start recording, stop recording, clip that shit, clip that, what time is it, weather today, play music on Discord, Spotify, YouTube. Mở ứng dụng, chụp màn hình, quay màn hình, dừng quay, mấy giờ rồi, thời tiết hôm nay.'
    );

    const endpoint = process.env.STT_ENDPOINT || 'https://api.groq.com/openai/v1/audio/transcriptions';

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: form,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('[stt] transcription error status:', res.status, errText);
      return { ok: false, status: res.status, error: errText };
    }

    const data = await res.json();
    const text = (data.text || '').trim();
    return { ok: true, text };
  } catch (err) {
    console.error('[stt] transcribe failed:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { transcribeAudio };
