import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { fiiScreenResponse, screenerResponse } from "@databolsa/contract";
import { indicatorService } from "../../services/indicator.service";
import { fiiService } from "../../services/fii.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";

const numeric = z.coerce.number();

const screenQuery = paginationQuery.extend({
  pl_min: numeric.optional(),
  pl_max: numeric.optional(),
  pvp_min: numeric.optional(),
  pvp_max: numeric.optional(),
  dy_min: numeric.optional(),
  roe_min: numeric.optional(),
  ev_ebitda_max: numeric.optional(),
  div_liq_ebitda_max: numeric.optional(),
  sector: z.string().optional(),
  segment: z.string().optional(),
  sort: z.string().optional(),
});

// Listing de FIIs: o universo real (mart_fii__profile), filtrável por segmento e
// tijolo/papel. Ordenação/filtro finos ficam no cliente (505 linhas cabem num GET).
const fiiScreenQuery = paginationQuery.extend({
  segment: z.string().optional(),
  paper: z.enum(["true", "false"]).optional(),
  sort: z.string().optional(),
});

export const screener = new Hono()
  .get(
    "/stocks",
    describeRoute({
      tags: ["Screener"],
      operationId: "screenStocks",
      summary: "Filtra ações por múltiplos critérios fundamentalistas",
      responses: ok(screenerResponse, "Página de resultados"),
    }),
    validate("query", screenQuery),
    async (c) => c.json(await indicatorService.screen(c.req.valid("query"))),
  )
  .get(
    "/fiis",
    describeRoute({
      tags: ["Screener"],
      operationId: "screenFiis",
      summary: "Universo de FIIs filtrável por segmento e tijolo/papel",
      responses: ok(fiiScreenResponse, "Página de FIIs"),
    }),
    validate("query", fiiScreenQuery),
    async (c) => c.json(await fiiService.list(c.req.valid("query"))),
  );
