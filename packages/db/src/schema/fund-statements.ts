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

// mart_fund__statements — cleaned statements per company-quarter (TTM flows +
// point-in-time balance sheet + derived). Grain (cnpj, ref_date, scope); both
// consolidado (con) and individual (ind) scopes coexist. is_latest flags the most
// recent quarter per (cnpj, scope) so "latest statement" needs no max() subquery.
export const fundStatements = pgTable(
  "fund_statements",
  {
    cnpj: text("cnpj").notNull(),
    cdCvm: bigint("cd_cvm", { mode: "number" }),
    companyName: text("company_name"),
    refDate: date("ref_date", { mode: "string" }).notNull(),
    scope: text("scope").notNull(),
    quartersAvailable: bigint("quarters_available", { mode: "number" }),
    isLatest: boolean("is_latest"),
    revenueTtm: doublePrecision("revenue_ttm"),
    grossProfitTtm: doublePrecision("gross_profit_ttm"),
    ebitTtm: doublePrecision("ebit_ttm"),
    ebitdaTtm: doublePrecision("ebitda_ttm"),
    netIncomeTtm: doublePrecision("net_income_ttm"),
    ocfTtm: doublePrecision("ocf_ttm"),
    fcfTtm: doublePrecision("fcf_ttm"),
    dnaTtm: doublePrecision("dna_ttm"),
    capexTtm: doublePrecision("capex_ttm"),
    totalAssets: doublePrecision("total_assets"),
    currentAssets: doublePrecision("current_assets"),
    cash: doublePrecision("cash"),
    stInvestments: doublePrecision("st_investments"),
    currentLiabilities: doublePrecision("current_liabilities"),
    noncurrentLiabilities: doublePrecision("noncurrent_liabilities"),
    stDebt: doublePrecision("st_debt"),
    ltDebt: doublePrecision("lt_debt"),
    grossDebt: doublePrecision("gross_debt"),
    netDebt: doublePrecision("net_debt"),
    equity: doublePrecision("equity"),
    workingCapital: doublePrecision("working_capital"),
    netCurrentAssets: doublePrecision("net_current_assets"),
    investedCapital: doublePrecision("invested_capital"),
    nopatTtm: doublePrecision("nopat_ttm"),
  },
  (t) => [
    primaryKey({ columns: [t.cnpj, t.refDate, t.scope] }),
    index("fund_statements_cnpj_latest_idx").on(t.cnpj, t.isLatest),
  ],
);
