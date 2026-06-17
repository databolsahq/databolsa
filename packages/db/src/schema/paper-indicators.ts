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

// mart_fund__paper_indicators — fundamentalist indicators PER PAPER (one row per
// ticker × eval_date). Complements fund_indicators (which stays per-company).
// SAPR3/SAPR4/SAPR11 are analyzed separately: price, P/L, P/VP, PSR, DY, P/EBIT,
// EV/* differ per paper; company fundamentals (margins, ROE, ROIC, debt, growth,
// LPA, VPA) are identical across papers. See
// docs/data-quality/2026-06-13-fundamentus-verification.md.
export const paperIndicators = pgTable(
  "paper_indicators",
  {
    ticker: text("ticker").notNull(),
    classGroup: text("class_group"), // ON | PN | UNIT
    cnpj: text("cnpj").notNull(),
    companyName: text("company_name"),
    evalDate: date("eval_date", { mode: "string" }).notNull(),
    statementDate: date("statement_date", { mode: "string" }),
    scope: text("scope"),
    price: doublePrecision("price"),
    priceDate: date("price_date", { mode: "string" }),
    // "Valor de mercado" do papel = cotação × nº ações (Fundamentus-style) for ON/PN;
    // real company market cap for UNIT. companyMarketCap is always the real Σ ON/PN.
    marketCap: doublePrecision("market_cap"),
    companyMarketCap: doublePrecision("company_market_cap"),
    totalShares: bigint("total_shares", { mode: "number" }),
    // valuation (per paper, via mc_paper)
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
    // dividends (this paper's class)
    dy12m: doublePrecision("dy_12m"),
    dps12m: doublePrecision("dps_12m"),
    payout: doublePrecision("payout"),
    jcpSobreTotal: doublePrecision("jcp_sobre_total"),
    // per-share (company)
    lpa: doublePrecision("lpa"),
    vpa: doublePrecision("vpa"),
    // company fundamentals (identical across papers, replicated for self-contained reads)
    roe: doublePrecision("roe"),
    roa: doublePrecision("roa"),
    roic: doublePrecision("roic"),
    margemBruta: doublePrecision("margem_bruta"),
    margemEbit: doublePrecision("margem_ebit"),
    margemLiquida: doublePrecision("margem_liquida"),
    ebitAtivos: doublePrecision("ebit_ativos"),
    giroAtivos: doublePrecision("giro_ativos"),
    divLiquidaEbitda: doublePrecision("div_liquida_ebitda"),
    divLiquidaPl: doublePrecision("div_liquida_pl"),
    divBrutaPl: doublePrecision("div_bruta_pl"),
    liquidezCorrente: doublePrecision("liquidez_corrente"),
    revenueCagr3y: doublePrecision("revenue_cagr_3y"),
    revenueCagr5y: doublePrecision("revenue_cagr_5y"),
    earningsCagr3y: doublePrecision("earnings_cagr_3y"),
    earningsCagr5y: doublePrecision("earnings_cagr_5y"),
    ebitdaCagr3y: doublePrecision("ebitda_cagr_3y"),
    // quality
    negativeEquity: boolean("negative_equity"),
    sharesQuality: text("shares_quality"),
    quartersAvailable: bigint("quarters_available", { mode: "number" }),
    // instituição financeira (banco/seguradora/intermediário): plano de contas deslocado,
    // então margem/PSR/EV-EBIT não se aplicam — a API as serve como null + motivo.
    isFinancial: boolean("is_financial"),
  },
  (t) => [
    primaryKey({ columns: [t.ticker, t.evalDate] }),
    index("paper_indicators_cnpj_idx").on(t.cnpj),
    index("paper_indicators_eval_date_idx").on(t.evalDate),
    index("paper_indicators_ticker_eval_idx").on(t.ticker, t.evalDate),
  ],
);
