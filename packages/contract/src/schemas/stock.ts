import { z } from "../zod";
import { lineage, stockType } from "./common";
import { paginated } from "./pagination";

// Unidade EXPLÍCITA do value (percent => 8.1 = 8,1%; ratio => múltiplo puro).
export const indicatorUnit = z.enum(["ratio", "percent", "brl", "brl_per_share", "count", "days"]);

// Matches stock.service.ts `get`. Note `latest_quote` — present in the handler but absent
// from the old hand-written yaml (a drift this code-first schema corrects).
export const stock = z
  .object({
    ticker: z.string(),
    isin: z.string().nullable(),
    type: stockType.nullable(),
    company: z
      .object({
        cvm_code: z.number().int().nullable(),
        name: z.string().nullable(),
        tickers: z
          .array(z.object({ ticker: z.string(), type: stockType.nullable() }))
          .describe("Papéis (classes) da empresa — cada um analisável em /stocks/{ticker}/indicators"),
      })
      .nullable(),
    shares_outstanding: z.number().nullable(),
    latest_quote: z.object({
      date: z.string(),
      close: z.number().nullable(),
      adjust_type: z.string().nullable(),
      adjust_quality: z.string().nullable(),
    }),
  })
  .openapi({ ref: "Stock" });

// Matches stock.service.ts `quotes`. OHLC are nullable: the unadjusted reconstruction
// yields null when the source value is null. adjust_* kept as free strings (DB-sourced).
export const quote = z
  .object({
    date: z.string(),
    open: z.number().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    close: z.number().nullable(),
    close_raw: z.number().nullable().describe("Fechamento bruto (não ajustado), como reportado pela B3"),
    close_tr: z
      .number()
      .nullable()
      .describe("Fechamento de retorno total: ajustado por eventos + proventos reinvestidos (bruto). = close quando não há fonte de proventos (units/FII)"),
    volume: z.number().nullable().describe("Volume financeiro (R$)"),
    quantity: z.number().nullable(),
    trades: z.number().nullable().describe("Nº de negócios — null: fonte aberta dá quantidade, não contagem"),
    adjusted: z.boolean(),
    adjust_type: z.string().nullable(),
    adjust_quality: z.string().nullable(),
  })
  .openapi({ ref: "Quote" });

export const quotesResponse = paginated(quote);

export const indicatorValue = z
  .object({
    name: z.string(),
    label: z.string(),
    value: z.number().nullable().describe("null quando não calculável — ver reason"),
    unit: indicatorUnit,
    reason: z.string().nullable(),
    reference_date: z.string().nullable(),
    ttm: z.boolean(),
    lineage,
    methodology_url: z.string(),
  })
  .openapi({ ref: "IndicatorValue" });

// stock.service.ts `snapshot` return.
export const indicatorSnapshot = z.object({
  ticker: z.string(),
  reference_date: z.string(),
  is_financial: z.boolean(),
  indicators: z.array(indicatorValue),
});

export const observation = z
  .object({ date: z.string(), value: z.number().nullable() })
  .openapi({ ref: "Observation" });

// stock.service.ts `history` return.
export const indicatorHistory = z.object({
  ticker: z.string(),
  name: z.string(),
  label: z.string(),
  unit: indicatorUnit,
  observations: z.array(observation),
});

// corporate.service.ts `dividends` row mapping.
export const dividend = z
  .object({
    type: z.string().nullable(),
    ex_date: z.string().nullable(),
    payment_date: z.string().nullable(),
    value_per_share_gross: z.number().nullable(),
    value_per_share_net: z.number().nullable(),
  })
  .openapi({ ref: "Dividend" });

export const dividendsResponse = paginated(dividend);

// corporate.service.ts `events` — served as a plain array (no envelope).
export const corporateEvent = z
  .object({
    type: z.string().nullable(),
    approved_date: z.string().nullable(),
    ex_date: z.string().nullable(),
    factor: z.number().nullable(),
    detail: z.string().nullable(),
  })
  .openapi({ ref: "CorporateEvent" });

export const corporateEvents = z.array(corporateEvent);

// corporate.service.ts `insider` — company-level CVM VLMO, aggregated by month.
export const insiderMove = z
  .object({
    reference_month: z.string().describe("AAAA-MM"),
    net_shares: z.number().nullable(),
    net_value_brl: z.number().nullable(),
    buy_value_brl: z.number().nullable(),
    sell_value_brl: z.number().nullable(),
    lineage,
  })
  .openapi({ ref: "InsiderMove" });

export const insiderResponse = z.object({
  ticker: z.string(),
  data: z.array(insiderMove),
});
