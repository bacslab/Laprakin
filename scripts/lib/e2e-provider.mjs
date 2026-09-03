import http from 'node:http';
import { once } from 'node:events';

export async function startE2eProvider({ host = '127.0.0.1', port = 0 } = {}) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    requests.push({ method: request.method, path: request.url });
    for await (const _chunk of request) { /* drain without retaining user content */ }

    if (request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({
        data: [{
          id: 'laprakin-e2e-model',
          context_length: 128000,
          supportsVision: true,
          supportsReasoning: true,
          supportsStructuredOutput: true,
        }],
      }));
      return;
    }

    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'E2E_PROVIDER_OUTAGE', message: 'Synthetic provider unavailable.' } }));
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found.' } }));
  });
  server.listen(port, host);
  await once(server, 'listening');
  const address = server.address();
  const selectedPort = typeof address === 'object' && address ? address.port : port;
  return {
    baseUrl: `http://${host}:${selectedPort}/v1`,
    host,
    port: selectedPort,
    requests,
    async close() {
      if (!server.listening) return;
      server.close();
      await once(server, 'close');
    },
  };
}
