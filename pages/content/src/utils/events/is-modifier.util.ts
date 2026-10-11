const MOD_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift', 'AltGraph']);

/**
 * Checks if a key is a modifier (Control, Meta, Alt, Shift, or AltGraph).
 * @param k - KeyboardEvent.key value.
 * @returns True if the key is a modifier; otherwise false.
 */
export const isModifier = (k?: string | null): boolean => (typeof k === 'string' ? MOD_KEYS.has(k) : false);
