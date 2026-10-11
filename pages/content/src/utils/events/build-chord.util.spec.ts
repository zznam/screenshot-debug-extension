import { describe, expect, it } from 'vitest';

import { buildChord } from './build-chord.util';
import { isModifier } from './is-modifier.util';

describe('isModifier', () => {
  it('returns true for all modifier keys including AltGraph', () => {
    expect(isModifier('Control')).toBe(true);
    expect(isModifier('Meta')).toBe(true);
    expect(isModifier('Alt')).toBe(true);
    expect(isModifier('Shift')).toBe(true);
    expect(isModifier('AltGraph')).toBe(true);
  });

  it('returns false for non-modifier keys and invalid inputs', () => {
    expect(isModifier('a')).toBe(false);
    expect(isModifier('Enter')).toBe(false);
    expect(isModifier('')).toBe(false);
    expect(isModifier(null)).toBe(false);
    expect(isModifier(undefined)).toBe(false);
  });
});

describe('buildChord', () => {
  it('returns null for bare modifier keys', () => {
    const event = { key: 'Control', ctrlKey: true } as KeyboardEvent;
    expect(buildChord(event)).toBeNull();

    const shiftEvent = { key: 'Shift', shiftKey: true } as KeyboardEvent;
    expect(buildChord(shiftEvent)).toBeNull();

    const altGraphEvent = { key: 'AltGraph' } as KeyboardEvent;
    expect(buildChord(altGraphEvent)).toBeNull();
  });

  it('formats single letter shortcuts with modifiers and uppercases base key', () => {
    const event = {
      key: 'k',
      ctrlKey: true,
      metaKey: false,
      altKey: false,
      shiftKey: false,
    } as KeyboardEvent;
    expect(buildChord(event)).toBe('Ctrl+K');
  });

  it('combines multiple modifiers in order', () => {
    const event = {
      key: 'p',
      ctrlKey: true,
      metaKey: true,
      altKey: true,
      shiftKey: true,
    } as KeyboardEvent;
    expect(buildChord(event)).toBe('Ctrl+Meta+Alt+Shift+P');
  });

  it('normalizes Space and Spacebar', () => {
    const spaceEvent = {
      key: ' ',
      ctrlKey: true,
    } as KeyboardEvent;
    expect(buildChord(spaceEvent)).toBe('Ctrl+Space');

    const spacebarEvent = {
      key: 'Spacebar',
      ctrlKey: true,
    } as KeyboardEvent;
    expect(buildChord(spacebarEvent)).toBe('Ctrl+Space');
  });

  it('preserves multi-character named keys without uppercasing', () => {
    const enterEvent = {
      key: 'Enter',
      ctrlKey: true,
    } as KeyboardEvent;
    expect(buildChord(enterEvent)).toBe('Ctrl+Enter');

    const arrowEvent = {
      key: 'ArrowDown',
      altKey: true,
    } as KeyboardEvent;
    expect(buildChord(arrowEvent)).toBe('Alt+ArrowDown');

    const f12Event = {
      key: 'F12',
    } as KeyboardEvent;
    expect(buildChord(f12Event)).toBe('F12');
  });

  it('handles empty, null, or undefined events gracefully', () => {
    expect(buildChord(null)).toBeNull();
    expect(buildChord(undefined)).toBeNull();
    expect(buildChord({} as KeyboardEvent)).toBeNull();
    expect(buildChord({ key: '' } as KeyboardEvent)).toBeNull();
  });
});
