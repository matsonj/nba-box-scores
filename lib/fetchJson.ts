/**
 * GETs a URL and parses the JSON body. Throws on a non-2xx response or once
 * `timeoutMs` elapses.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchJson<T = any>(url: string, timeoutMs: number): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}
