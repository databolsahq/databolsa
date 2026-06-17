import { z } from "../zod";

// Contract pagination: `?cursor=&limit=`. These query schemas are the single source of
// truth — `packages/api` re-exports them from here so request validation and the spec
// can never disagree. Runtime cursor helpers (encode/decode/paginate) stay in the API.
export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

// Time series (quotes/índices/cripto) need the whole history in one page for the period
// filters to have data — same envelope/cursor, larger cap.
export const seriesPaginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20000).default(100),
});

export const paginationMeta = z.object({
  next_cursor: z.string().nullable(),
  count: z.number().int().describe("Itens nesta página"),
});

// Mirrors `paginate()` output `{ data, meta: { next_cursor, count } }`. Inline by design
// so each operation's 200 body is self-contained; the item schema carries the `$ref`.
export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ data: z.array(item), meta: paginationMeta });
