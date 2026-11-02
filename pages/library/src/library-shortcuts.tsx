import { useEffect, useRef, useState } from 'react';

import './workspace-navigation.css';

const SHORTCUTS_KEY = 'capture-library-shortcuts-enabled';
const LibraryShortcuts = () => {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(SHORTCUTS_KEY) !== 'false';
    } catch {
      return true;
    }
  });
  const [error, setError] = useState('');
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
      )
        return;
      if (event.key === 'Escape' && open) {
        event.preventDefault();
        setOpen(false);
        toggle.current?.focus();
        return;
      }
      if (!enabled) return;
      if (event.key === '?' && !event.repeat) {
        event.preventDefault();
        setOpen(previous => !previous);
      } else if (event.key === '/' && !event.shiftKey) {
        const search = document.querySelector<HTMLInputElement>('.library-search input');
        if (search) {
          event.preventDefault();
          search.focus();
        }
      } else if ((event.key === 'j' || event.key === 'k') && !event.shiftKey) {
        const cards = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.library-card'));
        if (!cards.length) return;
        event.preventDefault();
        const current = cards.findIndex(card => card === document.activeElement);
        const next =
          current < 0
            ? event.key === 'j'
              ? 0
              : cards.length - 1
            : Math.max(0, Math.min(cards.length - 1, current + (event.key === 'j' ? 1 : -1)));
        cards[next].focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [open, enabled]);
  return (
    <div className="library-shortcuts">
      <button
        ref={toggle}
        aria-expanded={open}
        aria-controls="library-shortcut-help"
        onClick={() => setOpen(previous => !previous)}>
        Keyboard shortcuts
      </button>
      {open && (
        <section id="library-shortcut-help" aria-label="Library keyboard shortcuts" className="shortcut-help">
          <p>
            <kbd>/</kbd> Focus search · <kbd>j</kbd> Next capture · <kbd>k</kbd> Previous capture · <kbd>Enter</kbd>{' '}
            Open focused capture
          </p>
          <p>
            <kbd>?</kbd> Toggle this help · <kbd>Esc</kbd> Close help
          </p>
          <p className="library-muted">Shortcuts are paused while typing or choosing an option.</p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={enabled}
              onChange={event => {
                setEnabled(event.target.checked);
                setError('');
                try {
                  localStorage.setItem(SHORTCUTS_KEY, String(event.target.checked));
                } catch {
                  setError('This shortcut preference applies to this page only because it could not be saved.');
                }
              }}
            />
            Enable single-key shortcuts
          </label>
          {error && <p role="alert">{error}</p>}
        </section>
      )}
    </div>
  );
};

export { LibraryShortcuts };
