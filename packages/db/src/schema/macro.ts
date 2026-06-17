import { date, doublePrecision, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

// mart_macro__indicators — long-format macro series: the UNION of the curated views
// plus a `section` column (juro_real, inflacao, crescimento, ...). `value` is decimal
// (a.a./a.m./12m) unless `unit` says otherwise (indice, USD milhoes, quadrante 1-4,
// score, percentil). `lineage` carries provenance; `label` is set only for
// regime_quadrante. The mart's `date` is a midnight TIMESTAMP — the loader casts to date.
export const macroIndicators = pgTable(
  "macro_indicators",
  {
    section: text("section").notNull(),
    indicatorId: text("indicator_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    value: doublePrecision("value"),
    unit: text("unit"),
    label: text("label"),
    lineage: text("lineage"),
  },
  (t) => [
    primaryKey({ columns: [t.section, t.indicatorId, t.date] }),
    index("macro_indicators_section_idx").on(t.section),
    index("macro_indicators_indicator_date_idx").on(t.indicatorId, t.date),
  ],
);

// mart_macro__cross_asset — market-cap-weighted aggregate of all listed companies
// (an IBOV proxy: dy_agregado_vs_selic, erp_earnings_yield_vs_ntnb10, ...). Same shape
// as the macro views but EXCLUDED from mart_macro__indicators, so mirrored separately.
export const macroCrossAsset = pgTable(
  "macro_cross_asset",
  {
    date: date("date", { mode: "string" }).notNull(),
    indicatorId: text("indicator_id").notNull(),
    value: doublePrecision("value"),
    unit: text("unit"),
    label: text("label"),
    lineage: text("lineage"),
  },
  (t) => [primaryKey({ columns: [t.indicatorId, t.date] })],
);

// mart_macro__regime — monthly growth × inflation quadrant (docs/machine.md). Long
// format like the others: indicator_id ∈ {regime_growth_score, regime_inflation_score
// (both score [-1,1]), regime_quadrante (1–4)}. The individual signals + cross-asset
// spreads behind the snapshot live in macro_indicators / macro_cross_asset; the API
// assembles the full RegimeSnapshot from all three.
export const macroRegime = pgTable(
  "macro_regime",
  {
    date: date("date", { mode: "string" }).notNull(),
    indicatorId: text("indicator_id").notNull(),
    value: doublePrecision("value"),
    unit: text("unit"),
    label: text("label"),
    lineage: text("lineage"),
  },
  (t) => [primaryKey({ columns: [t.indicatorId, t.date] })],
);
