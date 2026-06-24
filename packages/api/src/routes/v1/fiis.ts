import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import {
  fii,
  fiiDistributionsResponse,
  fiiIndicators,
  fiiReportsResponse,
  indicatorHistory,
} from "@databolsa/contract";
import { fiiService } from "../../services/fii.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { fromBeforeTo, isoDate, tickerParam } from "../../lib/validators";

const rangeMsg = { message: "from deve ser <= to", path: ["from"] };
const rangePageQuery = paginationQuery
  .extend({ from: isoDate.optional(), to: isoDate.optional() })
  .refine(fromBeforeTo, rangeMsg);
const historyQuery = z
  .object({
    name: z
      .string()
      .min(1)
      .describe(
        "Indicador do histórico mensal do FII (informe). Valores: vp_cota, dividend_yield_mes, patrimonio_liquido, cotistas.",
      ),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(fromBeforeTo, rangeMsg);

export const fiis = new Hono()
  .get(
    "/:ticker",
    describeRoute({
      tags: ["FIIs"],
      operationId: "getFii",
      summary: "Perfil do fundo imobiliário",
      responses: ok(fii, "FII"),
    }),
    validate("param", tickerParam),
    async (c) => c.json(await fiiService.get(c.req.valid("param").ticker)),
  )
  .get(
    "/:ticker/indicators",
    describeRoute({
      tags: ["FIIs"],
      operationId: "getFiiIndicators",
      summary: "Indicadores do FII (snapshot)",
      description:
        "Snapshot dos indicadores do FII: dividend yield (mês e 12m), P/VP, vacância, patrimônio líquido, " +
        "valor patrimonial por cota (vp_cota) e nº de cotistas. Para a série temporal use o histórico.",
      responses: ok(fiiIndicators, "Indicadores do FII"),
    }),
    validate("param", tickerParam),
    async (c) => c.json(await fiiService.indicators(c.req.valid("param").ticker)),
  )
  .get(
    "/:ticker/indicators/history",
    describeRoute({
      tags: ["FIIs"],
      operationId: "getFiiIndicatorHistory",
      summary: "Histórico de um indicador do FII (informe mensal)",
      responses: ok(indicatorHistory, "Série do indicador"),
    }),
    validate("param", tickerParam),
    validate("query", historyQuery),
    async (c) => {
      const { ticker } = c.req.valid("param");
      const { name, from, to } = c.req.valid("query");
      return c.json(await fiiService.history(ticker, name, from, to));
    },
  )
  .get(
    "/:ticker/distributions",
    describeRoute({
      tags: ["FIIs"],
      operationId: "listFiiDistributions",
      summary: "Distribuições (rendimentos) do FII",
      responses: ok(fiiDistributionsResponse, "Página de distribuições"),
    }),
    validate("param", tickerParam),
    validate("query", rangePageQuery),
    async (c) =>
      c.json(await fiiService.distributions(c.req.valid("param").ticker, c.req.valid("query"))),
  )
  .get(
    "/:ticker/reports",
    describeRoute({
      tags: ["FIIs"],
      operationId: "listFiiReports",
      summary: "Informes mensais do FII",
      responses: ok(fiiReportsResponse, "Página de informes"),
    }),
    validate("param", tickerParam),
    validate("query", rangePageQuery),
    async (c) => c.json(await fiiService.reports(c.req.valid("param").ticker, c.req.valid("query"))),
  );
