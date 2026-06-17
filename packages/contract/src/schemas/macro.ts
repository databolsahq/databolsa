import { z } from "../zod";
import { lineage } from "./common";

const direction = z.enum(["up", "down", "flat"]).nullable();

// macro.service.ts `toSignal` — used by both gears and regime. Carries the contract
// RegimeSignal fields plus additive context (unit/label/date).
export const regimeSignal = z
  .object({
    name: z.string(),
    value: z.number().nullable(),
    direction,
    lineage,
    // Additive context beyond the core RegimeSignal — the live API always sends these,
    // but they are optional in the contract (a consumer may treat them as enrichment).
    unit: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    date: z.string().nullable().optional(),
  })
  .openapi({ ref: "RegimeSignal" });

// macro.service.ts `gears`.
export const macroGears = z.object({
  as_of: z.string().nullable(),
  gears: z.array(z.object({ gear: z.string(), indicators: z.array(regimeSignal) })),
});

const axis = z.object({ direction, signals: z.array(regimeSignal) });

// macro.service.ts `regime`.
export const regimeSnapshot = z
  .object({
    as_of: z.string().nullable(),
    quadrant: z
      .enum([
        "growth_up_inflation_up",
        "growth_up_inflation_down",
        "growth_down_inflation_up",
        "growth_down_inflation_down",
      ])
      .nullable(),
    growth: axis,
    inflation: axis,
    cross_asset: z.object({
      dy_vs_selic_spread: z.number().nullable(),
      equity_risk_premium: z.number().nullable(),
      real_selic: z.number().nullable(),
    }),
  })
  .openapi({ ref: "RegimeSnapshot" });

// macro.service.ts `expectations` survey row (Focus).
export const expectation = z
  .object({
    survey_date: z.string(),
    reference: z.string(),
    median: z.number().nullable(),
    mean: z.number().nullable(),
    std_dev: z.number().nullable(),
    respondents: z.number().nullable(),
    base: z.number().nullable(),
  })
  .openapi({ ref: "Expectation" });

export const expectationsResponse = z.object({
  indicator: z.string(),
  reference: z.string().nullable(),
  realized: z.number().nullable(),
  surveys: z.array(expectation),
});
