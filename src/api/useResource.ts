import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./client";

export interface AsyncResource<T> {
  data: T | undefined;
  error: ApiError | undefined;
  isLoading: boolean;
  reload: () => Promise<void>;
  setData: (updater: T | ((prev: T | undefined) => T)) => void;
}

/**
 * Minimal SWR-style resource hook. Re-runs `loader` whenever any item in `deps`
 * changes (or when consumers call `reload`). Keeps the previous value visible
 * while refetching to avoid flicker. Errors surface via `error` and reset on
 * the next successful load.
 *
 * Skipped a third-party query lib for OME-90 to keep the dependency footprint
 * zero; can be swapped for SWR or TanStack Query later without changing the
 * store's public surface.
 */
export function useResource<T>(
  loader: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: { enabled?: boolean; initialData?: T } = {}
): AsyncResource<T> {
  const { enabled = true, initialData } = options;
  const [data, setDataState] = useState<T | undefined>(initialData);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await loaderRef.current();
      setDataState(next);
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError(String(cause), 0));
    } finally {
      setIsLoading(false);
    }
    // deps captured by the effect below; the callback only depends on the ref.
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    loaderRef
      .current()
      .then((next) => {
        if (cancelled) return;
        setDataState(next);
        setError(undefined);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof ApiError ? cause : new ApiError(String(cause), 0));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback<AsyncResource<T>["setData"]>((updater) => {
    setDataState((prev) =>
      typeof updater === "function" ? (updater as (p: T | undefined) => T)(prev) : updater
    );
  }, []);

  return { data, error, isLoading, reload: run, setData };
}
