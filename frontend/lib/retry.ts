/**
 * Retry utility for API calls
 */

export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: "linear" | "exponential";
  onRetry?: (attempt: number, error: Error) => void;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry" | "shouldRetry">> =
  {
    maxAttempts: 3,
    delay: 1000,
    backoff: "exponential",
  };

const DEFAULT_SHOULD_RETRY = (error: Error) => {
  // Retry on network errors or 5xx errors
  if (
    error.message.includes("Network") ||
    error.message.includes("Failed to fetch")
  ) {
    return true;
  }
  if ((error as any).statusCode >= 500) {
    return true;
  }
  return false;
};

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_OPTIONS.maxAttempts,
    delay = DEFAULT_OPTIONS.delay,
    backoff = DEFAULT_OPTIONS.backoff,
    onRetry,
    shouldRetry = DEFAULT_SHOULD_RETRY,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if we've exhausted attempts or if error is not retryable
      if (attempt >= maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }

      // Calculate delay with backoff
      const currentDelay =
        backoff === "exponential"
          ? delay * Math.pow(2, attempt - 1)
          : delay * attempt;

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
    }
  }

  throw lastError!;
}
