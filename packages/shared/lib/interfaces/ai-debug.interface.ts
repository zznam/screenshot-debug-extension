export type AiDebugRole = 'user' | 'assistant';

export interface AiDebugMessage {
  id: string;
  role: AiDebugRole;
  content: string;
  createdAt: number;
}

export interface AiDebugContext {
  sourceTabId: number | null;
  sourceId: string;
  sourceUrl: string;
  sourceTitle: string;
  capturedAt: number;
  screenshotDataUrl: string | null;
  records: unknown[];
  recordsTruncated: boolean;
}

export interface AiDebugSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  status: 'prepared' | 'ready' | 'error';
  context: AiDebugContext;
  messages: AiDebugMessage[];
  error?: string;
}

export interface AiDebugSessionSummary {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  updatedAt: number;
  messageCount: number;
}

export type AiDebugRequest =
  | { type: 'AI_DEBUG:START'; tabId: number }
  | { type: 'AI_DEBUG:GET_CONTEXT'; sessionId: string }
  | { type: 'AI_DEBUG:GET_SESSION'; sessionId: string }
  | { type: 'AI_DEBUG:LIST_SESSIONS' }
  | { type: 'AI_DEBUG:SAVE_MESSAGE'; sessionId: string; message: AiDebugMessage; model?: string }
  | { type: 'AI_DEBUG:DELETE_SESSION'; sessionId: string };

export type AiDebugResponse =
  | { status: 'success'; session?: AiDebugSession; sessions?: AiDebugSessionSummary[] }
  | { status: 'error'; code: string; message: string };

export interface AiHelperResponseRequest {
  sessionId: string;
  messages: AiDebugMessage[];
  context?: AiDebugContext;
}

export interface AiHelperResponse {
  status: 'success';
  message: AiDebugMessage;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

export interface AiHelperError {
  status: 'error';
  code: string;
  message: string;
}
