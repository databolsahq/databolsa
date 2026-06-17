import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { searchResults } from "@databolsa/contract";
import { searchService } from "../../services/search.service";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";

// Unified typeahead across stocks/FIIs/indices/bonds/macro. Flat ranked array (not
// paginated) — it backs the Cmd+K palette, which wants the top-N, not pages.
const searchQuery = z.object({
  q: z.string().trim().min(1).max(64),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const search = new Hono().get(
  "/",
  describeRoute({
    tags: ["System"],
    operationId: "search",
    summary: "Busca unificada (typeahead) por ações/FIIs/índices/títulos/macro",
    responses: ok(searchResults, "Resultados ranqueados"),
  }),
  validate("query", searchQuery),
  async (c) => c.json(await searchService.search(c.req.valid("query"))),
);
