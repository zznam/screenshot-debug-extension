import { sanitizeRecord, sanitizeText } from '@extension/shared';
import type { AiDebugSession } from '@extension/shared';

interface SessionExportOptions {
  messageIds: string[];
  includeContext: boolean;
}

// Explicitly project the chosen fields: screenshots, tab IDs, credentials and
// unselected messages must never hitch a ride in a serialized session object.
const sessionExport = (session: AiDebugSession, options: SessionExportOptions) => {
  const selected = new Set(options.messageIds);
  return {
    version: 1,
    title: sanitizeText(session.context.sourceTitle),
    messages: session.messages
      .filter(message => selected.has(message.id))
      .map(message => ({
        role: message.role,
        content: sanitizeText(message.content),
        createdAt: message.createdAt,
      })),
    ...(options.includeContext
      ? {
          context: {
            sourceUrl: sanitizeText(session.context.sourceUrl),
            capturedAt: session.context.capturedAt,
            records: session.context.records.map(sanitizeRecord),
            recordsTruncated: session.context.recordsTruncated,
          },
        }
      : {}),
  };
};

const markdownText = (text: string) => text.replace(/([\\`*_[\]<>#])/g, '\\$1');
const sessionMarkdown = (session: AiDebugSession, options: SessionExportOptions) => {
  const data = sessionExport(session, options);
  return (
    [
      `# ${markdownText(data.title).replace(/[\r\n]+/g, ' ') || 'AI Debug session'}`,
      ...data.messages.map(
        message => `## ${message.role === 'user' ? 'You' : 'AI assistant'}\n\n${markdownText(message.content)}`,
      ),
      ...(data.context ? ['## Selected context', markdownText(JSON.stringify(data.context, null, 2))] : []),
    ].join('\n\n') + '\n'
  );
};

const downloadSession = (text: string, format: 'json' | 'md') => {
  const url = URL.createObjectURL(new Blob([text], { type: format === 'json' ? 'application/json' : 'text/markdown' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ai-debug-session.${format}`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
};

export { sessionExport, sessionMarkdown, downloadSession };
export type { SessionExportOptions };
