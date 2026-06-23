import Redis from "ioredis";

let client: Redis | null = null;

// Single lazy ioredis client from REDIS_URL; null when unset (cache disabled). Resilient
// by design: short command timeout + the cache layer swallows errors, so a flaky/down
// Redis degrades to serving straight from Postgres rather than failing requests.
export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, {
    maxRetriesPerRequest: 1,
    commandTimeout: 1000,
    enableOfflineQueue: true,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  client.on("error", (err) => console.error("[databolsa-api] redis:", err.message));
  return client;
}
