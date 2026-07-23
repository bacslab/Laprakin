import { nanoid } from 'nanoid';
import { config } from './config.js';
import { db } from './db.js';
import { HttpError, now } from './utils.js';

const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const SAFETY_SETTINGS = [
  ['HARM_CATEGORY_HARASSMENT', 'BLOCK_MEDIUM_AND_ABOVE'],
  ['HARM_CATEGORY_HATE_SPEECH', 'BLOCK_MEDIUM_AND_ABOVE'],
  ['HARM_CATEGORY_SEXUALLY_EXPLICIT', 'BLOCK_MEDIUM_AND_ABOVE'],
  ['HARM_CATEGORY_DANGEROUS_CONTENT', 'BLOCK_MEDIUM_AND_ABOVE'],
].map(([category, threshold]) => ({ category, threshold }));
const SAFETY_FINISH_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'IMAGE_SAFETY']);

export class AiProviderError extends Error {
  constructor(message, { code = 'AI_PROVIDER_ERROR', status = 502, retryable = false } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function isAiConfigured() {
  return Boolean(config.geminiKey);
}

export function aiModelFor(mode = 'basic', purpose = 'chat') {
  if (purpose === 'document') return config.geminiModelDocument;
  if (purpose === 'support') return config.geminiModelSupport;
  if (mode === 'xtrathink') return config.geminiModelXtraThink;
  if (mode === 'thinking') return config.geminiModelThinking;
  return config.geminiModelBasic;
}

export function aiThinkingConfigFor({ model, mode = 'basic', purpose = 'chat' }) {
  const level = purpose === 'document' || mode === 'xtrathink'
    ? 'high'
    : mode === 'thinking'
      ? 'medium'
      : 'minimal';
  if (/^gemini-3(?:\.|$)/i.test(String(model))) return { thinkingLevel: level };
  if (/^gemini-2\.5(?:-|$)/i.test(String(model))) {
    return { thinkingBudget: level === 'minimal' ? 0 : level === 'medium' ? 2048 : -1 };
  }
  return null;
}

function reserveUsage({ userId, purpose, mode, model }) {
  const id = nanoid();
  let transactionOpen = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    transactionOpen = true;
    const dailySince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dailyCount = Number(db.prepare(`
      SELECT COUNT(*) AS count FROM ai_usage_events
      WHERE created_at >= ?
    `).get(dailySince)?.count || 0);
    if (dailyCount >= config.aiMaxRequestsPerDay) {
      throw new HttpError(429, 'Kapasitas AI harian sedang penuh. Coba lagi nanti.', 'AI_DAILY_LIMIT');
    }
    if (userId) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const count = Number(db.prepare(`
        SELECT COUNT(*) AS count FROM ai_usage_events
        WHERE user_id = ? AND created_at >= ?
      `).get(userId, since)?.count || 0);
      if (count >= config.aiMaxRequestsPerHour) {
        throw new HttpError(429, 'Batas pemakaian AI per jam tercapai. Coba lagi setelah jeda singkat.', 'AI_USER_RATE_LIMIT');
      }
    }
    db.prepare(`
      INSERT INTO ai_usage_events (
        id, user_id, purpose, mode, provider, model, status,
        input_tokens, output_tokens, total_tokens, latency_ms, error_code, created_at
      ) VALUES (?, ?, ?, ?, 'gemini', ?, 'pending', 0, 0, 0, 0, '', ?)
    `).run(
      id,
      userId || null,
      String(purpose || 'chat').slice(0, 32),
      String(mode || 'basic').slice(0, 24),
      String(model).slice(0, 100),
      now(),
    );
    db.exec('COMMIT');
    transactionOpen = false;
    return id;
  } catch (error) {
    if (transactionOpen) db.exec('ROLLBACK');
    throw error;
  }
}

function finishUsage(id, { status, usage, latencyMs, errorCode = '' }) {
  db.prepare(`
    UPDATE ai_usage_events SET
      status = ?, input_tokens = ?, output_tokens = ?, total_tokens = ?, latency_ms = ?, error_code = ?
    WHERE id = ?
  `).run(
    status,
    Number(usage?.promptTokenCount || 0),
    Number(usage?.candidatesTokenCount || 0),
    Number(usage?.totalTokenCount || 0),
    Math.max(0, Math.round(latencyMs || 0)),
    String(errorCode || '').slice(0, 80),
    id,
  );
}

function providerError(status, payload) {
  const providerCode = String(payload?.error?.status || `HTTP_${status}`).slice(0, 80);
  const retryable = RETRYABLE_STATUS.has(status);
  const publicStatus = status === 429 ? 429 : 502;
  const message = status === 429
    ? 'Kapasitas AI sedang penuh. Coba lagi sebentar.'
    : 'Provider AI belum dapat menyelesaikan permintaan ini.';
  return new AiProviderError(message, { code: `GEMINI_${providerCode}`, status: publicStatus, retryable });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGemini({ model, body }) {
  let lastError;
  for (let attempt = 0; attempt < config.aiMaxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': config.geminiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      lastError = providerError(response.status, payload);
      if (!lastError.retryable || attempt === config.aiMaxRetries - 1) throw lastError;
    } catch (error) {
      if (error instanceof AiProviderError) {
        lastError = error;
      } else if (error?.name === 'AbortError') {
        lastError = new AiProviderError('Provider AI melewati batas waktu.', { code: 'AI_TIMEOUT', status: 504, retryable: true });
      } else {
        lastError = new AiProviderError('Provider AI tidak dapat dihubungi.', { code: 'AI_NETWORK_ERROR', status: 502, retryable: true });
      }
      if (!lastError.retryable || attempt === config.aiMaxRetries - 1) throw lastError;
    } finally {
      clearTimeout(timeout);
    }
    const backoff = 350 * (2 ** attempt) + Math.floor(Math.random() * 180);
    await sleep(backoff);
  }
  throw lastError || new AiProviderError('Provider AI gagal tanpa respons.');
}

function responseText(payload) {
  return (payload?.candidates?.[0]?.content?.parts || [])
    .map((part) => typeof part?.text === 'string' ? part.text : '')
    .join('')
    .trim();
}

function safetyBlockReason(payload) {
  const promptReason = String(payload?.promptFeedback?.blockReason || '');
  if (promptReason && promptReason !== 'BLOCK_REASON_UNSPECIFIED') return promptReason;
  const finishReason = String(payload?.candidates?.[0]?.finishReason || '');
  return SAFETY_FINISH_REASONS.has(finishReason) ? finishReason : '';
}

function responseFormatMimeType(responseMimeType) {
  if (responseMimeType === 'application/json') return 'APPLICATION_JSON';
  if (responseMimeType === 'text/plain') return 'TEXT_PLAIN';
  return responseMimeType;
}

export async function generateAiContent({
  userId = null,
  purpose = 'chat',
  mode = 'basic',
  contents,
  systemInstruction = '',
  maxOutputTokens = 1200,
  responseMimeType = 'text/plain',
  responseJsonSchema,
}) {
  if (!config.geminiKey) {
    throw new HttpError(503, 'Provider AI belum dikonfigurasi.', 'AI_NOT_CONFIGURED');
  }
  const model = aiModelFor(mode, purpose);
  const usageEventId = reserveUsage({ userId, purpose, mode, model });
  const generationConfig = { maxOutputTokens };
  const thinkingConfig = aiThinkingConfigFor({ model, mode, purpose });
  if (thinkingConfig) generationConfig.thinkingConfig = thinkingConfig;
  if (responseJsonSchema) {
    generationConfig.responseFormat = {
      text: {
        mimeType: responseFormatMimeType(responseMimeType || 'application/json'),
        schema: responseJsonSchema,
      },
    };
  } else if (responseMimeType && responseMimeType !== 'text/plain') {
    generationConfig.responseFormat = { text: { mimeType: responseFormatMimeType(responseMimeType) } };
  }
  const body = {
    contents,
    generationConfig,
    safetySettings: SAFETY_SETTINGS,
  };
  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  const startedAt = Date.now();
  try {
    const payload = await requestGemini({ model, body });
    if (safetyBlockReason(payload)) {
      throw new AiProviderError('Permintaan tidak dapat diproses karena kebijakan keamanan AI.', { code: 'AI_SAFETY_BLOCKED', status: 422 });
    }
    const text = responseText(payload);
    if (!text) {
      throw new AiProviderError('Provider AI tidak mengembalikan teks.', { code: 'AI_EMPTY_RESPONSE', status: 502 });
    }
    finishUsage(usageEventId, { status: 'success', usage: payload.usageMetadata, latencyMs: Date.now() - startedAt });
    return { text, model, usage: payload.usageMetadata || {} };
  } catch (error) {
    finishUsage(usageEventId, { status: 'error', latencyMs: Date.now() - startedAt, errorCode: error?.code || 'AI_PROVIDER_ERROR' });
    throw error;
  }
}
