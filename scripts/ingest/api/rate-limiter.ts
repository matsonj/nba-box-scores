// Token-bucket rate limiter for API requests
// Singleton: shared across all workers to enforce global rate limiting

let lastRequestTime = 0;
let intervalMs = 150;

/** Set the minimum interval between requests (in milliseconds) */
export function setInterval(ms: number): void {
  intervalMs = ms;
}

/** Wait until it is safe to make the next request */
export async function acquire(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  const waitMs = intervalMs - elapsed;

  if (waitMs > 0) {
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  lastRequestTime = Date.now();
}
