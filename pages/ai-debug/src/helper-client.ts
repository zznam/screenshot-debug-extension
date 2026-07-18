import type { AiDebugSession, AiHelperError, AiHelperResponse, AiHelperResponseRequest } from '@extension/shared';

export const HELPER_URL = 'http://127.0.0.1:43123';
export const PAIRING_TOKEN_KEY = 'ai-debug-helper-pairing-token';

export type HelperState = 'checking' | 'offline' | 'missing-key' | 'unpaired' | 'ready';

export const readPairingToken = async (): Promise<string> => {
  const stored = await chrome.storage.local.get(PAIRING_TOKEN_KEY);
  return typeof stored[PAIRING_TOKEN_KEY] === 'string' ? stored[PAIRING_TOKEN_KEY] : '';
};

export const savePairingToken = async (token: string): Promise<void> => {
  await chrome.storage.local.set({ [PAIRING_TOKEN_KEY]: token.trim() });
};

export const checkHelper = async (): Promise<{ state: HelperState; model?: string }> => {
  try {
    const response = await fetch(`${HELPER_URL}/health`);
    if (!response.ok) return { state: 'offline' };
    const data = (await response.json()) as { keyConfigured?: boolean; model?: string };
    if (!data.keyConfigured) return { state: 'missing-key', model: data.model };
    const token = await readPairingToken();
    return { state: token ? 'ready' : 'unpaired', model: data.model };
  } catch {
    return { state: 'offline' };
  }
};

export const requestAiResponse = async (session: AiDebugSession): Promise<AiHelperResponse> => {
  const token = await readPairingToken();
  const body: AiHelperResponseRequest = {
    sessionId: session.id,
    messages: session.messages,
    context: session.context,
  };
  const response = await fetch(`${HELPER_URL}/v1/debug/responses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = (await response.json()) as AiHelperResponse | AiHelperError;
  if (result.status === 'error') throw new Error(result.message || 'The AI helper request failed.');
  if (!response.ok) throw new Error('The AI helper request failed.');
  return result;
};
