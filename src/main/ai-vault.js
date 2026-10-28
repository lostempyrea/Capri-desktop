'use strict';

const fs = require('node:fs');
const configStore = require('./config-store');

// Circuit breaker state: { [providerId]: cooldownUntilTimestamp }
const circuitBreaker = {};
const COOLDOWN_MS = 60 * 1000;

function isProviderCoolingDown(providerId) {
  const until = circuitBreaker[providerId];
  if (!until) return false;
  if (Date.now() > until) {
    delete circuitBreaker[providerId];
    return false;
  }
  return true;
}

function tripCircuit(providerId, reason = '') {
  circuitBreaker[providerId] = Date.now() + COOLDOWN_MS;
  console.warn(`[ai-vault] Tripped circuit breaker for ${providerId} (${reason}). Cooldown 60s.`);
}

function getProviderClient(providerId) {
  const config = configStore.load();
  const provider = config.apiVault.providers[providerId];
  if (!provider || !provider.enabled) return null;
  if (providerId !== 'ollama' && (!provider.apiKey || provider.apiKey.length < 5)) return null;
  return provider;
}

/**
 * Execute Chat completion with auto-failover
 */
async function chat(messages, options = {}) {
  const cleanMessages = (Array.isArray(messages) ? messages : []).map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content : String(m.content ?? ''))
  }));
  const config = configStore.load();
  const order = config.apiVault.failoverOrder || ['groq', 'gemini', 'openrouter', 'openai', 'ollama'];
  const preferredModel = options.model || config.apiVault.activeModels.chat;

  const errors = [];

  for (const providerId of order) {
    if (isProviderCoolingDown(providerId)) {
      console.log(`[ai-vault] Skipping ${providerId} (in circuit cooldown)`);
      continue;
    }

    const provider = getProviderClient(providerId);
    if (!provider) continue;

    try {
      console.log(`[ai-vault] Attempting chat via ${provider.name} (${providerId})...`);
      const baseUrl = provider.baseUrl.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/chat/completions`;

      // Select model appropriate for provider
      let model = preferredModel;
      if (providerId === 'gemini' && !model.includes('gemini')) {
        model = 'gemini-1.5-flash';
      } else if (providerId === 'openrouter' && !model.includes('/')) {
        model = 'meta-llama/llama-3.3-70b-instruct:free';
      } else if (providerId === 'openai' && !model.startsWith('gpt-')) {
        model = 'gpt-4o-mini';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: cleanMessages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 800
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.status === 401 || res.status === 429 || res.status >= 500) {
        const errText = await res.text();
        tripCircuit(providerId, `Status ${res.status}: ${errText.slice(0, 100)}`);
        errors.push(`${providerId}: ${res.status}`);
        continue; // Try next provider
      }

      if (!res.ok) {
        const errText = await res.text();
        errors.push(`${providerId}: ${res.status} - ${errText.slice(0, 100)}`);
        continue;
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return {
        ok: true,
        text: reply,
        provider: providerId,
        model
      };
    } catch (err) {
      console.warn(`[ai-vault] Provider ${providerId} failed:`, err.message);
      tripCircuit(providerId, err.message);
      errors.push(`${providerId}: ${err.message}`);
    }
  }

  return {
    ok: false,
    error: `Tất cả nhà cung cấp AI trong Vault đều thất bại: ${errors.join(', ')}`
  };
}

/**
 * Screen Vision / Image analysis with auto-failover
 */
async function vision(prompt, imageInput, mimeType = 'image/png', options = {}) {
  let base64Image = imageInput;
  if (typeof imageInput === 'string' && imageInput.length < 500 && fs.existsSync(imageInput)) {
    try {
      base64Image = fs.readFileSync(imageInput).toString('base64');
    } catch (e) {
      return { ok: false, error: `Không thể đọc file ảnh: ${e.message}` };
    }
  }

  const config = configStore.load();
  const order = config.apiVault.failoverOrder || ['groq', 'gemini', 'openrouter', 'openai', 'ollama'];
  const preferredModel = options.model || config.apiVault.activeModels.vision;

  const errors = [];

  for (const providerId of order) {
    if (isProviderCoolingDown(providerId)) continue;
    const provider = getProviderClient(providerId);
    if (!provider) continue;

    try {
      console.log(`[ai-vault] Attempting Vision via ${provider.name}...`);
      const baseUrl = provider.baseUrl.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/chat/completions`;

      let model = preferredModel;
      if (providerId === 'groq') {
        model = 'llama-3.2-11b-vision-preview';
      } else if (providerId === 'gemini') {
        model = 'gemini-1.5-flash';
      } else if (providerId === 'openrouter') {
        model = 'google/gemini-flash-1.5';
      } else if (providerId === 'openai') {
        model = 'gpt-4o-mini';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const messages = [
        {
          role: 'system',
          content: 'You are Capri, a sharp, ultra-competent cyberpunk hologram desktop construct. Analyze the user screen or image accurately and concisely. Highlight errors, UI elements, or relevant code clearly with markdown.'
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt || 'Hãy phân tích màn hình này, phát hiện lỗi hoặc nội dung quan trọng.' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ];

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        tripCircuit(providerId, `Status ${res.status}: ${errText.slice(0, 100)}`);
        errors.push(`${providerId}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';
      return {
        ok: true,
        text: reply,
        provider: providerId,
        model
      };
    } catch (err) {
      console.warn(`[ai-vault] Vision provider ${providerId} failed:`, err.message);
      tripCircuit(providerId, err.message);
      errors.push(`${providerId}: ${err.message}`);
    }
  }

  return {
    ok: false,
    error: `Không thể phân tích màn hình qua bất kỳ AI Provider nào: ${errors.join(', ')}`
  };
}

/**
 * Test connectivity and API key for a specific provider
 */
async function testProvider(providerId) {
  const provider = getProviderClient(providerId);
  if (!provider) {
    return { ok: false, error: 'Chưa nhập API Key hoặc nhà cung cấp chưa được kích hoạt.' };
  }

  try {
    const baseUrl = provider.baseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/models`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${provider.apiKey}`
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      return { ok: true, message: `Kết nối thành công tới ${provider.name}!` };
    } else {
      const err = await res.text();
      return { ok: false, error: `Lỗi kết nối (${res.status}): ${err.slice(0, 150)}` };
    }
  } catch (err) {
    return { ok: false, error: `Không thể kết nối: ${err.message}` };
  }
}

module.exports = {
  chat,
  vision,
  testProvider,
  isProviderCoolingDown
};
