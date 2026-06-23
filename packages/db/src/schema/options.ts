import { bigint, date, doublePrecision, index, integer, pgTable, text } from "drizzle-orm/pg-core";

// mart_options__quotes — histórico EOD de opções (só sessões negociadas).
export const optionsQuotes = pgTable(
  "options_quotes",
  {
    optionTicker: text("option_ticker").notNull(),
    underlyingTicker: text("underlying_ticker"),
    underlyingRoot: text("underlying_root"),
    optionType: text("option_type"), // call | put
    strike: doublePrecision("strike"),
    expiry: date("expiry", { mode: "string" }),
    date: date("date", { mode: "string" }).notNull(),
    open: doublePrecision("open"),
    high: doublePrecision("high"),
    low: doublePrecision("low"),
    last: doublePrecision("last"),
    volumeBrl: doublePrecision("volume_brl"),
    trades: bigint("trades", { mode: "number" }),
    quantity: bigint("quantity", { mode: "number" }),
    underlyingSpot: doublePrecision("underlying_spot"),
    daysToExpiry: integer("days_to_expiry"),
    moneyness: doublePrecision("moneyness"),
    intrinsic: doublePrecision("intrinsic"),
    timeValue: doublePrecision("time_value"),
    iv: doublePrecision("iv"),
    delta: doublePrecision("delta"),
    gamma: doublePrecision("gamma"),
    vega: doublePrecision("vega"),
    theta: doublePrecision("theta"),
  },
  (t) => [
    index("options_quotes_option_date_idx").on(t.optionTicker, t.date),
    index("options_quotes_underlying_date_idx").on(t.underlyingTicker, t.date),
  ],
);

// mart_options__chain — cadeia vigente: 1 linha por série viva (cotação mais recente).
export const optionsChain = pgTable(
  "options_chain",
  {
    optionTicker: text("option_ticker").notNull(),
    underlyingTicker: text("underlying_ticker"),
    underlyingRoot: text("underlying_root"),
    optionType: text("option_type"),
    strike: doublePrecision("strike"),
    expiry: date("expiry", { mode: "string" }),
    date: date("date", { mode: "string" }),
    last: doublePrecision("last"),
    volumeBrl: doublePrecision("volume_brl"),
    trades: bigint("trades", { mode: "number" }),
    underlyingSpot: doublePrecision("underlying_spot"),
    daysToExpiry: integer("days_to_expiry"),
    moneyness: doublePrecision("moneyness"),
    intrinsic: doublePrecision("intrinsic"),
    timeValue: doublePrecision("time_value"),
    iv: doublePrecision("iv"),
    delta: doublePrecision("delta"),
    gamma: doublePrecision("gamma"),
    vega: doublePrecision("vega"),
    theta: doublePrecision("theta"),
    // IV/Greeks AMERICANOS (binomial CRR) — fecham o viés de exercício antecipado.
    ivAmer: doublePrecision("iv_amer"),
    deltaAmer: doublePrecision("delta_amer"),
    gammaAmer: doublePrecision("gamma_amer"),
    vegaAmer: doublePrecision("vega_amer"),
    thetaAmer: doublePrecision("theta_amer"),
    earlyExPremium: doublePrecision("early_ex_premium"),
  },
  (t) => [
    index("options_chain_underlying_idx").on(t.underlyingTicker, t.expiry),
    index("options_chain_option_idx").on(t.optionTicker),
  ],
);
