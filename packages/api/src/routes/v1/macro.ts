import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { expectationsResponse, macroGears, regimeSnapshot } from "@databolsa/contract";
import { macroService } from "../../services/macro.service";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { isoDate } from "../../lib/validators";

const gearEnum = z.enum([
  "monetary",
  "inflation",
  "growth",
  "employment",
  "credit",
  "fiscal",
  "external",
  "sovereign_risk",
  "global",
  "currency",
  "cross_asset",
]);

const gearsQuery = z.object({ gear: gearEnum.optional(), at: isoDate.optional() });
const regimeQuery = z.object({ at: isoDate.optional() });
const expectationsQuery = z.object({
  indicator: z.enum(["ipca", "selic", "pib", "cambio"]),
  reference: z
    .string()
    .optional()
    .describe(
      "Ano de referência do consenso, ex.: '2026'. Omitir retorna TODAS as referências (mistura anos); " +
        "informe um ano para uma série limpa.",
    ),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const macro = new Hono()
  .get(
    "/gears",
    describeRoute({
      tags: ["Macro"],
      operationId: "getMacroGears",
      summary: "Engrenagens macro (sinais por seção)",
      responses: ok(macroGears, "Sinais por engrenagem"),
    }),
    validate("query", gearsQuery),
    async (c) => {
      const { gear, at } = c.req.valid("query");
      return c.json(await macroService.gears(gear, at));
    },
  )
  .get(
    "/regime",
    describeRoute({
      tags: ["Macro"],
      operationId: "getMacroRegime",
      summary: "Regime econômico (quadrante crescimento × inflação)",
      responses: ok(regimeSnapshot, "Snapshot do regime"),
    }),
    validate("query", regimeQuery),
    async (c) => {
      const { at } = c.req.valid("query");
      return c.json(await macroService.regime(at));
    },
  )
  .get(
    "/expectations",
    describeRoute({
      tags: ["Macro"],
      operationId: "getMarketExpectations",
      summary: "Expectativas Focus (consenso por indicador)",
      description:
        "Consenso do Boletim Focus (BCB) para ipca, selic, pib ou cambio. Informe `reference` (ano) " +
        "para uma série limpa; sem ele, mistura todos os anos de referência.",
      responses: ok(expectationsResponse, "Expectativas"),
    }),
    validate("query", expectationsQuery),
    async (c) => {
      const { indicator, reference, from, to } = c.req.valid("query");
      return c.json(await macroService.expectations(indicator, { reference, from, to }));
    },
  );
