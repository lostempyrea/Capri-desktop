'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

function loadEnvFile() {
  try {
    const envPath = path.resolve(__dirname, '..', '..', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const k = trimmed.slice(0, idx).trim();
          const v = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
          if (k && !process.env[k]) {
            process.env[k] = v;
          }
        }
      }
    }
  } catch {}
}

loadEnvFile();

function getVideosPath() {
  try {
    return path.join(app.getPath('videos'), 'Capri_Clips');
  } catch {
    return path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Videos', 'Capri_Clips');
  }
}

function getConfigFile() {
  try {
    return path.join(app.getPath('userData'), 'config.json');
  } catch {
    return path.join(__dirname, '..', '..', 'config.json');
  }
}

const DEFAULTS = {
  // Legacy / core fields
  scale: 0.6,
  muted: false,
  volume: 0.7,
  lang: 'vi',
  displayId: null,
  wander: false, // In Cyberpunk mini mode, stays docked at bottom corner
  possess: false,
  visible: true,
  welcomed: true,
  linked: false,
  agentHookEnabled: false,
  wakeWord: true,
  inactivityMinutes: 0.5, // 30s
  micDeviceId: null,

  // Cyberpunk Overhaul Settings
  apiVault: {
    providers: {
      groq: {
        id: 'groq',
        name: 'Groq Cloud (Ultra Fast)',
        apiKey: process.env.GROQ_API_KEY || process.env.AI_API_KEY || '',
        baseUrl: 'https://api.groq.com/openai/v1',
        enabled: true
      },
      gemini: {
        id: 'gemini',
        name: 'Google Gemini Studio',
        apiKey: process.env.GEMINI_API_KEY || '',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        enabled: true
      },
      openrouter: {
        id: 'openrouter',
        name: 'OpenRouter AI',
        apiKey: process.env.OPENROUTER_API_KEY || '',
        baseUrl: 'https://openrouter.ai/api/v1',
        enabled: true
      },
      openai: {
        id: 'openai',
        name: 'OpenAI Platform',
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: 'https://api.openai.com/v1',
        enabled: false
      },
      ollama: {
        id: 'ollama',
        name: 'Ollama Local (Offline)',
        apiKey: 'ollama',
        baseUrl: 'http://127.0.0.1:11434/v1',
        enabled: true
      }
    },
    failoverOrder: ['groq', 'gemini', 'openrouter', 'openai', 'ollama'],
    activeModels: {
      chat: process.env.AI_MODEL || 'openai/gpt-oss-120b',
      vision: 'gemini-1.5-flash',
      stt: 'whisper-large-v3-turbo'
    }
  },

  voice: {
    engine: 'edge-tts', // 'edge-tts' | 'openai' | 'elevenlabs'
    edgeVoiceVi: 'vi-VN-HoaiMyNeural',
    edgeVoiceEn: 'en-US-JennyNeural',
    glitchReverb: 0.25,
    ttsApiKey: '',
    inputDeviceId: null,
    ttsEnabled: true,
  },

  system: {
    replaySeconds: 30, // 15 | 30 | 60 | 90
    replayDir: '',
    inactivitySleepSec: 30,
    hologramDismissSec: 10,
    gamerAutoPilot: true,
    focusReminderMinutes: 120,
    opacity: 0.95,
    theme: 'system', // 'system' | 'crimson' | 'matrix'
    userName: 'Tèo',
    tickerPosition: {
      preset: 'top-left',
      offsetX: 0,
      offsetY: 0,
      statusBarOffsetX: 0,
      statusBarOffsetY: 0,
    },
  },

  user: {
    name: 'Tèo',
    callsign: '',
    randomNick: true,
    avatar: '',
  }
};

let cache = null;

function load() {
  if (cache) return cache;
  const file = getConfigFile();
  try {
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      cache = deepMerge({ ...DEFAULTS }, data);
    } else {
      cache = JSON.parse(JSON.stringify(DEFAULTS));
    }
  } catch (err) {
    console.warn('[config-store] Error loading config, using defaults:', err.message);
    cache = JSON.parse(JSON.stringify(DEFAULTS));
  }

  // Ensure replay directory fallback
  if (!cache.system.replayDir) {
    cache.system.replayDir = getVideosPath();
  }

  // Reset legacy 8px ticker position to flush tight (0, 0)
  if (cache.system?.tickerPosition?.preset === 'top-left' && cache.system?.tickerPosition?.offsetX === 8 && cache.system?.tickerPosition?.offsetY === 8) {
    cache.system.tickerPosition.offsetX = 0;
    cache.system.tickerPosition.offsetY = 0;
    cache.system.tickerPosition.statusBarOffsetX = 0;
    cache.system.tickerPosition.statusBarOffsetY = 0;
  }

  // Ensure default Groq key if available in env
  if (!cache.apiVault.providers.groq.apiKey && (process.env.GROQ_API_KEY || process.env.AI_API_KEY)) {
    cache.apiVault.providers.groq.apiKey = process.env.GROQ_API_KEY || process.env.AI_API_KEY;
  }

  return cache;
}

function save(patch) {
  cache = deepMerge(load(), patch);
  const file = getConfigFile();
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
  } catch (err) {
    console.error('[config-store] Failed to save config:', err.message);
  }
  return cache;
}

function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

module.exports = {
  load,
  save,
  DEFAULTS,
  getConfigFile,
  getVideosPath
};
