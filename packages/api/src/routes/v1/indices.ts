import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { indexComposition, indexList, indexQuotesResponse } from "@databolsa/contract";
import { indexMarketService } from "../../services/index-market.service";
import { seriesPaginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate } from "../../lib/validators";

const codeParam = z.object({
  code: z.string().min(1).describe("Código do índice, ex.: IBOV, IFIX, IBXX, SMLL, IDIV, ICON. Ver listIndices."),
});

const quotesQuery = seriesPaginationQuery
  .extend({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, { message: "from deve ser <= to", path: ["from"] });

export const indices = new Hono()
  .get(
    "/",
    describeRoute({
      tags: ["Indices"],
      operationId: "listIndices",
      summary: "Índices disponíveis (IBOV, IFIX, ...)",
      description: "Catálogo dos índices da B3 cobertos (IBOV, IFIX, IBXX/IBrX-100, SMLL, IDIV, ICON…) com código e nome.",
      responses: ok(indexList, "Lista de índices"),
    }),
    (c) => c.json(indexMarketService.list()),
  )
  .get(
    "/:code/quotes",
    describeRoute({
      tags: ["Indices"],
      operationId: "listIndexQuotes",
      summary: "Série de níveis diários de um índice",
      responses: ok(indexQuotesResponse, "Página de níveis"),
    }),
    validate("param", codeParam),
    validate("query", quotesQuery),
    async (c) => c.json(await indexMarketService.quotes(c.req.valid("param").code, c.req.valid("query"))),
  )
  .get(
    "/:code/composition",
    describeRoute({
      tags: ["Indices"],
      operationId: "getIndexComposition",
      summary: "Composição teórica do índice (carteira teórica vigente)",
      responses: ok(indexComposition, "Composição teórica"),
    }),
    validate("param", codeParam),
    async (c) => c.json(await indexMarketService.composition(c.req.valid("param").code)),
  );
