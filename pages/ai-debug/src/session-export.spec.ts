import { describe, expect, it, vi } from 'vitest';

import type { AiDebugSession } from '@extension/shared';

import { sessionExport, sessionMarkdown } from './session-export';

vi.mock('@extension/shared', async () => import('../../../packages/shared/lib/utils/review-sanitization'));

const session: AiDebugSession = {
  id: 'private-session-id',
  createdAt: 1,
  updatedAt: 2,
  status: 'ready',
  model: 'model',
  messages: [
    { id: 'a', role: 'user', content: 'Investigate alice@example.com and token=private-token', createdAt: 1 },
    { id: 'b', role: 'assistant', content: 'UNSELECTED PRIVATE ANSWER', createdAt: 2 },
  ],
  context: {
    sourceId: 'private-source-id',
    sourceTabId: 99,
    sourceTitle: 'Checkout',
    sourceUrl: 'https://localhost/order?token=url-secret',
    capturedAt: 1,
    screenshotDataUrl: 'data:image/png;base64,PRIVATE_PIXELS',
    records: [{ password: 'secret-password', message: 'alice@example.com' }],
    recordsTruncated: true,
  },
};
describe('selected AI session export', () => {
  it('excludes context, images, identifiers and unselected messages by default', () => {
    const output = sessionExport(session, { messageIds: ['a'], includeContext: false });
    expect(output.messages).toHaveLength(1);
    expect(output).not.toHaveProperty('context');
    expect(JSON.stringify(output)).not.toMatch(
      /private-token|alice@example.com|UNSELECTED|PRIVATE_PIXELS|private-session|private-source|url-secret|secret-password/,
    );
    expect(session.messages[0].content).toContain('private-token');
  });
  it('redacts explicitly selected context even for localhost and never includes pixels', () => {
    const output = sessionExport(session, { messageIds: [], includeContext: true });
    expect(output.context?.recordsTruncated).toBe(true);
    expect(output.context?.records).toHaveLength(1);
    expect(JSON.stringify(output)).not.toMatch(
      /PRIVATE_PIXELS|url-secret|secret-password|alice@example.com|sourceTabId|sourceId/,
    );
  });
  it('preserves conversation order, deduplicates selections and ignores unknown message IDs', () => {
    const output = sessionExport(session, { messageIds: ['b', 'a', 'b', 'unknown'], includeContext: false });
    expect(output.messages.map(message => message.role)).toEqual(['user', 'assistant']);
  });
  it('escapes untrusted Markdown instead of embedding tracking images or HTML', () => {
    const modified = {
      ...session,
      context: { ...session.context, sourceTitle: '# Title\nInjected heading' },
      messages: [{ ...session.messages[0], content: '![tracker](https://example.com/pixel) <script>bad()</script>' }],
    };
    const output = sessionMarkdown(modified, { messageIds: ['a'], includeContext: true });
    expect(output).toContain('!\\[tracker\\]');
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('\nInjected heading');
    expect(output).toContain('## Selected context');
  });
});
