interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cacheStore: Record<string, CacheEntry<any>> = {};

// Default TTL: 5 minutes (300,000 ms)
const DEFAULT_TTL = 5 * 60 * 1000;

export const homeCache = {
  get<T>(key: string, ttl: number = DEFAULT_TTL): T | null {
    const entry = cacheStore[key];
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > ttl;
    if (isExpired) {
      delete cacheStore[key];
      return null;
    }

    return entry.data as T;
  },

  set<T>(key: string, data: T): void {
    cacheStore[key] = {
      data,
      timestamp: Date.now()
    };
  },

  clear(key?: string): void {
    if (key) {
      delete cacheStore[key];
    } else {
      Object.keys(cacheStore).forEach(k => delete cacheStore[k]);
    }
  }
};
