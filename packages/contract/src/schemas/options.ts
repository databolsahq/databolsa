import { z } from "../zod";
import { paginated } from "./pagination";

// Uma série de opção na cadeia. Preço NÃO ajustado (strike é nominal). IV/Greeks
// ainda não calculados (sem numpy/scipy no warehouse; Black-Scholes em SQL é o próximo passo).
export const optionContract = z
  .object({
    option_ticker: z.string(),
    underlying_ticker: z.string().nullable(),
    underlying_root: z.string().nullable(),
    option_type: z.string().nullable().describe("call | put"),
    strike: z.number().nullable(),
    expiry: z.string().nullable(),
    date: z.string().nullable(),
    last: z.number().nullable(),
    volume_brl: z.number().nullable(),
    trades: z.number().nullable(),
    underlying_spot: z.number().nullable(),
    days_to_expiry: z.number().nullable(),
    moneyness: z.number().nullable().describe("spot / strike"),
    intrinsic: z.number().nullable(),
    time_value: z.number().nullable(),
    iv: z.number().nullable().describe("vol implícita anualizada (Black-Scholes europeu)"),
    delta: z.number().nullable(),
    gamma: z.number().nullable(),
    vega: z.number().nullable().describe("por 1% de vol"),
    theta: z.number().nullable().describe("por dia corrido"),
    iv_amer: z.number().nullable().describe("IV americana (binomial CRR) — corrige exercício antecipado; relevante em puts"),
    delta_amer: z.number().nullable(),
    gamma_amer: z.number().nullable(),
    vega_amer: z.number().nullable().describe("por 1% de vol"),
    theta_amer: z.number().nullable().describe("por dia corrido"),
    early_ex_premium: z.number().nullable().describe("prêmio de exercício antecipado: preço americano − europeu (mesmo σ)"),
  })
  .openapi({ ref: "OptionContract" });

// Cadeia vigente de um subjacente (não paginada — limitada no servidor; filtre por
// expiry/type para reduzir).
export const optionsChain = z
  .object({
    underlying_ticker: z.string(),
    date: z.string().nullable(),
    count: z.number(),
    options: z.array(optionContract),
  })
  .openapi({ ref: "OptionsChain" });

export const optionExpiries = z
  .object({
    underlying_ticker: z.string(),
    expiries: z.array(z.object({ expiry: z.string(), count: z.number() })),
  })
  .openapi({ ref: "OptionExpiries" });

// Cotação EOD de uma série (histórico paginado; só sessões negociadas).
export const optionQuote = z
  .object({
    date: z.string(),
    option_ticker: z.string(),
    option_type: z.string().nullable(),
    strike: z.number().nullable(),
    expiry: z.string().nullable(),
    open: z.number().nullable(),
    high: z.number().nullable(),
    low: z.number().nullable(),
    last: z.number().nullable(),
    volume_brl: z.number().nullable(),
    trades: z.number().nullable(),
    underlying_spot: z.number().nullable(),
    moneyness: z.number().nullable(),
    intrinsic: z.number().nullable(),
    time_value: z.number().nullable(),
    iv: z.number().nullable(),
    delta: z.number().nullable(),
    gamma: z.number().nullable(),
    vega: z.number().nullable(),
    theta: z.number().nullable(),
  })
  .openapi({ ref: "OptionQuote" });

export const optionsQuotesResponse = paginated(optionQuote);
