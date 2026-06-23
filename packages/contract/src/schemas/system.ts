import { z } from "../zod";

// health.service.ts `status`.
export const health = z
  .object({
    status: z.enum(["ok", "degraded"]),
    version: z.string(),
    data_freshness: z.record(z.string(), z.string()),
  })
  .openapi({ ref: "Health" });

// search.service.ts `search` hit (search_catalog view). Flat ranked array, not paginated.
export const searchResult = z
  .object({
    kind: z.enum(["stock", "fii", "index", "bond", "macro"]),
    ticker: z.string(),
    title: z.string(),
    subtitle: z.string().nullable(),
    href: z.string(),
    score: z.number(),
  })
  .openapi({ ref: "SearchResult" });

export const searchResults = z.array(searchResult);

// ingest.service.ts `health` — read from the data-lake run ledger, not Postgres.
export const ingestRunSummary = z
  .object({
    run_id: z.string(),
    trigger: z.string(),
    started_at: z.string(),
    finished_at: z.string(),
    duration_s: z.number(),
    exit: z.number(),
    ok: z.boolean(),
    error_count: z.number(),
  })
  .openapi({ ref: "IngestRunSummary" });

export const ingestSourceHealth = z
  .object({
    source: z.string(),
    status: z.enum(["ok", "stale", "error", "no_data"]),
    last_fetch: z.string().nullable(),
    age_days: z.number().nullable(),
    datasets: z.number(),
    missing: z.number(),
    failed_validation: z.number(),
    ok: z.number(),
    skip: z.number(),
    miss: z.number(),
    err: z.number(),
    rows: z.number(),
    duration_s: z.number().nullable(),
  })
  .openapi({ ref: "IngestSourceHealth" });

export const ingestHealth = z.object({
  latest: ingestRunSummary.extend({ errors: z.array(z.string()) }).nullable(),
  sources: z.array(ingestSourceHealth),
  recent_runs: z.array(ingestRunSummary),
});
