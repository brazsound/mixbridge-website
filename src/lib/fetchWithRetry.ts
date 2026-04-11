/**
 * Wraps fetch with automatic retries on network failure.
 * HTTP errors (4xx / 5xx) are NOT retried — only thrown network errors are.
 * Retries use linear back-off: 1 s, 2 s, 3 s …
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, attempt * 1000));
    }
    try {
      return await fetch(input, init);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}
