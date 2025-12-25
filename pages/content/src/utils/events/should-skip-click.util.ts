/**
 * Determines whether a click event should be skipped from tracking.
 *
 * Skips clicks that occur on:
 * 1. Editable form elements (e.g., input, textarea, contenteditable)
 * 2. Elements inside decorated input wrappers (e.g., icons, labels, wrappers around inputs)
 *
 * @param {HTMLElement} target - The element that was clicked.
 * @returns {boolean} True if the click should be skipped; otherwise, false.
 */
export const shouldSkipClick = (target: HTMLElement): boolean => {
  const tagName = target.tagName.toUpperCase();
  const inputType = target.getAttribute('type')?.toLowerCase();

  // Skip native checkboxes/radios
  if (tagName === 'INPUT' && ['checkbox', 'radio'].includes(inputType || '')) {
    return true;
  }

  // Skip custom toggles (role-based)
  const role = target.getAttribute('role');
  if (['checkbox', 'switch'].includes(role || '')) {
    return true;
  }

  // Skip body
  if (tagName === 'BODY') return true;

  // Skip editable inputs
  const isEditable =
    tagName === 'TEXTAREA' ||
    (tagName === 'INPUT' && !['button', 'submit', 'reset'].includes(inputType || '')) ||
    target.getAttribute('contenteditable') === 'true';

  if (isEditable) return true;

  // Skip clicks inside decorated input wrappers
  const inputWrapper = target.closest('label, .input-wrapper, .input-icon, .form-field');
  const isInsideInputWrapper = inputWrapper?.querySelector('input, textarea, [contenteditable="true"]');

  if (isInsideInputWrapper) return true;

  return false;
};
