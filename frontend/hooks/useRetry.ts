/**
 * React hook for retrying async operations
 */
import { RetryOptions, retry } from "@/lib/retry";
import { useCallback, useState } from "react";

export function useRetry<T>(options: RetryOptions = {}): {
  execute: (fn: () => Promise<T>) => Promise<T>;
  isRetrying: boolean;
  attempt: number;
} {
  const [isRetrying, setIsRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T> => {
      setIsRetrying(true);
      setAttempt(0);

      try {
        return await retry(fn, {
          ...options,
          onRetry: (currentAttempt, error) => {
            setAttempt(currentAttempt);
            options.onRetry?.(currentAttempt, error);
          },
        });
      } finally {
        setIsRetrying(false);
        setAttempt(0);
      }
    },
    [options]
  );

  return { execute, isRetrying, attempt };
}
