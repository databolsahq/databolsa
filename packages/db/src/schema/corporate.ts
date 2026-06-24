import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  pgTable,
  text,
} from "drizzle-orm/pg-core";

// Serving mirror of the corporate-actions marts. Like the other serving tables
// these have no clean natural key (an issuer can pay two JCP on the same ex_date),
// so no PK — load_postgres.py does DELETE+INSERT and the API only ever reads.

// mart_b3__dividends — proventos por ticker (DIVIDENDO|JCP). JCP net = 85% (15% IRRF).
export const dividends = pgTable(
  "dividends",
  {
    ticker: text("ticker").notNull(),
    type: text("type").notNull(),
    exDate: date("ex_date", { mode: "string" }).notNull(),
    paymentDate: date("payment_date", { mode: "string" }),
    valuePerShareGross: doublePrecision("value_per_share_gross"),
    valuePerShareNet: doublePrecision("value_per_share_net"),
  },
  (t) => [index("dividends_ticker_ex_idx").on(t.ticker, t.exDate)],
);

// mart_b3__events — eventos societários (split/reverse_split/bonification), factor normalizado.
export const corporateEvents = pgTable(
  "corporate_events",
  {
    ticker: text("ticker").notNull(),
    type: text("type").notNull(),
    approvedDate: date("approved_date", { mode: "string" }),
    exDate: date("ex_date", { mode: "string" }).notNull(),
    factor: doublePrecision("factor"),
    detail: text("detail"),
  },
  (t) => [index("corporate_events_ticker_ex_idx").on(t.ticker, t.exDate)],
);

// mart_cvm__insider — fluxo mensal de insiders (VLMO) por CNPJ (nível-companhia).
export const insiderMoves = pgTable(
  "insider_moves",
  {
    cnpj: text("cnpj").notNull(),
    referenceMonth: text("reference_month").notNull(),
    netShares: doublePrecision("net_shares"),
    netValueBrl: doublePrecision("net_value_brl"),
    buyValueBrl: doublePrecision("buy_value_brl"),
    sellValueBrl: doublePrecision("sell_value_brl"),
  },
  (t) => [index("insider_moves_cnpj_idx").on(t.cnpj, t.referenceMonth)],
);

// mart_cvm__documents — índice IPE/CVM (metadados; has_text=false até pipeline de texto).
export const companyDocuments = pgTable(
  "company_documents",
  {
    cvmCode: bigint("cvm_code", { mode: "number" }).notNull(),
    category: text("category"),
    type: text("type"),
    subject: text("subject"),
    referenceDate: date("reference_date", { mode: "string" }),
    filedAt: date("filed_at", { mode: "string" }),
    protocol: text("protocol"),
    downloadUrl: text("download_url"),
    hasText: boolean("has_text"),
  },
  (t) => [index("company_documents_cvm_idx").on(t.cvmCode, t.filedAt)],
);
