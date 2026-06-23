import {
  bigint,
  date,
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

// mart_prices__adjusted — event-adjusted OHLCV (splits/groupings/bonuses applied;
// dividends NOT subtracted, adjust_type='events_only'). ~3.17M rows. adjust_quality
// is the key staleness flag: {full, suspect_unrecorded_event, no_event_source}.
export const prices = pgTable(
  "prices",
  {
    date: date("date", { mode: "string" }).notNull(),
    ticker: text("ticker").notNull(),
    codbdi: text("codbdi"),
    isin: text("isin"),
    openAdj: doublePrecision("open_adj"),
    highAdj: doublePrecision("high_adj"),
    lowAdj: doublePrecision("low_adj"),
    closeAdj: doublePrecision("close_adj"),
    // retorno total: close ajustado por eventos + proventos reinvestidos (bruto).
    // Igual a close_adj quando não há fonte de proventos (units/FII, etapa 2).
    closeTr: doublePrecision("close_tr"),
    closeRaw: doublePrecision("close_raw"),
    adjFactor: doublePrecision("adj_factor"),
    volumeBrl: doublePrecision("volume_brl"),
    quantity: bigint("quantity", { mode: "number" }),
    adjustType: text("adjust_type"),
    adjustQuality: text("adjust_quality"),
  },
  (t) => [
    primaryKey({ columns: [t.ticker, t.date] }),
    index("prices_ticker_date_idx").on(t.ticker, t.date),
  ],
);

// mart_prices__stats — estatísticas de mercado por ticker (snapshot): retorno 12m,
// volatilidade anualizada, beta vs IBOV, volume médio 2m. Alimenta "Performance e risco".
export const priceStats = pgTable(
  "price_stats",
  {
    ticker: text("ticker").primaryKey(),
    referenceDate: date("reference_date", { mode: "string" }),
    retorno12m: doublePrecision("retorno_12m"),
    volatilidade: doublePrecision("volatilidade"),
    beta: doublePrecision("beta"),
    volumeMedio2m: doublePrecision("volume_medio_2m"),
  },
);
