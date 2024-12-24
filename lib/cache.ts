type CacheData = {
  data: any;
  timestamp: number;
};

const cache: Record<string, CacheData> = {};
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export function setCache(key: string, data: any) {
  cache[key] = {
    data,
    timestamp: Date.now(),
  };
}

export function getCache(key: string) {
  const cached = cache[key];
  if (!cached) return null;
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    delete cache[key];
    return null;
  }
  
  return cached.data;
}
