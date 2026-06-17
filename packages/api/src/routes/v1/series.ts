import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { series as seriesSchema, seriesListResponse } from "@databolsa/contract";
import { seriesService } from "../../services/series.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate } from "../../lib/validators";

const listQuery = paginationQuery.extend({
  source: z.enum(["bcb_sgs", "bcb_focus", "ibge_sidra", "fred", "ipeadata", "tesouro_direto"]).optional(),
  search: z.string().optional(),
});

const seriesParam = z.object({ source: z.string().min(1), series_id: z.string().min(1) });

const seriesQuery = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
    // Only the rolling-12m transform is implemented (see series.service). `ytd` and a
    // `real` (IPCA-deflated) transform are not yet supported, so they are not accepted
    // here — advertising them would let callers pass params the API silently ignores.
    accumulated: z.enum(["none", "12m"]).default("none"),
  })
  .refine(fromBeforeTo, { message: "from deve ser <= to", path: ["from"] });

export const series = new Hono()
  .get(
    "/",
    describeRoute({
      tags: ["Macro"],
      operationId: "listSeries",
      summary: "Catálogo de séries (BCB/IBGE/FRED/...)",
      responses: ok(seriesListResponse, "Página do catálogo"),
    }),
    validate("query", listQuery),
    async (c) => c.json(await seriesService.list(c.req.valid("query"))),
  )
  .get(
    "/:source/:series_id",
    describeRoute({
      tags: ["Macro"],
      operationId: "getSeries",
      summary: "Observações de uma série (com acumulados opcionais)",
      responses: ok(seriesSchema, "Série com metadados e observações"),
    }),
    validate("param", seriesParam),
    validate("query", seriesQuery),
    async (c) => {
      const { source, series_id } = c.req.valid("param");
      return c.json(await seriesService.get(source, series_id, c.req.valid("query")));
    },
  );
