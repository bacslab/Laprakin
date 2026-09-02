import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

function storageDouble() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test('non-SSE mutation response is parsed without a second fetch', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-api-stream-'));
  const output = path.join(sandbox, 'api.mjs');
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const calls = [];
  const payload = { session: { id: 's1' }, messages: [] };
  try {
    globalThis.window = { screen: { width: 1440, height: 900, colorDepth: 24 }, devicePixelRatio: 1 };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform: 'test', hardwareConcurrency: 4, maxTouchPoints: 0 } });
    globalThis.localStorage = storageDouble();
    globalThis.sessionStorage = storageDouble();
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    await build({
      entryPoints: [path.resolve(import.meta.dirname, '../src/api.js')],
      outfile: output,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      define: { 'import.meta.env.VITE_API_URL': '"/api"' },
    });
    const { apiStream } = await import(`${new URL(`file:///${output.replaceAll('\\', '/')}`).href}?v=${Date.now()}`);
    const result = await apiStream('/chat/sessions/s1/messages', {
      method: 'POST',
      body: { content: 'Satu aksi', requestId: 'req-contract-1234' },
      requestId: 'req-contract-1234',
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(result, payload);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
    await rm(sandbox, { recursive: true, force: true });
  }
});

test('an incomplete stream recovers with a read-only snapshot and never reposts the mutation', async () => {
  const sandbox = await mkdtemp(path.join(os.tmpdir(), 'laprakin-api-stream-recovery-'));
  const output = path.join(sandbox, 'api.mjs');
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalLocalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const calls = [];
  const canonical = { session: { id: 's1' }, messages: [{ role: 'assistant', content: 'Selesai' }] };
  try {
    globalThis.window = { screen: { width: 1440, height: 900, colorDepth: 24 }, devicePixelRatio: 1 };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform: 'test', hardwareConcurrency: 4, maxTouchPoints: 0 } });
    globalThis.localStorage = storageDouble();
    globalThis.sessionStorage = storageDouble();
    globalThis.fetch = async (url, options) => {
      calls.push({ url, options });
      if (String(url).includes('/mutations/')) {
        return new Response(JSON.stringify({ state: 'completed', response: canonical }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('data: {"type":"delta","text":"Sebagian"}\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    };
    await build({
      entryPoints: [path.resolve(import.meta.dirname, '../src/api.js')],
      outfile: output,
      bundle: true,
      format: 'esm',
      platform: 'browser',
      define: { 'import.meta.env.VITE_API_URL': '"/api"' },
    });
    const { apiStream } = await import(`${new URL(`file:///${output.replaceAll('\\', '/')}`).href}?v=${Date.now()}`);
    const result = await apiStream('/chat/sessions/s1/messages', {
      method: 'POST',
      body: { content: 'Satu aksi', requestId: 'req-contract-1234' },
      requestId: 'req-contract-1234',
    });
    assert.deepEqual(result, canonical);
    assert.equal(calls.filter((call) => call.options.method === 'POST').length, 1);
    assert.equal(calls.filter((call) => call.options.method === 'GET').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
    globalThis.localStorage = originalLocalStorage;
    globalThis.sessionStorage = originalSessionStorage;
    await rm(sandbox, { recursive: true, force: true });
  }
});
