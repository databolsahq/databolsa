import {
  bigint,
  boolean,
  doublePrecision,
  index,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// mart_fund__company — consolidated registry: CNPJ <-> tickers <-> sector <-> segment.
// The mart has no clean natural key (cnpj and cd_cvm both repeat across re-registrations),
// so we carry a surrogate `id` and the loader dedups to one row per cd_cvm. `tickers` is a
// comma-joined string from the mart (string_agg), not a real array — split on read if needed.
export const companies = pgTable(
  "companies",
  {
    id: serial("id").primaryKey(),
    cnpj: text("cnpj").notNull(),
    cdCvm: bigint("cd_cvm", { mode: "number" }),
    companyName: text("company_name"),
    sector: text("sector"),
    status: text("status"),
    issuerStatus: text("issuer_status"),
    ownershipControl: text("ownership_control"),
    tickers: text("tickers"),
    listingSegment: text("listing_segment"),
    hasActiveTicker: boolean("has_active_ticker"),
    freeFloatPct: doublePrecision("free_float_pct"),
    onShares: bigint("on_shares", { mode: "number" }),
    pnShares: bigint("pn_shares", { mode: "number" }),
    totalShares: bigint("total_shares", { mode: "number" }),
  },
  (t) => [
    uniqueIndex("companies_cd_cvm_key").on(t.cdCvm),
    index("companies_cnpj_idx").on(t.cnpj),
    index("companies_sector_idx").on(t.sector),
  ],
);
