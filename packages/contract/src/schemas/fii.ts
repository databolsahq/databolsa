import { z } from "../zod";
import { indicatorValue } from "./stock";
import { paginated } from "./pagination";

// fii.service.ts `get`.
export const fii = z
  .object({
    ticker: z.string(),
    cnpj: z.string().nullable(),
    name: z.string().nullable(),
    segment: z.string().nullable(),
    administrator: z.string().nullable(),
    manager: z.string().nullable(),
    is_paper: z.boolean(),
  })
  .openapi({ ref: "Fii" });

// fii.service.ts `indicators` — reuses the shared IndicatorValue; reference_date nullable
// (empty snapshot returns null).
export const fiiIndicators = z.object({
  ticker: z.string(),
  reference_date: z.string().nullable(),
  indicators: z.array(indicatorValue),
});

// fii.service.ts `distributions` row.
export const fiiDistribution = z
  .object({
    ex_date: z.string().nullable(),
    payment_date: z.string().nullable(),
    value_per_share: z.number().nullable(),
    tax_free: z.boolean(),
  })
  .openapi({ ref: "FiiDistribution" });

export const fiiDistributionsResponse = paginated(fiiDistribution);

// fii.service.ts `reports` row (informe mensal).
export const fiiMonthlyReport = z
  .object({
    reference_month: z.string().nullable(),
    net_asset_value: z.number().nullable(),
    value_per_share: z.number().nullable(),
    monthly_dividend_yield_pct: z.number().nullable(),
    shareholders: z.number().nullable(),
    shares_issued: z.number().nullable(),
  })
  .openapi({ ref: "FiiMonthlyReport" });

export const fiiReportsResponse = paginated(fiiMonthlyReport);
