import { z } from "../zod";
import { paginated } from "./pagination";

// indicator.service.ts `screen` row. Indicators already scaled (percent in p.p. etc.).
export const screenerRow = z
  .object({
    ticker: z.string(),
    name: z.string().nullable(),
    sector: z.string().nullable(),
    indicators: z.object({
      market_cap: z.number().nullable(),
      pl: z.number().nullable(),
      pvp: z.number().nullable(),
      dy: z.number().nullable(),
      roe: z.number().nullable(),
      roic: z.number().nullable(),
      ev_ebitda: z.number().nullable(),
      div_liq_ebitda: z.number().nullable(),
      margem_liquida: z.number().nullable(),
    }),
  })
  .openapi({ ref: "ScreenerRow" });

export const screenerResponse = paginated(screenerRow);

// fii.service.ts `list` row — valores RAW (formatação por unidade fica no cliente).
export const fiiListRow = z
  .object({
    ticker: z.string(),
    name: z.string().nullable(),
    segment: z.string().nullable(),
    is_paper: z.boolean(),
    reference_date: z.string().nullable(),
    preco: z.number().nullable(),
    dy_12m: z.number().nullable(),
    pvp: z.number().nullable(),
    vacancia_fisica: z.number().nullable(),
    patrimonio_liquido: z.number().nullable(),
  })
  .openapi({ ref: "FiiListRow" });

export const fiiScreenResponse = paginated(fiiListRow);
