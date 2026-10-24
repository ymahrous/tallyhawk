import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data for an admin view and reloads whenever `key` changes (e.g. a serialised filter set).
 * A slower, older request can't overwrite a newer one's result.
 */
export function useAdminData<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  // The latest `load` (it closes over the current filters). Updated in an effect, which runs before
  // the reload effect below in the same commit.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError("");
    try {
      const result = await loadRef.current();
      if (request === latest.current) setData(result);
    } catch (err) {
      if (request === latest.current) setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [key, reload]);

  return { data, setData, error, loading, reload };
}
