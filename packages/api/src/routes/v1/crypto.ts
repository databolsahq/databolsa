import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { cryptoQuotesResponse } from "@databolsa/contract";
import { cryptoService } from "../../services/crypto.service";
import { seriesPaginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate } from "../../lib/validators";

const symbolParam = z.object({ symbol: z.string().min(3).max(16).regex(/^[A-Z0-9]+$/i) });

const quotesQuery = seriesPaginationQuery
  .extend({
    interval: z.enum(["1d", "1h"]).default("1d"),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(fromBeforeTo, { message: "from deve ser <= to", path: ["from"] });

export const crypto = new Hono().get(
  "/:symbol/quotes",
  describeRoute({
    tags: ["Crypto"],
    operationId: "listCryptoQuotes",
    summary: "Candles de um criptoativo (diário; 1h vazio no v1)",
    responses: ok(cryptoQuotesResponse, "Página de candles"),
  }),
  validate("param", symbolParam),
  validate("query", quotesQuery),
  async (c) => c.json(await cryptoService.quotes(c.req.valid("param").symbol, c.req.valid("query"))),
);
