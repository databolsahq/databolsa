import type { Context, Next } from "hono";
import { DEFAULT_TTL, buildKey, getCache, normalizeQuery, type CacheEntry } from "../lib/cache";

const cache = getCache();

// In-process single-flight: concurrent misses for the same key await one computation
// (prevents a thundering herd against Postgres right after a version bump).
const inflight = new Map<string, Promise<CacheEntry | null>>();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Per-route TTL hook (all routes share the default for now; easy to specialize later).
function ttlFor(_path: string): number {
  return DEFAULT_TTL;
}

function serve(c: Context, entry: CacheEntry) {
  return c.body(entry.body, entry.status as 200, {
    "content-type": entry.contentType,
    "x-cache": "HIT",
  });
}

// Endpoints "vivos": a versão do cache só vira no reload do Postgres, mas estes
// leem estado fora dele (FS/lake), então cachear serviria dados velhos por até 6h.
const LIVE_PATHS = new Set(["/v1/health", "/v1/ingest"]);

export async function cacheMiddleware(c: Context, next: Next) {
  // Only cacheable GETs flow through the cache; live paths bypass entirely.
  if (!cache.enabled || c.req.method !== "GET" || LIVE_PATHS.has(c.req.path)) {
    await next();
    c.header("x-cache", cache.enabled ? "SKIP" : "OFF");
    return;
  }

  const url = new URL(c.req.url);
  const bypass =
    url.searchParams.get("nocache") === "1" ||
    (c.req.header("cache-control") ?? "").includes("no-cache");

  const version = await cache.version();
  const key = buildKey(version, "GET", c.req.path, normalizeQuery(url.searchParams));

  if (!bypass) {
    const hit = await cache.get(key);
    if (hit) return serve(c, hit);
    const pending = inflight.get(key);
    if (pending) {
      const entry = await pending.catch(() => null);
      if (entry) return serve(c, entry);
    }
  }

  // Compute. When not bypassing and no leader exists, become the single-flight leader.
  const leader = !bypass && !inflight.has(key) ? deferred<CacheEntry | null>() : null;
  if (leader) inflight.set(key, leader.promise);

  try {
    await next();
  } catch (err) {
    if (leader) {
      leader.resolve(null);
      inflight.delete(key);
    }
    throw err;
  }

  let entry: CacheEntry | null = null;
  const res = c.res;
  if (res.status === 200 && (res.headers.get("content-type") ?? "").includes("json")) {
    const body = await res.clone().text();
    entry = {
      status: 200,
      contentType: res.headers.get("content-type") ?? "application/json",
      body,
    };
    await cache.set(key, entry, ttlFor(c.req.path));
  }
  if (leader) {
    leader.resolve(entry);
    inflight.delete(key);
  }
  c.header("x-cache", bypass ? "BYPASS" : "MISS");
}
