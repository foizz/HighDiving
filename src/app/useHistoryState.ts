import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State that is also a browser history entry, so the back button walks back through
 * the pages the user has seen instead of leaving the app.
 *
 * Each hook owns one key of `history.state`. A change pushes a new entry carrying every
 * other key unchanged; `reset` starts the entry from scratch, which is how switching tab
 * forgets the sub-page a tab had open. On back or forward each mounted hook reads its key
 * from the restored entry, and a hook mounted afterwards reads it on mount, so a screen
 * that only appears because of the restored tab still opens on the right sub-page.
 *
 * Values must survive structured cloning: plain data, no functions.
 */
export function useHistoryState<T>(key: string, initial: T) {
  const initialRef = useRef(initial);
  const [value, setValue] = useState<T>(() => read(key, initial));

  useEffect(() => {
    function onPop(event: PopStateEvent) {
      setValue((event.state?.[key] as T | undefined) ?? initialRef.current);
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [key]);

  const update = useCallback(
    (next: T, options: { replace?: boolean; reset?: boolean } = {}) => {
      setValue(next);
      const current = window.history.state ?? {};
      if (!options.replace && Object.is(current[key] ?? initialRef.current, next)) return;
      const state = { ...(options.reset ? {} : current), [key]: next };
      try {
        if (options.replace) window.history.replaceState(state, '');
        else window.history.pushState(state, '');
      } catch {
        // Not cloneable or blocked: the page still changes, it just has no history entry.
      }
    },
    [key],
  );

  return [value, update] as const;
}

function read<T>(key: string, initial: T): T {
  try {
    return (window.history.state?.[key] as T | undefined) ?? initial;
  } catch {
    return initial;
  }
}
