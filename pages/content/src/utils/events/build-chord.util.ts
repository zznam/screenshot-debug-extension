import { isModifier } from './is-modifier.util';

/**
 * Builds a normalized shortcut chord (e.g., "Ctrl+Meta+K") or null for bare modifiers.
 * Uppercases single-letter base keys, normalizes space keys, and preserves named keys (Enter, Escape, ArrowLeft, etc.).
 * @param e - Keyboard event to inspect.
 * @returns The chord string, or null if only a modifier was pressed or event is invalid.
 */
export const buildChord = (e?: KeyboardEvent | null): string | null => {
  if (!e || typeof e.key !== 'string' || !e.key) return null;

  // ignore bare modifiers
  if (isModifier(e.key)) return null;

  const parts: string[] = [];

  if (e.ctrlKey) parts.push('Ctrl');
  if (e.metaKey) parts.push('Meta');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = e.key;
  if (key === ' ' || key === 'Spacebar') {
    key = 'Space';
  } else if (key.length === 1) {
    key = key.toUpperCase();
  }

  parts.push(key);

  return parts.join('+');
};
