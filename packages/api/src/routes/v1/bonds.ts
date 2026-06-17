import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { z } from "zod";
import { tesouroResponse, yieldCurve } from "@databolsa/contract";
import { bondsService } from "../../services/bonds.service";
import { paginationQuery } from "../../lib/pagination";
import { ok } from "../../lib/openapi";
import { validate } from "../../lib/validate";
import { isoDate } from "../../lib/validators";

const tesouroQuery = paginationQuery.extend({
  type: z.enum(["LTN", "NTN-F", "NTN-B", "NTN-B-Principal", "LFT", "RENDA+", "EDUCA+"]).optional(),
  maturity: isoDate.optional(),
  date: isoDate.optional(),
});

const curveQuery = z.object({
  date: isoDate.optional(),
  kind: z.enum(["nominal", "real"]).default("nominal"),
});

export const bonds = new Hono()
  // /bonds/tesouro/yield-curve antes de /tesouro p/ o match não colidir
  .get(
    "/tesouro/yield-curve",
    describeRoute({
      tags: ["Bonds"],
      operationId: "getYieldCurve",
      summary: "Curva de juros (Tesouro), um ponto por vencimento",
      responses: ok(yieldCurve, "Curva de juros"),
    }),
    validate("query", curveQuery),
    async (c) => {
      const { date, kind } = c.req.valid("query");
      return c.json(await bondsService.yieldCurve(kind, date));
    },
  )
  .get(
    "/tesouro",
    describeRoute({
      tags: ["Bonds"],
      operationId: "listTesouroBonds",
      summary: "Títulos do Tesouro Direto (taxas e preços)",
      responses: ok(tesouroResponse, "Página de títulos"),
    }),
    validate("query", tesouroQuery),
    async (c) => c.json(await bondsService.tesouro(c.req.valid("query"))),
  );
