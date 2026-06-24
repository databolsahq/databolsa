import { getCache } from "../lib/cache";

// Logical flush: bump the dataset version so every prior cache key is orphaned (they
// expire by TTL). Run after a manual data change, or rely on load_postgres.py doing it.
const cache = getCache();
if (!cache.enabled) {
  console.log("cache disabled (REDIS_URL unset or CACHE_ENABLED=false) — nothing to flush");
  process.exit(0);
}
const version = await cache.bumpVersion();
console.log(`cache flushed — dataset version bumped to ${version}`);
process.exit(0);
