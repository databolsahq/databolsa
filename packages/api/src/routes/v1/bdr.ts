import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { bdrListResponse, bdrProfile, bdrQuotesResponse } from "@databolsa/contract";
import { bdrService } from "../../services/bdr.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate, tickerParam } from "../../lib/validators";

const listQuery = paginationQuery.extend({ search: z.string().optional() });

const quotesQuery = paginationQuery
  .extend({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, { message: "from deve ser <= to", path: ["from"] });

export const bdr = new Hono()
  .get(
    "/",
    describeRoute({
      tags: ["BDR"],
      operationId: "listBdrs",
      summary: "Catálogo de BDRs (recibos de ações estrangeiras)",
      responses: ok(bdrListResponse, "Página de BDRs"),
    }),
    validate("query", listQuery),
    async (c) => c.json(await bdrService.list(c.req.valid("query"))),
  )
  .get(
    "/:ticker",
    describeRoute({
      tags: ["BDR"],
      operationId: "getBdr",
      summary: "Perfil de um BDR",
      responses: ok(bdrProfile, "BDR"),
    }),
    validate("param", tickerParam),
    async (c) => c.json(await bdrService.get(c.req.valid("param").ticker)),
  )
  .get(
    "/:ticker/quotes",
    describeRoute({
      tags: ["BDR"],
      operationId: "listBdrQuotes",
      summary: "Cotações EOD de um BDR",
      description: "Preços do BDR (events_only). BDR fica `adjust_quality='no_event_source'`.",
      responses: ok(bdrQuotesResponse, "Página de cotações"),
    }),
    validate("param", tickerParam),
    validate("query", quotesQuery),
    async (c) => c.json(await bdrService.quotes(c.req.valid("param").ticker, c.req.valid("query"))),
  );
