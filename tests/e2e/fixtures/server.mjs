import { createServer } from 'node:http';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Screenshot & Debug Test Page</title>
  </head>
  <body>
    <main>
      <h1>Capture target</h1>
      <button id="interaction">Test interaction</button>
      <div style="height: 1400px; background: linear-gradient(#fff, #dbeafe)"></div>
    </main>
  </body>
</html>`;

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  response.end(html);
});

server.listen(4174, '127.0.0.1');

const aiHelper = createServer((request, response) => {
  const origin = request.headers.origin;
  const headers = {
    'content-type': 'application/json',
    'access-control-allow-origin': origin ?? '',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  };

  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers);
    response.end();
    return;
  }

  if (request.url === '/health') {
    response.writeHead(200, headers);
    response.end(JSON.stringify({ status: 'ok', keyConfigured: true, model: 'gpt-5.6-terra' }));
    return;
  }

  if (request.url === '/v1/debug/responses' && request.headers.authorization === 'Bearer e2e-pair-token') {
    const chunks = [];
    request.on('data', chunk => chunks.push(chunk));
    request.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      response.writeHead(200, headers);
      response.end(
        JSON.stringify({
          status: 'success',
          message: {
            id: 'mock-assistant-message',
            role: 'assistant',
            content: `Mock diagnosis for ${body.context.sourceTitle} with ${body.context.records.length} records.`,
            createdAt: Date.now(),
          },
          model: 'gpt-5.6-terra',
        }),
      );
    });
    return;
  }

  response.writeHead(401, headers);
  response.end(JSON.stringify({ status: 'error', code: 'PAIRING_REQUIRED', message: 'Invalid pairing token.' }));
});

aiHelper.listen(43123, '127.0.0.1');

const shutdown = () => {
  server.close();
  aiHelper.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
