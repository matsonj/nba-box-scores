// Minimal fetch wrapper shared by the PBPStats and NHL API clients

/** Thrown for non-2xx responses so retry logic can inspect the status */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`GET ${url} failed with status ${status}`);
    this.name = 'HttpError';
  }
}

export async function getJson<T>(
  url: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(url, { headers, signal });
  if (!response.ok) {
    throw new HttpError(response.status, url);
  }
  return (await response.json()) as T;
}
