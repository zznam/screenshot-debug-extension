import { useCallback, useEffect, useRef } from 'react';

/** Protect in-memory work when an extension page is closed, reloaded or navigated away from. */
export const useUnsavedChanges = (dirty: boolean) => {
  const listener = useRef<((event: BeforeUnloadEvent) => void) | null>(null);
  const allowNavigation = useCallback(() => {
    if (listener.current) window.removeEventListener('beforeunload', listener.current);
    listener.current = null;
  }, []);
  useEffect(() => {
    if (!dirty) return;
    listener.current = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', listener.current);
    return allowNavigation;
  }, [allowNavigation, dirty]);
  return allowNavigation;
};
