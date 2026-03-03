// Generic async worker pool with concurrency control and AbortSignal support

import { logger } from '../util/logger';

export interface PoolCallbacks<T, R> {
  onSuccess?: (item: T, result: R) => void;
  onError?: (item: T, error: Error) => void;
}

export interface PoolResult<R> {
  results: R[];
  errors: Error[];
}

/**
 * Run a worker function over items with bounded concurrency.
 * Stops accepting new items when the signal is aborted.
 */
export async function runPool<T, R>(
  items: T[],
  worker: (item: T, signal: AbortSignal) => Promise<R>,
  concurrency: number,
  signal?: AbortSignal,
  callbacks?: PoolCallbacks<T, R>,
): Promise<PoolResult<R>> {
  const results: R[] = [];
  const errors: Error[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < items.length) {
      if (signal?.aborted) {
        logger.info('Pool aborted, stopping', {
          processed: results.length + errors.length,
          remaining: items.length - index,
        });
        return;
      }

      const currentIndex = index++;
      const item = items[currentIndex];

      try {
        const result = await worker(item, signal ?? new AbortController().signal);
        results.push(result);
        callbacks?.onSuccess?.(item, result);
      } catch (err) {
        if (signal?.aborted) return;
        const error = err instanceof Error ? err : new Error(String(err));
        errors.push(error);
        callbacks?.onError?.(item, error);
        logger.error('Worker error', {
          itemIndex: currentIndex,
          error: error.message,
        });
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  const workers = Array.from({ length: workerCount }, () => next());
  await Promise.all(workers);

  return { results, errors };
}
