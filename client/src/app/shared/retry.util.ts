import { HttpErrorResponse } from '@angular/common/http';

// status === 0 means the request never reached the server (offline, DNS
// failure, timeout, CORS...) - a real response from the server, even an
// error one, means the connection is fine and retrying would not help.
export function isConnectivityError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && err.status === 0;
}

/**
 * Runs the task again, up to `attempts` times in all and `delayMs` apart, as
 * long as it keeps failing because the connection dropped - a flaky network
 * gets a chance to recover instead of failing on the first lost request. Any
 * other error is thrown straight away, as is the last connectivity one.
 */
export async function retryOnConnectivityError<T>(
  task: () => Promise<T>,
  attempts = 4,
  delayMs = 2000,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (err) {
      if (attempt >= attempts || !isConnectivityError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
