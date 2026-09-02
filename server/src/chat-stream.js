function extractText(payload) {
  return String(payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.delta?.content || '').trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Read a JSON string property while the surrounding JSON is still incomplete. */
export function readStructuredTextField(raw, field) {
  const source = String(raw || '');
  const match = source.match(new RegExp(`(?:^|[,{])\\s*["']${escapeRegExp(field)}["']\\s*:\\s*"`));
  if (!match) return '';
  let index = match.index + match[0].length;
  let value = '';
  while (index < source.length) {
    const character = source[index];
    if (character === '"') return value;
    if (character !== '\\') {
      value += character;
      index += 1;
      continue;
    }
    const escaped = source[index + 1];
    if (escaped === undefined) break;
    const escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
    if (Object.hasOwn(escapes, escaped)) {
      value += escapes[escaped];
      index += 2;
      continue;
    }
    if (escaped === 'u' && /^[0-9a-f]{4}$/i.test(source.slice(index + 2, index + 6))) {
      value += String.fromCharCode(Number.parseInt(source.slice(index + 2, index + 6), 16));
      index += 6;
      continue;
    }
    value += escaped;
    index += 2;
  }
  return value;
}

export async function* responseEvents(response) {
  const reader = response.body?.getReader?.();
  const chunks = reader
    ? (async function* readChunks() { try { while (true) { const next = await reader.read(); if (next.done) break; yield next.value; } } finally { reader.releaseLock?.(); } }())
    : response.body;
  if (!chunks) return;
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];
  const emit = function* emitEvent() {
    if (!dataLines.length) return;
    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') { yield { type: 'done' }; return; }
    try { const payload = JSON.parse(data); if (payload?.type) yield payload; else yield payload; } catch { /* Ignore malformed upstream frames. */ }
  };
  for await (const chunk of chunks) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line) { yield* emit(); continue; }
      if (line.startsWith(':')) continue;
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
  }
  buffer += decoder.decode();
  for (const line of buffer.split(/\r?\n/)) {
    if (!line) { yield* emit(); continue; }
    if (!line.startsWith(':') && line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  yield* emit();
}

export async function* requestOpenAiCompatibleStream({ url, token, body = {}, fetchImpl = fetch, signal }) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, stream: true }),
      signal,
    });
  } catch {
    yield { type: 'error', code: 'AI_NETWORK_ERROR' };
    return;
  }
  if (!response.ok) {
    yield { type: 'error', code: `AI_HTTP_${response.status}` };
    return;
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    const payload = await response.json().catch(() => ({}));
    const text = extractText(payload);
    if (text) yield { type: 'delta', text };
    yield { type: 'done', message: payload };
    return;
  }
  let completed = false;
  for await (const payload of responseEvents(response)) {
    if (payload?.type === 'done') { completed = true; yield payload; continue; }
    if (payload?.type === 'error') { yield payload; continue; }
    const text = extractText(payload);
    if (text) yield { type: 'delta', text };
  }
  if (!completed) yield { type: 'done' };
}

export function createSseChannel(response, { heartbeatMs = 15000 } = {}) {
  const controller = new AbortController();
  let ended = false;
  const heartbeat = setInterval(() => {
    if (ended || response.writableEnded || response.destroyed) return;
    try { response.write(': keepalive\n\n'); } catch { controller.abort(); }
  }, Math.max(1000, heartbeatMs));
  heartbeat.unref?.();
  const cleanup = () => clearInterval(heartbeat);
  const write = (payload) => {
    if (ended || response.writableEnded || response.destroyed) return false;
    try {
      response.write(`data: ${JSON.stringify(payload)}\n\n`);
      return true;
    } catch {
      controller.abort();
      return false;
    }
  };
  const finish = (payload) => {
    if (ended) return;
    write({ type: 'done', message: payload });
    ended = true;
    cleanup();
    response.end();
  };
  const fail = (code = 'AI_STREAM_ERROR') => {
    if (ended) return;
    write({ type: 'error', code: String(code).slice(0, 80) });
    ended = true;
    cleanup();
    response.end();
  };
  if (typeof response.once === 'function') {
    response.once('close', () => {
      if (!ended) controller.abort();
      cleanup();
    });
  }
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();
  return {
    signal: controller.signal,
    writeDelta(text) { return write({ type: 'delta', text: String(text || '') }); },
    finish,
    fail,
    close() { ended = true; cleanup(); if (!response.writableEnded) response.end(); },
  };
}

export function writeSseResponse(response, payload, text = '') {
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();
  if (text) response.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
  response.write(`data: ${JSON.stringify({ type: 'done', message: payload })}\n\n`);
  response.end();
}
