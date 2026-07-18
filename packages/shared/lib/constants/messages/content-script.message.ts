export const CONTENT_SCRIPT = {
  PING: 'CONTENT_SCRIPT:PING',
} as const;

export type ContentScriptMsg = (typeof CONTENT_SCRIPT)[keyof typeof CONTENT_SCRIPT];
