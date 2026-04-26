/** Exponential backoff retry for flaky networks (e.g. mobile data). */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError;
}

/** Best-effort connectivity (navigator + lightweight fetch). */
export async function isNetworkAvailable(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  try {
    await fetch('https://www.google.com/favicon.ico', {
      mode: 'no-cors',
      cache: 'no-cache',
    });
    return true;
  } catch {
    return false;
  }
}
