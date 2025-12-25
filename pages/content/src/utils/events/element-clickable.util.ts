import { CLICKABLE_TAGS } from '@src/constants';

/**
 * Determines whether a given element is considered clickable.
 *
 * This includes:
 * - Native interactive elements like <a>, <button>, <input>
 * - Elements with specific roles like 'button', 'link', 'option'
 * - Elements with a tabindex or a click handler
 * - Elements with a 'cursor-pointer' class
 *
 * @param element - The element to check.
 * @returns True if the element is considered clickable, false otherwise.
 */
export const isClickableElement = (element: HTMLElement | null): boolean => {
  if (!element) return false;

  const hasRole = element instanceof HTMLElement && element?.getAttribute('role');
  const hasOnClick = typeof (element as any).onclick === 'function';

  return (
    CLICKABLE_TAGS.includes(element.tagName) ||
    (element instanceof HTMLElement && element.hasAttribute('tabindex')) ||
    ['button', 'link', 'option'].includes(hasRole || '') ||
    element?.classList?.contains('cursor-pointer') ||
    hasOnClick
  );
};
