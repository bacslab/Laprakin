function extractText(payload) {
  return String(payload?.choices?.[0]?.message?.content || payload?.choices?.[0]?.delta?.content || '').trim();
}

async function* responseEvents(response) {
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

export function writeSseResponse(response, payload, text = '') {
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders?.();
  if (text) response.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
  response.write(`data: ${JSON.stringify({ type: 'done', message: payload })}\n\n`);
  response.end();
}
