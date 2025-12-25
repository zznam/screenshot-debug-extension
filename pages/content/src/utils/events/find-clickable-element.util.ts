import { isClickableElement } from './element-clickable.util';
import { findReactProp } from './find-react-prop.util';

/**
 * Traverses up to a fixed depth from a DOM element to find the closest clickable parent.
 *
 * A clickable parent is defined as:
 * - An element that passes `isClickableElement()`
 * - Optionally, an element backed by a React event prop (but returns the DOM element, not the prop)
 *
 * @param element - The starting DOM element (e.g., from an event target)
 * @param maxDepth - Maximum number of parent levels to search (default: 5)
 * @returns The first clickable HTMLElement found, or null if none found
 */
export const findClickableParent = (element: HTMLElement | null, maxDepth: number = 5): HTMLElement | null => {
  let current = element?.parentElement ?? null;
  let depth = 0;

  while (current && depth < maxDepth) {
    if (isClickableElement(current)) {
      // Check for React synthetic props but still return the DOM node
      const reactProp = findReactProp(current);

      return reactProp ? (current as any)[reactProp] : current; // Return the first clickable ancestor found
    }

    current = current.parentElement;
    depth++;
  }

  return null;
};
