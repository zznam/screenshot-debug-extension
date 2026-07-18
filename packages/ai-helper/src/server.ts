import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AiDebugContext, AiDebugMessage, AiHelperResponseRequest } from '@extension/shared';

const HELPER_HOST = '127.0.0.1';
const HELPER_PORT = 43123;
const MAX_BODY_BYTES = 12 * 1024 * 1024;
const EXTENSION_ID_HEADER = 'x-screenshot-debug-extension-id';
const EXTENSION_ID_PATTERN = /^[a-p]{32,64}$/;

interface HelperConfig {
  apiKey?: string;
  model: string;
  pairingToken: string;
  createResponse: (
    request: AiHelperResponseRequest,
    signal: AbortSignal,
  ) => Promise<{
    text: string;
    model?: string;
    usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  }>;
}

const extensionIdFromOrigin = (origin?: string) => {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const valid =
      parsed.protocol === 'chrome-extension:' &&
      EXTENSION_ID_PATTERN.test(parsed.hostname) &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      (parsed.pathname === '/' || parsed.pathname === '');
    return valid ? parsed.hostname : false;
  } catch {
    return false;
  }
};

const allowedOrigin = (origin: string | undefined, extensionId: string | undefined) => {
  if (!extensionId || !EXTENSION_ID_PATTERN.test(extensionId)) return false;
  if (!origin) return true;
  if (origin === 'null') return origin;
  return extensionIdFromOrigin(origin) === extensionId ? origin : false;
};

const allowedPreflightOrigin = (origin: string | undefined) =>
  origin === 'null' || Boolean(extensionIdFromOrigin(origin)) ? origin : false;

const sendJson = (response: ServerResponse, statusCode: number, body: unknown, corsOrigin?: string | boolean) => {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');
  if (typeof corsOrigin === 'string') response.setHeader('access-control-allow-origin', corsOrigin);
  response.end(JSON.stringify(body));
};

const tokenMatches = (provided: string, expected: string) => {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Debug context is too large.'), { statusCode: 413 });
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const isMessage = (value: unknown): value is AiDebugMessage => {
  const item = value as Partial<AiDebugMessage>;
  return Boolean(item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string');
};

const isContext = (value: unknown): value is AiDebugContext => {
  const context = value as Partial<AiDebugContext>;
  return Boolean(context && typeof context.sourceUrl === 'string' && Array.isArray(context.records));
};

const validatePayload = (value: unknown): AiHelperResponseRequest => {
  const payload = value as Partial<AiHelperResponseRequest>;
  if (!payload || typeof payload.sessionId !== 'string' || !Array.isArray(payload.messages)) {
    throw Object.assign(new Error('Invalid AI Debug request.'), { statusCode: 400 });
  }
  if (!payload.messages.every(isMessage) || (payload.context !== undefined && !isContext(payload.context))) {
    throw Object.assign(new Error('Invalid AI Debug context or messages.'), { statusCode: 400 });
  }
  return payload as AiHelperResponseRequest;
};

const createHelperServer = (config: HelperConfig) =>
  createServer(async (request, response) => {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;

    if (request.method === 'OPTIONS') {
      const corsOrigin = allowedPreflightOrigin(origin);
      if (!corsOrigin) {
        sendJson(response, 403, { status: 'error', code: 'ORIGIN_DENIED', message: 'Extension origin required.' });
        return;
      }
      response.statusCode = 204;
      response.setHeader('access-control-allow-origin', corsOrigin);
      response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
      response.setHeader('access-control-allow-headers', `authorization, content-type, ${EXTENSION_ID_HEADER}`);
      response.setHeader('access-control-max-age', '600');
      response.end();
      return;
    }

    const extensionIdHeader = request.headers[EXTENSION_ID_HEADER];
    const extensionId = typeof extensionIdHeader === 'string' ? extensionIdHeader : undefined;
    const corsOrigin = allowedOrigin(origin, extensionId);
    if (!corsOrigin) {
      sendJson(response, 403, { status: 'error', code: 'ORIGIN_DENIED', message: 'Extension origin required.' });
      return;
    }

    if (request.method === 'GET' && request.url === '/health') {
      sendJson(response, 200, { status: 'ok', keyConfigured: Boolean(config.apiKey), model: config.model }, corsOrigin);
      return;
    }

    if (request.method !== 'POST' || request.url !== '/v1/debug/responses') {
      sendJson(response, 404, { status: 'error', code: 'NOT_FOUND', message: 'Endpoint not found.' }, corsOrigin);
      return;
    }

    if (!config.apiKey) {
      sendJson(
        response,
        503,
        { status: 'error', code: 'MISSING_API_KEY', message: 'OPENAI_API_KEY is not set.' },
        corsOrigin,
      );
      return;
    }

    const authorization = request.headers.authorization ?? '';
    const providedToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!tokenMatches(providedToken, config.pairingToken)) {
      sendJson(
        response,
        401,
        { status: 'error', code: 'PAIRING_REQUIRED', message: 'The pairing token is invalid.' },
        corsOrigin,
      );
      return;
    }

    try {
      const payload = validatePayload(await readJsonBody(request));
      const result = await config.createResponse(payload, AbortSignal.timeout(60_000));
      sendJson(
        response,
        200,
        {
          status: 'success',
          message: { id: crypto.randomUUID(), role: 'assistant', content: result.text, createdAt: Date.now() },
          model: result.model ?? config.model,
          ...(result.usage ? { usage: result.usage } : {}),
        },
        corsOrigin,
      );
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode) || 502;
      const message = statusCode < 500 ? (error as Error).message : 'The OpenAI request failed. Try again.';
      sendJson(response, statusCode, { status: 'error', code: 'AI_REQUEST_FAILED', message }, corsOrigin);
    }
  });

export { createHelperServer, EXTENSION_ID_HEADER, HELPER_HOST, HELPER_PORT };
export type { HelperConfig };
