import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  corporateEvents,
  dividendsResponse,
  indicatorHistory,
  indicatorSnapshot,
  insiderResponse,
  quotesResponse,
  stock,
} from "@databolsa/contract";
import { stockService } from "../../services/stock.service";
import { indicatorService } from "../../services/indicator.service";
import { corporateService } from "../../services/corporate.service";
import { paginationQuery, seriesPaginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate, tickerParam } from "../../lib/validators";

const rangeMsg = { message: "from deve ser <= to", path: ["from"] };

const quotesQuery = seriesPaginationQuery
  .extend({
    from: isoDate.optional(),
    to: isoDate.optional(),
    adjusted: z
      .string()
      .optional()
      .transform((v) => v !== "false"),
  })
  .refine(fromBeforeTo, rangeMsg);

const rangeQuery = z
  .object({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, rangeMsg);

const dividendsQuery = paginationQuery
  .extend({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, rangeMsg);

const indicatorsQuery = z.object({
  names: z
    .string()
    .optional()
    .describe(
      "Lista separada por vírgula de indicadores a retornar (omitir = todos). Ex.: 'pl,roe,dy'. Nomes válidos " +
        "(abreviações SEM underscore — use 'pl', não 'p_l'): pl, pvp, psr, ev_ebitda, ev_ebit, lpa, vpa, roe, roa, " +
        "roic, margem_bruta, margem_ebit, margem_liquida, div_liq_ebitda, div_liq_pl, dy, payout, market_cap, price; " +
        "e dinâmicos: free_float, beta, volatilidade, retorno_12m, volume_medio_2m.",
    ),
  at: isoDate.optional(),
});
const historyQuery = z
  .object({
    name: z
      .string()
      .min(1)
      .describe("Indicador único para a série histórica (ex.: 'pl', 'roe', 'dy'). Mesmos nomes do snapshot."),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(fromBeforeTo, rangeMsg);

export const stocks = new Hono()
  .get(
    "/:ticker",
    describeRoute({
      tags: ["Stocks"],
      operationId: "getStock",
      summary: "Perfil e última cotação do papel",
      responses: ok(stock, "Ação"),
    }),
    validate("param", tickerParam),
    async (c) => c.json(await stockService.get(c.req.valid("param").ticker)),
  )
  .get(
    "/:ticker/quotes",
    describeRoute({
      tags: ["Stocks"],
      operationId: "listQuotes",
      summary: "Série de cotações OHLCV",
      description: "Ajustada por eventos por default; `from`/`to` filtram o período (from <= to).",
      responses: ok(quotesResponse, "Página de cotações"),
    }),
    validate("param", tickerParam),
    validate("query", quotesQuery),
    async (c) => c.json(await stockService.quotes(c.req.valid("param").ticker, c.req.valid("query"))),
  )
  .get(
    "/:ticker/indicators",
    describeRoute({
      tags: ["Stocks"],
      operationId: "getStockIndicators",
      summary: "Indicadores fundamentalistas (snapshot TTM)",
      responses: ok(indicatorSnapshot, "Indicadores do papel"),
    }),
    validate("param", tickerParam),
    validate("query", indicatorsQuery),
    async (c) => {
      const { ticker } = c.req.valid("param");
      const { names, at } = c.req.valid("query");
      const list = names
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return c.json(await indicatorService.snapshot(ticker, list, at));
    },
  )
  .get(
    "/:ticker/indicators/history",
    describeRoute({
      tags: ["Stocks"],
      operationId: "getStockIndicatorHistory",
      summary: "Histórico de um indicador (trimestral)",
      responses: ok(indicatorHistory, "Série do indicador"),
    }),
    validate("param", tickerParam),
    validate("query", historyQuery),
    async (c) => {
      const { ticker } = c.req.valid("param");
      const { name, from, to } = c.req.valid("query");
      return c.json(await indicatorService.history(ticker, name, from, to));
    },
  )
  .get(
    "/:ticker/dividends",
    describeRoute({
      tags: ["Stocks"],
      operationId: "listDividends",
      summary: "Proventos (dividendos e JCP)",
      responses: ok(dividendsResponse, "Página de proventos"),
    }),
    validate("param", tickerParam),
    validate("query", dividendsQuery),
    async (c) =>
      c.json(await corporateService.dividends(c.req.valid("param").ticker, c.req.valid("query"))),
  )
  .get(
    "/:ticker/events",
    describeRoute({
      tags: ["Stocks"],
      operationId: "listCorporateEvents",
      summary: "Eventos societários (desdobramentos, grupamentos, bonificações)",
      responses: ok(corporateEvents, "Lista de eventos"),
    }),
    validate("param", tickerParam),
    validate("query", rangeQuery),
    async (c) =>
      c.json(await corporateService.events(c.req.valid("param").ticker, c.req.valid("query"))),
  )
  .get(
    "/:ticker/insider",
    describeRoute({
      tags: ["Stocks"],
      operationId: "listInsiderMoves",
      summary: "Movimentações de insiders (CVM VLMO, por mês)",
      responses: ok(insiderResponse, "Saldo mensal de insiders"),
    }),
    validate("param", tickerParam),
    validate("query", rangeQuery),
    async (c) =>
      c.json(await corporateService.insider(c.req.valid("param").ticker, c.req.valid("query"))),
  );
