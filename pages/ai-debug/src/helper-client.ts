import type { AiDebugSession, AiHelperError, AiHelperResponse, AiHelperResponseRequest } from '@extension/shared';

const HELPER_URL = 'http://127.0.0.1:43123';
const PAIRING_TOKEN_KEY = 'ai-debug-helper-pairing-token';
const HELPER_URL_KEY = 'ai-debug-helper-url';
const EXTENSION_ID_HEADER = 'x-screenshot-debug-extension-id';

type HelperState = 'checking' | 'offline' | 'missing-key' | 'unpaired' | 'ready';

class HelperRequestError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HelperRequestError';
  }
}

const readHelperUrl = async (): Promise<string> => {
  const stored = await chrome.storage.local.get(HELPER_URL_KEY);
  const candidate = typeof stored[HELPER_URL_KEY] === 'string' ? stored[HELPER_URL_KEY] : HELPER_URL;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname)) {
      return parsed.origin;
    }
  } catch {
    // Fall through to the fixed safe default.
  }
  return HELPER_URL;
};

const readPairingToken = async (): Promise<string> => {
  const stored = await chrome.storage.local.get(PAIRING_TOKEN_KEY);
  return typeof stored[PAIRING_TOKEN_KEY] === 'string' ? stored[PAIRING_TOKEN_KEY] : '';
};

const savePairingToken = async (token: string): Promise<void> => {
  await chrome.storage.local.set({ [PAIRING_TOKEN_KEY]: token.trim() });
};

const checkHelper = async (): Promise<{ state: HelperState; model?: string }> => {
  try {
    const helperUrl = await readHelperUrl();
    const response = await fetch(`${helperUrl}/health`, {
      headers: { [EXTENSION_ID_HEADER]: chrome.runtime.id },
      signal: AbortSignal.timeout(5_000),
      redirect: 'error',
    });
    if (!response.ok) return { state: 'offline' };
    const data = (await response.json()) as { keyConfigured?: boolean; model?: string };
    if (!data.keyConfigured) return { state: 'missing-key', model: data.model };
    const token = await readPairingToken();
    return { state: token ? 'ready' : 'unpaired', model: data.model };
  } catch {
    return { state: 'offline' };
  }
};

const requestAiResponse = async (session: AiDebugSession, signal?: AbortSignal): Promise<AiHelperResponse> => {
  const helperUrl = await readHelperUrl();
  const token = await readPairingToken();
  const body: AiHelperResponseRequest = {
    sessionId: session.id,
    messages: session.messages,
    context: session.context,
  };
  const response = await fetch(`${helperUrl}/v1/debug/responses`, {
    method: 'POST',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(65_000)]) : AbortSignal.timeout(65_000),
    redirect: 'error',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      [EXTENSION_ID_HEADER]: chrome.runtime.id,
    },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as AiHelperResponse | AiHelperError;
  if (result.status === 'error')
    throw new HelperRequestError(result.message || 'The AI helper request failed.', result.code);
  if (!response.ok) throw new Error('The AI helper request failed.');
  return result;
};

export {
  HelperRequestError,
  checkHelper,
  HELPER_URL,
  HELPER_URL_KEY,
  PAIRING_TOKEN_KEY,
  readPairingToken,
  requestAiResponse,
  savePairingToken,
};
export type { HelperState };
