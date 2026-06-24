import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { optionExpiries, optionsChain, optionsQuotesResponse } from "@databolsa/contract";
import { optionsService } from "../../services/options.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate, tickerParam } from "../../lib/validators";

// Série de opção tem código longo e alfanumérico (PETRF338, BBASR196W4) — o
// tickerParam (4 letras + sufixo) não serve.
const optionParam = z.object({
  option: z
    .string()
    .regex(/^[A-Z0-9]{4,14}$/, "código de opção inválido")
    .describe("Código da SÉRIE de opção (ex.: PETRF338), não o subjacente. Descubra via getOptionsChain do ativo."),
});

const chainQuery = z.object({
  expiry: isoDate.optional().describe("Filtra a cadeia por vencimento (YYYY-MM-DD). Ver listOptionExpiries."),
  type: z.enum(["call", "put"]).optional().describe("Filtra por tipo: call ou put."),
});

const quotesQuery = paginationQuery
  .extend({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, { message: "from deve ser <= to", path: ["from"] });

export const options = new Hono()
  .get(
    "/:ticker/chain",
    describeRoute({
      tags: ["Options"],
      operationId: "getOptionsChain",
      summary: "Cadeia de opções vigente de um subjacente",
      description: "Séries vivas (não vencidas) que negociaram; filtre por `expiry`/`type`.",
      responses: ok(optionsChain, "Cadeia de opções"),
    }),
    validate("param", tickerParam),
    validate("query", chainQuery),
    async (c) => c.json(await optionsService.chain(c.req.valid("param").ticker, c.req.valid("query"))),
  )
  .get(
    "/:ticker/expiries",
    describeRoute({
      tags: ["Options"],
      operationId: "listOptionExpiries",
      summary: "Vencimentos disponíveis de um subjacente",
      responses: ok(optionExpiries, "Vencimentos"),
    }),
    validate("param", tickerParam),
    async (c) => c.json(await optionsService.expiries(c.req.valid("param").ticker)),
  )
  .get(
    "/:option/quotes",
    describeRoute({
      tags: ["Options"],
      operationId: "listOptionQuotes",
      summary: "Histórico EOD de uma série de opção",
      responses: ok(optionsQuotesResponse, "Página de cotações"),
    }),
    validate("param", optionParam),
    validate("query", quotesQuery),
    async (c) => c.json(await optionsService.quotes(c.req.valid("param").option, c.req.valid("query"))),
  );
