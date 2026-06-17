import { createHash } from "node:crypto";
import { getRedis } from "./redis";

const PREFIX = "dbcache";
const VERSION_KEY = `${PREFIX}:version`;
const VERSION_MEMO_MS = 5000; // re-read the dataset version at most every 5s per process

export const DEFAULT_TTL = Number(process.env.CACHE_TTL_DEFAULT ?? 21_600); // 6h

export interface CacheEntry {
  status: number;
  contentType: string;
  body: string;
}

export interface Cache {
  readonly enabled: boolean;
  version(): Promise<string>;
  get(key: string): Promise<CacheEntry | null>;
  set(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void>;
  bumpVersion(): Promise<string>;
}

// Used when caching is off (no REDIS_URL / CACHE_ENABLED=false). Same code path, always
// misses — flip the env to A/B test with vs without the cache.
class NoopCache implements Cache {
  readonly enabled = false;
  async version() {
    return "0";
  }
  async get() {
    return null;
  }
  async set() {}
  async bumpVersion() {
    return "0";
  }
}

class RedisCache implements Cache {
  readonly enabled = true;
  #memo: { value: string; at: number } | null = null;

  // The serving DB only changes on load_postgres.py, which bumps this version. Every key
  // is namespaced by it, so a bump logically invalidates the whole cache at once; old
  // entries orphan and expire by TTL. Memoized briefly so it costs ~one GET per 5s.
  async version(): Promise<string> {
    const now = Date.now();
    if (this.#memo && now - this.#memo.at < VERSION_MEMO_MS) return this.#memo.value;
    let value = this.#memo?.value ?? "0";
    try {
      value = (await getRedis()?.get(VERSION_KEY)) ?? "0";
    } catch {
      // degrade: keep the last known version
    }
    this.#memo = { value, at: now };
    return value;
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      const raw = await getRedis()?.get(key);
      return raw ? (JSON.parse(raw) as CacheEntry) : null;
    } catch {
      return null; // a cache miss is always safe — fall through to Postgres
    }
  }

  async set(key: string, entry: CacheEntry, ttlSeconds: number): Promise<void> {
    try {
      await getRedis()?.set(key, JSON.stringify(entry), "EX", Math.max(1, ttlSeconds));
    } catch {
      // ignore — failing to cache must never fail the request
    }
  }

  async bumpVersion(): Promise<string> {
    const r = getRedis();
    if (!r) return "0";
    const value = String(await r.incr(VERSION_KEY));
    this.#memo = { value, at: Date.now() };
    return value;
  }
}

let instance: Cache | null = null;
export function getCache(): Cache {
  if (instance) return instance;
  const enabled = !!process.env.REDIS_URL && process.env.CACHE_ENABLED !== "false";
  instance = enabled ? new RedisCache() : new NoopCache();
  return instance;
}

// dbcache:v{version}:{METHOD}:{path}:{sha1(sortedQuery)} — path stays readable for
// debugging; the (possibly long) query string is hashed to bound the key length.
export function buildKey(version: string, method: string, path: string, query: string): string {
  const qhash = createHash("sha1").update(query).digest("hex").slice(0, 16);
  return `${PREFIX}:v${version}:${method}:${path}:${qhash}`;
}

export function normalizeQuery(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([k]) => k !== "nocache")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}
