import { useEffect, useState } from "react";

/**
 * `value`, but only once it has stopped changing for `delayMs` — so typing
 * "120" asks the API once for 120 zł, not for 1, 12 and 120.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
