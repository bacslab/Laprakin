export async function* parseSseEvents(readable) {
  const reader = readable?.getReader?.();
  const chunks = reader
    ? (async function* readChunks() { try { while (true) { const next = await reader.read(); if (next.done) break; yield next.value; } } finally { reader.releaseLock?.(); } }())
    : readable;
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines = [];
  const emit = function* emitEvent() {
    if (!dataLines.length) return;
    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') { yield { type: 'done' }; return; }
    try {
      const event = JSON.parse(data);
      if (event && typeof event === 'object' && event.type) yield event;
    } catch { /* Ignore an incomplete or malformed provider frame. */ }
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
  if (buffer) {
    for (const line of buffer.split(/\r?\n/)) {
      if (!line) { yield* emit(); continue; }
      if (!line.startsWith(':') && line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
  }
  yield* emit();
}
