import { z } from "../zod";
import { paginated } from "./pagination";

// bonds.service.ts `tesouro` row.
export const tesouroBondQuote = z
  .object({
    type: z.string().nullable(),
    name: z.string().nullable(),
    maturity: z.string().nullable(),
    date: z.string().nullable(),
    buy_rate: z.number().nullable(),
    sell_rate: z.number().nullable(),
    buy_price: z.number().nullable(),
    sell_price: z.number().nullable(),
  })
  .openapi({ ref: "TesouroBondQuote" });

export const tesouroResponse = paginated(tesouroBondQuote);

// bonds.service.ts `yieldCurve` — one point per maturity, sorted by years.
export const yieldCurve = z.object({
  date: z.string().nullable(),
  kind: z.enum(["nominal", "real"]),
  points: z.array(
    z.object({
      maturity: z.string(),
      years: z.number().nullable(),
      rate: z.number(),
    }),
  ),
});
