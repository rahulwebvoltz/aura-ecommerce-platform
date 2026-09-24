import { useEffect, useState, useSyncExternalStore } from 'react';

/** Returns `value` once it has stopped changing for `delay` milliseconds. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debounced;
}

/** Sets the document title while the component is mounted. */
export function useDocumentTitle(title: string | undefined): void {
  useEffect(() => {
    document.title = title === undefined ? 'Aura - Curated goods' : `${title} · Aura`;
  }, [title]);
}

/** Tracks whether the page has scrolled past `offset` pixels. */
export function useScrolled(offset = 8): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > offset);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
    };
  }, [offset]);

  return scrolled;
}

/** Runs `handler` when the user presses ⌘K / Ctrl+K. */
export function useCommandShortcut(handler: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handler]);
}

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** Whether the browser currently has a network connection. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeToConnection, () => navigator.onLine);
}
