type CacheData<T> = {
  data: T;
  timestamp: number;
};

const cache = new Map<string, CacheData<unknown>>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function setCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function getCache<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    cache.delete(key);
    return null;
  }
  
  return cached.data as T;
}
