import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class ToolCacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  /**
   * Get a cached value. Returns `undefined` on miss or expiry.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      console.log(`[CACHE EXPIRED] ${key}`);
      return undefined;
    }
    console.log(`[CACHE HIT] ${key}`);
    return entry.value;
  }

  /**
   * Store a value with a TTL in milliseconds (default 5 minutes).
   */
  set<T>(key: string, value: T, ttlMs = 5 * 60 * 1000): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
    console.log(`[CACHE SET] ${key} (TTL ${ttlMs / 1000}s)`);
  }

  /**
   * Immediately remove a specific key (e.g. after a mutation).
   */
  invalidate(key: string): void {
    this.store.delete(key);
    console.log(`[CACHE INVALIDATE] ${key}`);
  }

  /**
   * Remove all keys that start with a prefix (e.g. invalidate all goal keys).
   */
  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        console.log(`[CACHE INVALIDATE PREFIX] ${key}`);
      }
    }
  }
}
