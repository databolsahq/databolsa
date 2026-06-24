import { BadRequestError } from "../middleware/errors";

// The pagination query schemas live in @databolsa/contract (single source of truth for
// validation + the OpenAPI spec); re-exported here so route files keep importing them
// from the API's pagination module alongside the runtime cursor helpers below.
// Opaque base64 offset cursor — correct and cheap at current row counts; switching to
// keyset over the large `prices` series later won't change the contract.
export { paginationQuery, seriesPaginationQuery, type PaginationQuery } from "@databolsa/contract";

export interface Pagination {
  limit: number;
  offset: number;
}

// A malformed cursor is a client error (400), not a silent restart from offset 0 — the
// latter can produce duplicate-page loops for a paging client.
export function decodeCursor(cursor: string | undefined, limit: number): Pagination {
  if (!cursor) return { limit, offset: 0 };
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown };
    const offset = Number(decoded.o);
    if (Number.isInteger(offset) && offset >= 0) return { limit, offset };
  } catch {
    // fall through to the BadRequestError below
  }
  throw new BadRequestError("cursor inválido");
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

export interface PaginatedEnvelope<T> {
  data: T[];
  meta: { next_cursor: string | null; count: number };
}

// Repos fetch `limit + 1` rows so we can report a next cursor without a count query.
export function paginate<T>(rows: T[], { limit, offset }: Pagination): PaginatedEnvelope<T> {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    meta: { next_cursor: hasMore ? encodeCursor(offset + limit) : null, count: data.length },
  };
}
