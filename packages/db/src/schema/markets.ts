import {
  bigint,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

// Serving mirror of the macro/fixed-income/indices marts. No PKs (DELETE+INSERT
// reload; read-only API) — just covering indexes for the access patterns.

// mart_bonds__tesouro — PU/taxas do Tesouro Direto por título e data-base.
export const tesouroBonds = pgTable(
  "tesouro_bonds",
  {
    type: text("type").notNull(),
    name: text("name"),
    maturity: date("maturity", { mode: "string" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    buyRate: doublePrecision("buy_rate"),
    sellRate: doublePrecision("sell_rate"),
    buyPrice: doublePrecision("buy_price"),
    sellPrice: doublePrecision("sell_price"),
    maturityYears: doublePrecision("maturity_years"),
  },
  (t) => [
    index("tesouro_bonds_date_idx").on(t.date),
    index("tesouro_bonds_type_idx").on(t.type, t.date),
  ],
);

// mart_indices__quotes — níveis diários de índices B3 (IBOV/IFIX).
export const indexQuotes = pgTable(
  "index_quotes",
  {
    code: text("code").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    close: doublePrecision("close"),
  },
  (t) => [index("index_quotes_code_date_idx").on(t.code, t.date)],
);

// mart_indices__composition — carteira teórica vigente por índice (constituintes).
export const indexComposition = pgTable(
  "index_composition",
  {
    code: text("code").notNull(),
    effectiveDate: date("effective_date", { mode: "string" }),
    ticker: text("ticker").notNull(),
    assetName: text("asset_name"),
    assetType: text("asset_type"),
    weight: doublePrecision("weight"),
    theoreticalQuantity: doublePrecision("theoretical_quantity"),
  },
  (t) => [index("index_composition_code_idx").on(t.code)],
);

// mart_macro__series — observações brutas de séries (hoje bcb_sgs).
export const macroSeries = pgTable(
  "macro_series",
  {
    source: text("source").notNull(),
    seriesId: text("series_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    value: doublePrecision("value"),
  },
  (t) => [index("macro_series_idx").on(t.source, t.seriesId, t.date)],
);

// mart_macro__series_catalog — SeriesMeta (uma linha por série).
export const macroSeriesCatalog = pgTable(
  "macro_series_catalog",
  {
    source: text("source").notNull(),
    seriesId: text("series_id").notNull(),
    name: text("name"),
    label: text("label"),
    unit: text("unit"),
    frequency: text("frequency"),
    firstDate: date("first_date", { mode: "string" }),
    lastDate: date("last_date", { mode: "string" }),
  },
  (t) => [index("macro_series_catalog_idx").on(t.source, t.seriesId)],
);

// mart_crypto__quotes — velas diárias de cripto em BRL (Binance).
export const cryptoQuotes = pgTable(
  "crypto_quotes",
  {
    symbol: text("symbol").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    open: doublePrecision("open"),
    high: doublePrecision("high"),
    low: doublePrecision("low"),
    close: doublePrecision("close"),
    volume: doublePrecision("volume"),
    quoteVolume: doublePrecision("quote_volume"),
    trades: bigint("trades", { mode: "number" }),
  },
  (t) => [index("crypto_quotes_symbol_date_idx").on(t.symbol, t.date)],
);

// mart_macro__expectations — consenso Focus por indicador/ano de referência.
export const macroExpectations = pgTable(
  "macro_expectations",
  {
    indicator: text("indicator").notNull(),
    reference: text("reference").notNull(),
    surveyDate: date("survey_date", { mode: "string" }).notNull(),
    median: doublePrecision("median"),
    mean: doublePrecision("mean"),
    stdDev: doublePrecision("std_dev"),
    respondents: integer("respondents"),
    base: integer("base"),
  },
  (t) => [index("macro_expectations_idx").on(t.indicator, t.reference, t.surveyDate)],
);
