import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

// Serving mirror of the FII marts (CVM informe mensal + COTAHIST price). Read-only,
// DELETE+INSERT reload, no PKs.

// mart_fii__profile — perfil (1 linha por ticker).
export const fiiProfile = pgTable(
  "fii_profile",
  {
    ticker: text("ticker").notNull(),
    cnpj: text("cnpj"),
    name: text("name"),
    segment: text("segment"),
    administrator: text("administrator"),
    manager: text("manager"),
    isPaper: boolean("is_paper"),
  },
  (t) => [index("fii_profile_ticker_idx").on(t.ticker)],
);

// mart_fii__reports — informes mensais.
export const fiiReports = pgTable(
  "fii_reports",
  {
    ticker: text("ticker").notNull(),
    referenceMonth: text("reference_month").notNull(),
    netAssetValue: doublePrecision("net_asset_value"),
    valuePerShare: doublePrecision("value_per_share"),
    monthlyDividendYieldPct: doublePrecision("monthly_dividend_yield_pct"),
    shareholders: bigint("shareholders", { mode: "number" }),
    sharesIssued: doublePrecision("shares_issued"),
  },
  (t) => [index("fii_reports_ticker_idx").on(t.ticker, t.referenceMonth)],
);

// mart_fii__distributions — distribuições mensais.
export const fiiDistributions = pgTable(
  "fii_distributions",
  {
    ticker: text("ticker").notNull(),
    exDate: date("ex_date", { mode: "string" }).notNull(),
    paymentDate: date("payment_date", { mode: "string" }),
    valuePerShare: doublePrecision("value_per_share"),
    taxFree: boolean("tax_free"),
  },
  (t) => [index("fii_distributions_ticker_idx").on(t.ticker, t.exDate)],
);

// mart_fii__indicators — snapshot largo (1 linha por ticker).
export const fiiIndicators = pgTable(
  "fii_indicators",
  {
    ticker: text("ticker").notNull(),
    referenceDate: date("reference_date", { mode: "string" }),
    preco: doublePrecision("preco"),
    vpCota: doublePrecision("vp_cota"),
    patrimonioLiquido: doublePrecision("patrimonio_liquido"),
    cotistas: bigint("cotistas", { mode: "number" }),
    dividendYieldMes: doublePrecision("dividend_yield_mes"),
    dist12m: doublePrecision("dist_12m"),
    dy12m: doublePrecision("dy_12m"),
    ffoYield: doublePrecision("ffo_yield"),
    pvp: doublePrecision("pvp"),
    vacanciaFisica: doublePrecision("vacancia_fisica"),
    capRate: doublePrecision("cap_rate"),
    // imobiliários (informe trimestral, só fundos de tijolo)
    qtdImoveis: bigint("qtd_imoveis", { mode: "number" }),
    areaM2: doublePrecision("area_m2"),
    precoM2: doublePrecision("preco_m2"),
    aluguelM2: doublePrecision("aluguel_m2"),
    isPaper: boolean("is_paper"),
  },
  (t) => [index("fii_indicators_ticker_idx").on(t.ticker)],
);
