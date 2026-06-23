import { z } from "../zod";
import { observation } from "./stock";
import { paginated } from "./pagination";

// index-market.service.ts `list` item.
export const indexMeta = z
  .object({
    code: z.string(),
    name: z.string(),
    rebalancing: z.string(),
  })
  .openapi({ ref: "IndexMeta" });

export const indexList = z.array(indexMeta);

// index-market.service.ts `composition` — the carteira teórica. The live mart isn't
// populated yet (the handler 404s meanwhile), but this is the target 200 shape.
export const indexComposition = z
  .object({
    code: z.string(),
    effective_date: z.string(),
    components: z.array(
      z.object({
        ticker: z.string(),
        weight: z.number(),
        theoretical_quantity: z.number(),
      }),
    ),
  })
  .openapi({ ref: "IndexComposition" });

// index-market.service.ts `quotes` row — same shape as Observation (date/value).
export const indexQuotesResponse = paginated(observation);

// series.service.ts `toMeta`.
export const seriesMeta = z
  .object({
    source: z.string(),
    series_id: z.string(),
    name: z.string().nullable(),
    label: z.string().nullable(),
    unit: z.string().nullable(),
    frequency: z.string().nullable(),
    first_date: z.string().nullable(),
    last_date: z.string().nullable(),
  })
  .openapi({ ref: "SeriesMeta" });

export const seriesListResponse = paginated(seriesMeta);

// series.service.ts `get`.
export const series = z.object({
  meta: seriesMeta,
  observations: z.array(observation),
});

// crypto.service.ts `quotes` row. Timestamps completos em UTC (cripto negocia 24/7).
export const cryptoCandle = z
  .object({
    open_time: z.string(),
    close_time: z.string(),
    open: z.number().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    close: z.number().nullable(),
    volume: z.number().nullable().describe("Volume na moeda base"),
    quote_volume: z.number().nullable().describe("Volume em BRL"),
    trades: z.number().nullable(),
  })
  .openapi({ ref: "CryptoCandle" });

export const cryptoQuotesResponse = paginated(cryptoCandle);
