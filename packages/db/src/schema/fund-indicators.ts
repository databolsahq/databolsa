import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
} from "drizzle-orm/pg-core";

// mart_fund__indicators — the fundamentalist indicators, wide, one row per (cnpj, eval_date).
// eval_date is a quarter-end snapshot (plus a latest-as-of-today row), 2010-12-31 -> today;
// statement_date is the underlying TTM statement period (distinct from the pricing date).
// This mart is the source for the screener AND the year-by-year fundamentals feature.
// `price` is NOT event-adjusted — see shares_quality.
export const fundIndicators = pgTable(
  "fund_indicators",
  {
    cnpj: text("cnpj").notNull(),
    ticker: text("ticker").notNull(),
    companyName: text("company_name"),
    evalDate: date("eval_date", { mode: "string" }).notNull(),
    statementDate: date("statement_date", { mode: "string" }),
    scope: text("scope"),
    marketCap: doublePrecision("market_cap"),
    price: doublePrecision("price"),
    priceDate: date("price_date", { mode: "string" }),
    totalShares: bigint("total_shares", { mode: "number" }),
    // valuation
    pl: doublePrecision("pl"),
    pvp: doublePrecision("pvp"),
    psr: doublePrecision("psr"),
    pEbit: doublePrecision("p_ebit"),
    pFcf: doublePrecision("p_fcf"),
    pAtivos: doublePrecision("p_ativos"),
    pCapGiro: doublePrecision("p_cap_giro"),
    pAtivoCircLiq: doublePrecision("p_ativo_circ_liq"),
    evEbitda: doublePrecision("ev_ebitda"),
    evEbit: doublePrecision("ev_ebit"),
    // per-share
    lpa: doublePrecision("lpa"),
    vpa: doublePrecision("vpa"),
    // profitability
    roe: doublePrecision("roe"),
    roa: doublePrecision("roa"),
    roic: doublePrecision("roic"),
    margemBruta: doublePrecision("margem_bruta"),
    margemEbit: doublePrecision("margem_ebit"),
    margemLiquida: doublePrecision("margem_liquida"),
    ebitAtivos: doublePrecision("ebit_ativos"),
    giroAtivos: doublePrecision("giro_ativos"),
    // leverage / liquidity
    divLiquidaEbitda: doublePrecision("div_liquida_ebitda"),
    divLiquidaPl: doublePrecision("div_liquida_pl"),
    divBrutaPl: doublePrecision("div_bruta_pl"),
    liquidezCorrente: doublePrecision("liquidez_corrente"),
    // dividends
    dy12m: doublePrecision("dy_12m"),
    payout: doublePrecision("payout"),
    jcpSobreTotal: doublePrecision("jcp_sobre_total"),
    // growth
    revenueCagr3y: doublePrecision("revenue_cagr_3y"),
    revenueCagr5y: doublePrecision("revenue_cagr_5y"),
    earningsCagr3y: doublePrecision("earnings_cagr_3y"),
    earningsCagr5y: doublePrecision("earnings_cagr_5y"),
    ebitdaCagr3y: doublePrecision("ebitda_cagr_3y"),
    // quality / lineage / staleness
    negativeEquity: boolean("negative_equity"),
    sharesQuality: text("shares_quality"),
    quartersAvailable: bigint("quarters_available", { mode: "number" }),
  },
  (t) => [
    primaryKey({ columns: [t.cnpj, t.evalDate] }),
    index("fund_indicators_ticker_idx").on(t.ticker),
    index("fund_indicators_eval_date_idx").on(t.evalDate),
    index("fund_indicators_ticker_eval_idx").on(t.ticker, t.evalDate),
  ],
);
