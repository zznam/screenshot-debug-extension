import { useState } from 'react';

import type { AiDebugSession } from '@extension/shared';
import { Button } from '@extension/ui';

import { downloadSession, sessionExport, sessionMarkdown } from './session-export';

export const SessionExportPanel = ({ session }: { session: AiDebugSession }) => {
  const [messageIds, setMessageIds] = useState(() => session.messages.map(message => message.id));
  const [includeContext, setIncludeContext] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const options = { messageIds, includeContext };
  const data = sessionExport(session, options);
  const preview = JSON.stringify(data, null, 2);
  const download = (format: 'json' | 'md') => {
    try {
      setError('');
      downloadSession(format === 'json' ? preview : sessionMarkdown(session, options), format);
      setStatus('Selected conversation prepared for download.');
    } catch {
      setError('Could not prepare the download. Please try again.');
    }
  };
  return (
    <section className="ai-panel ai-export" aria-labelledby="export-title">
      <h2 id="export-title">Export selected conversation</h2>
      <p className="ai-muted">
        Choose messages and review the preview. Recognized credentials and emails are redacted. Screenshots are never
        included.
      </p>
      <fieldset>
        <legend>Messages to include</legend>
        <div className="ai-export-selection">
          {session.messages.map((message, index) => (
            <label key={message.id} className="ai-check">
              <input
                type="checkbox"
                checked={messageIds.includes(message.id)}
                onChange={event => {
                  setMessageIds(previous =>
                    event.target.checked ? [...previous, message.id] : previous.filter(id => id !== message.id),
                  );
                  setReviewed(false);
                  setStatus('');
                }}
              />
              <span>
                Message {index + 1} · {message.role === 'user' ? 'You' : 'AI assistant'}
                <span className="ai-message-excerpt">{message.content.slice(0, 120)}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="ai-check">
        <input
          type="checkbox"
          checked={includeContext}
          onChange={event => {
            setIncludeContext(event.target.checked);
            setReviewed(false);
            setStatus('');
          }}
        />
        Include source URL and diagnostics
      </label>
      <details>
        <summary>Preview selected export · {data.messages.length} messages</summary>
        <pre className="ai-export-preview">{preview}</pre>
      </details>
      <label className="ai-check">
        <input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I have
        reviewed the selected conversation
      </label>
      <div className="ai-actions">
        <Button disabled={!reviewed || !data.messages.length} onClick={() => download('md')}>
          Download Markdown
        </Button>
        <Button variant="outline" disabled={!reviewed || !data.messages.length} onClick={() => download('json')}>
          Download JSON
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
      <p role="status">{status}</p>
    </section>
  );
};
