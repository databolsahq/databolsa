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
  sector: z
    .string()
    .optional()
    .describe(
      "Filtra por setor da empresa (match EXATO, case-sensitive). Valor desconhecido retorna página vazia, sem erro.",
    ),
  segment: z
    .string()
    .optional()
    .describe("Filtra por segmento de listagem B3 (substring, case-insensitive), ex.: 'Novo Mercado'."),
  sort: z
    .string()
    .optional()
    .describe(
      "Ordena por indicador. Valores: pl, pvp, psr, dy, dy_12m, roe, roic, ev_ebitda, market_cap, margem_liquida. " +
        "Prefixe com '-' para decrescente (ex.: -dy_12m). Nomes livres como 'dividend_yield' são inválidos.",
    ),
});

// Listing de FIIs: o universo real (mart_fii__profile), filtrável por segmento e
// tijolo/papel. Ordenação/filtro finos ficam no cliente (505 linhas cabem num GET).
const fiiScreenQuery = paginationQuery.extend({
  segment: z
    .string()
    .optional()
    .describe("Filtra por segmento do FII (substring, case-insensitive), ex.: 'Logística', 'Papel'."),
  paper: z.enum(["true", "false"]).optional().describe("true = papel (CRI), false = tijolo. Omitir = todos."),
  sort: z
    .string()
    .optional()
    .describe(
      "Ordena por: ticker, preco, dy, dy_12m, pvp, vacancia, pl, patrimonio_liquido. " +
        "Prefixe com '-' para decrescente (ex.: -dy_12m).",
    ),
});

export const screener = new Hono()
  .get(
    "/stocks",
    describeRoute({
      tags: ["Screener"],
      operationId: "screenStocks",
      summary: "Filtra ações por múltiplos critérios fundamentalistas",
      description:
        "Filtra o universo de ações por faixas de indicadores (pl_min/pl_max, pvp_min/pvp_max, dy_min, roe_min, " +
        "ev_ebitda_max, div_liq_ebitda_max), setor e segmento; ordena por `sort`. Paginação por cursor " +
        "(use meta.next_cursor). Retorna ticker, nome, setor e os indicadores principais por papel.",
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
      description:
        "Lista o universo real de FIIs (mart_fii__profile), filtrável por segmento e por tijolo/papel; ordena por " +
        "`sort`. Paginação por cursor (meta.next_cursor). Retorna ticker, nome, segmento e indicadores (dy, pvp, vacância…).",
      responses: ok(fiiScreenResponse, "Página de FIIs"),
    }),
    validate("query", fiiScreenQuery),
    async (c) => c.json(await fiiService.list(c.req.valid("query"))),
  );
