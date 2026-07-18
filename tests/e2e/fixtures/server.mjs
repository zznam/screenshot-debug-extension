/* global process */
import { createServer } from 'node:http';

import { createHelperServer } from '../../../packages/ai-helper/dist/server.js';

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

const aiHelper = createHelperServer({
  apiKey: 'e2e-key',
  model: 'gpt-5.6-terra',
  pairingToken: 'e2e-pair-token',
  createResponse: async body => ({
    text: `Mock diagnosis for ${body.context.sourceTitle} with ${body.context.records.length} records.`,
    model: 'gpt-5.6-terra',
  }),
});

aiHelper.listen(43124, '127.0.0.1');

const shutdown = () => {
  server.close();
  aiHelper.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
