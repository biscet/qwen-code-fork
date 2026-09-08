import { useCallback, useEffect, useRef, useState } from 'react';
import type { CodexAccountState, DaemonClient } from '@qwen-code/sdk/daemon';

export function useCodexAccount(
  client: DaemonClient | undefined,
  visible: boolean,
) {
  const [state, setState] = useState<CodexAccountState>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const mutationPending = useRef(false);
  const refresh = useCallback(async () => {
    if (!client?.codexAccount) return;
    const request = generation.current;
    try {
      const next = await client.codexAccount();
      if (generation.current !== request) return;
      setState((current) =>
        current?.updatedAt &&
        next.updatedAt &&
        current.updatedAt > next.updatedAt
          ? current
          : next,
      );
      setError('');
    } catch (cause) {
      if (generation.current === request)
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [client]);
  useEffect(() => {
    generation.current += 1;
    setState(undefined);
    setError('');
    void refresh();
    setBusy(false);
    mutationPending.current = false;
    let disposed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let delay = 1000;
    const subscribe = () => {
      unsubscribe = client?.subscribeCodexEvents?.({
        onEvent: (event) => {
          if (disposed) return;
          delay = 1000;
          setState(event.state);
          setError('');
        },
        onError: () => {
          if (disposed) return;
          retry = setTimeout(() => {
            void refresh();
            subscribe();
          }, delay);
          delay = Math.min(30_000, delay * 2);
        },
      });
    };
    subscribe();
    return () => {
      disposed = true;
      generation.current += 1;
      clearTimeout(retry);
      unsubscribe?.();
    };
  }, [client, refresh]);
  useEffect(() => {
    if (!visible) return;
    const update = () => {
      if (document.visibilityState !== 'hidden') void refresh();
    };
    update();
    const interval = setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, [visible, refresh]);
  const run = useCallback(
    async (action: 'startCodexLogin' | 'cancelCodexLogin' | 'logoutCodex') => {
      if (!client || mutationPending.current) return;
      const request = ++generation.current;
      mutationPending.current = true;
      setBusy(true);
      setError('');
      try {
        const next = await client[action]();
        if (generation.current !== request) return;
        setState(next);
        return next;
      } catch (cause) {
        if (generation.current === request)
          setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (generation.current === request) {
          mutationPending.current = false;
          setBusy(false);
        }
      }
    },
    [client],
  );
  const resetLimits = useCallback(
    async (idempotencyKey: string) => {
      if (!client || mutationPending.current) return;
      const request = ++generation.current;
      mutationPending.current = true;
      setBusy(true);
      setError('');
      try {
        const result = await client.resetCodexLimits(idempotencyKey);
        if (generation.current !== request) return;
        setState(result.state);
        return result;
      } catch (cause) {
        if (generation.current === request)
          setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (generation.current === request) {
          mutationPending.current = false;
          setBusy(false);
        }
      }
    },
    [client],
  );
  return { state, error, busy, refresh, run, resetLimits };
}

export type CodexAccountControls = ReturnType<typeof useCodexAccount>;
