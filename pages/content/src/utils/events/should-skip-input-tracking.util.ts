/**
 * Checks if an input should be skipped for tracking (e.g. button, password).
 * @param {HTMLElement} target
 * @returns {boolean}
 */
export const shouldSkipInputTracking = (target: HTMLElement): boolean => {
  const inputType = target.getAttribute('type')?.toLowerCase() || '';
  const skipInputTypes = ['button', 'submit', 'reset'];

  return skipInputTypes.includes(inputType);
};
