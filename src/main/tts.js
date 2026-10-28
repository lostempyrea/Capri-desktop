'use strict';

const configStore = require('./config-store');

const VIETNAMESE_REGEX = /[àáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵđ]/i;

function detectLanguage(text) {
  if (!text) return 'en';
  return VIETNAMESE_REGEX.test(text) ? 'vi' : 'en';
}

/**
 * High-speed, zero-dependency Neural TTS via Google Translate TTS service
 */
async function fetchGoogleTts(text, lang = 'vi') {
  const tl = lang === 'vi' ? 'vi' : 'en';
  // Split into chunks if text is long (> 180 chars)
  const encoded = encodeURIComponent(text.slice(0, 200));
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encoded}`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      'Referer': 'https://translate.google.com/'
    }
  });

  if (!res.ok) {
    throw new Error(`Google TTS status ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * OpenAI / Compatible TTS endpoint
 */
async function fetchOpenAiTts(text, apiKey, voice = 'nova', baseUrl = 'https://api.openai.com/v1') {
  const url = `${baseUrl.replace(/\/+$/, '')}/audio/speech`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI TTS status ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

/**
 * Main TTS speak entry with Bulletproof Auto-Failover
 */
async function speak(text, options = {}) {
  const config = configStore.load();
  const lang = options.lang || detectLanguage(text);

  // Sanitize Markdown
  const sanitizedText = (text || '')
    .replace(/\*+/g, '')
    .replace(/`+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[#_~]/g, '')
    .trim();

  if (!sanitizedText) {
    return { success: false, error: 'Empty text' };
  }

  const engine = options.engine || config.voice.engine || 'edge-tts';

  // 1. If OpenAI engine configured with key
  if (engine === 'openai' && config.voice.ttsApiKey) {
    try {
      const buf = await fetchOpenAiTts(sanitizedText, config.voice.ttsApiKey);
      return {
        success: true,
        audioBase64: buf.toString('base64'),
        mimeType: 'audio/mp3',
        source: 'openai',
        text: sanitizedText
      };
    } catch (err) {
      console.warn('[tts] OpenAI TTS failed, falling back to Google Neural TTS:', err.message);
    }
  }

  // 2. High-speed Google Neural Web Audio (Zero-config, instantly reliable)
  try {
    const buf = await fetchGoogleTts(sanitizedText, lang);
    return {
      success: true,
      audioBase64: buf.toString('base64'),
      mimeType: 'audio/mp3',
      source: 'neural-web',
      text: sanitizedText
    };
  } catch (err) {
    console.warn('[tts] Neural web audio failed:', err.message);
  }

  // 3. Renderer Web Speech Synthesis fallback
  return {
    success: false,
    fallbackWebSpeech: true,
    text: sanitizedText,
    lang
  };
}

module.exports = {
  speak,
  detectLanguage
};
