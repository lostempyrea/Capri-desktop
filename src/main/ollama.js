'use strict';

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Talking to her: a local model through Ollama (https://ollama.com). Done from here, not from
// the overlay's page, which can't reach other local ports. Everything stays on this machine
// unless OLLAMA_HOST points somewhere else.

// --- .env loading ---
// Reads KEY=VALUE lines from .env in the project root, skipping comments and empty lines.
function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '..', '.env');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key) process.env[key] = val;
    }
  } catch {
    // no .env file — that's fine
  }
}
loadEnv();

// --- backend detection ---
function getApiKey() {
  return process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

function useOpenAI() {
  loadEnv();
  const key = getApiKey();
  const validKey = Boolean(
    key &&
    key.length > 8 &&
    !key.includes('dien_api_key') &&
    !key.includes('your_')
  );
  if (!validKey) return false;

  // Auto-configure Google Gemini API if Gemini key is detected (starts with AIzaSy)
  if (key.startsWith('AIzaSy')) {
    if (!process.env.AI_BASE_URL) {
      process.env.AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
    }
    if (!process.env.AI_MODEL) {
      process.env.AI_MODEL = 'gemini-2.0-flash';
    }
  }

  return Boolean(process.env.AI_BASE_URL && validKey);
}

function provider() {
  return useOpenAI() ? 'openai' : 'ollama';
}

// --- Ollama helpers ---

function base() {
  let host = process.env.OLLAMA_HOST || '127.0.0.1:11434';
  if (!/^https?:\/\//.test(host)) host = `http://${host}`;
  return host.replace('://0.0.0.0', '://127.0.0.1').replace(/\/+$/, '');
}

// Ollama's errors come as {"error": "..."}
async function failure(res) {
  const body = await res.text().catch(() => '');
  try {
    return new Error(JSON.parse(body).error);
  } catch {
    return new Error(body || `Ollama answered ${res.status}`);
  }
}

// --- OpenAI-compatible helpers ---

function openaiBase() {
  return process.env.AI_BASE_URL.replace(/\/+$/, '');
}

async function openaiFailure(res) {
  const body = await res.text().catch(() => '');
  try {
    const json = JSON.parse(body);
    return new Error(json.error?.message || json.error || body);
  } catch {
    return new Error(body || `API answered ${res.status}`);
  }
}

// --- models ---

// The models installed, by name ("llama3.2:latest"...).
async function models() {
  if (useOpenAI()) return [process.env.AI_MODEL || 'gemini-2.0-flash'];

  const res = await fetch(`${base()}/api/tags`, { signal: AbortSignal.timeout(2500) });
  if (!res.ok) throw await failure(res);
  const { models: list = [] } = await res.json();
  return list.map((m) => m.name);
}

// --- warm ---

// Loads the model into memory ahead of the first message (the first answer after a fresh start
// otherwise waits for it to load, which can take a while).
function warm(model) {
  if (useOpenAI()) return; // remote APIs don't need warming

  fetch(`${base()}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, keep_alive: '15m' }),
  }).catch(() => {});
}

// --- chat ---

// Her answer, streamed: onDelta(piece) as it comes, resolves with all of it.
async function chat({ model, messages }, onDelta, signal) {
  const cleanMessages = (Array.isArray(messages) ? messages : []).map((m) => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content : String(m.content ?? ''))
  }));
  if (useOpenAI()) return openaiChat({ model, messages: cleanMessages }, onDelta, signal);
  return ollamaChat({ model, messages: cleanMessages }, onDelta, signal);
}

async function ollamaChat({ model, messages }, onDelta, signal) {
  const res = await fetch(`${base()}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      keep_alive: '15m', // she stays loaded while you chat
      options: { temperature: 0.85, num_predict: 240 },
    }),
    signal,
  });
  if (!res.ok) throw await failure(res);
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.error) throw new Error(msg.error);
      const piece = msg.message?.content || ''; // a thinking model's reasoning comes apart, and is left out
      if (piece) {
        text += piece;
        onDelta(piece);
      }
      if (msg.done) return text;
    }
  }
  return text;
}

async function openaiChat({ model: _model, messages }, onDelta, signal) {
  const model = process.env.AI_MODEL || _model || 'gemini-2.0-flash';
  const res = await fetch(`${openaiBase()}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.85,
      max_tokens: 240,
    }),
    signal,
  });
  if (!res.ok) throw await openaiFailure(res);
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line || line === 'data: [DONE]') continue;
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6);
      const msg = JSON.parse(json);
      if (msg.error) throw new Error(msg.error.message || msg.error);
      const piece = msg.choices?.[0]?.delta?.content || '';
      if (piece) {
        text += piece;
        onDelta(piece);
      }
      if (msg.choices?.[0]?.finish_reason) return text;
    }
  }
  return text;
}

module.exports = { models, warm, chat, provider, loadEnv };
