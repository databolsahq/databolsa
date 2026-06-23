import { paperIndicators } from "@databolsa/db";

// O snapshot/screener servem do grão por-papel (paper_indicators); o Row reflete isso —
// é onde vive is_financial e os múltiplos por classe.
type Row = typeof paperIndicators.$inferSelect;

// The contract's explicit unit semantics: percent => 8.1 means 8,1% (never 0.081);
// ratio => a pure multiple (P/L 12.3). The marts store ratios/percentages as decimals
// (dy_12m = 0.081), so percent-unit indicators are multiplied by 100 on the way out.
export type IndicatorUnit = "ratio" | "percent" | "brl" | "brl_per_share" | "count" | "days";

interface IndicatorDef {
  column: keyof Row;
  label: string;
  unit: IndicatorUnit;
}

export const INDICATORS: Record<string, IndicatorDef> = {
  // valuation (pure multiples)
  pl: { column: "pl", label: "P/L", unit: "ratio" },
  pvp: { column: "pvp", label: "P/VP", unit: "ratio" },
  psr: { column: "psr", label: "P/Receita", unit: "ratio" },
  p_ebit: { column: "pEbit", label: "P/EBIT", unit: "ratio" },
  p_fcf: { column: "pFcf", label: "P/FCF", unit: "ratio" },
  p_ativos: { column: "pAtivos", label: "P/Ativos", unit: "ratio" },
  p_cap_giro: { column: "pCapGiro", label: "P/Capital de Giro", unit: "ratio" },
  p_ativo_circ_liq: { column: "pAtivoCircLiq", label: "P/Ativo Circ. Líq.", unit: "ratio" },
  ev_ebitda: { column: "evEbitda", label: "EV/EBITDA", unit: "ratio" },
  ev_ebit: { column: "evEbit", label: "EV/EBIT", unit: "ratio" },
  // per-share (BRL)
  lpa: { column: "lpa", label: "LPA", unit: "brl_per_share" },
  vpa: { column: "vpa", label: "VPA", unit: "brl_per_share" },
  // profitability (percent)
  roe: { column: "roe", label: "ROE", unit: "percent" },
  roa: { column: "roa", label: "ROA", unit: "percent" },
  roic: { column: "roic", label: "ROIC", unit: "percent" },
  margem_bruta: { column: "margemBruta", label: "Margem Bruta", unit: "percent" },
  margem_ebit: { column: "margemEbit", label: "Margem EBIT", unit: "percent" },
  margem_liquida: { column: "margemLiquida", label: "Margem Líquida", unit: "percent" },
  ebit_ativos: { column: "ebitAtivos", label: "EBIT/Ativos", unit: "percent" },
  giro_ativos: { column: "giroAtivos", label: "Giro dos Ativos", unit: "ratio" },
  // leverage / liquidity. NOTE: registry keys are the CONTRACT names (what the web +
  // fixtures read), not the mart column names — e.g. key `div_liq_ebitda` → column
  // `divLiquidaEbitda`. Keep these aligned with the indicator-grid grouping.
  div_liq_ebitda: { column: "divLiquidaEbitda", label: "Dív. Líquida/EBITDA", unit: "ratio" },
  div_liq_pl: { column: "divLiquidaPl", label: "Dív. Líquida/PL", unit: "ratio" },
  div_bruta_pl: { column: "divBrutaPl", label: "Dív. Bruta/PL", unit: "ratio" },
  liquidez_corrente: { column: "liquidezCorrente", label: "Liquidez Corrente", unit: "ratio" },
  // dividends (percent)
  dy: { column: "dy12m", label: "Dividend Yield 12m", unit: "percent" },
  payout: { column: "payout", label: "Payout", unit: "percent" },
  jcp_share: { column: "jcpSobreTotal", label: "JCP / Proventos", unit: "percent" },
  // growth (percent)
  cagr_receita_3a: { column: "revenueCagr3y", label: "CAGR Receita 3a", unit: "percent" },
  cagr_receita_5a: { column: "revenueCagr5y", label: "CAGR Receita 5a", unit: "percent" },
  cagr_lucro_3a: { column: "earningsCagr3y", label: "CAGR Lucro 3a", unit: "percent" },
  cagr_lucro_5a: { column: "earningsCagr5y", label: "CAGR Lucro 5a", unit: "percent" },
  cagr_ebitda_3a: { column: "ebitdaCagr3y", label: "CAGR EBITDA 3a", unit: "percent" },
  // market context
  market_cap: { column: "marketCap", label: "Valor de Mercado", unit: "brl" },
  price: { column: "price", label: "Preço", unit: "brl" },
};

export const INDICATOR_NAMES = Object.keys(INDICATORS);

// Página de metodologia servida pela própria plataforma (âncora = nome do indicador).
const METHODOLOGY_BASE = "/metodologia";

// Indicators whose null is explained by negative equity (P/VP, ROE, ... go undefined).
const EQUITY_SENSITIVE = new Set([
  "pvp",
  "roe",
  "roa",
  "roic",
  "vpa",
  "div_liq_pl",
  "div_bruta_pl",
]);

// Indicadores que NÃO se aplicam a instituições financeiras (bancos/seguradoras): o plano
// de contas bancário não tem EBIT/EBITDA e a "receita" tem conceito próprio (intermediação),
// então margens, PSR e múltiplos de EBIT enganam. Servidos como null + motivo (P/L, P/VP,
// ROE, DY, LPA/VPA seguem válidos p/ banco).
const NOT_FOR_FINANCIALS = new Set([
  "margem_bruta",
  "margem_ebit",
  "margem_liquida",
  "psr",
  "p_ebit",
  "p_fcf",
  "ev_ebit",
  "ev_ebitda",
  "ebit_ativos",
  "giro_ativos",
]);
const FINANCIAL_REASON =
  "não se aplica a instituições financeiras (plano de contas bancário: sem EBIT/EBITDA e receita com conceito próprio)";

export function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

export function scaleValue(raw: number | null | undefined, unit: IndicatorUnit): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  return unit === "percent" ? round(raw * 100, 4) : round(raw, 6);
}

export interface IndicatorValue {
  name: string;
  label: string;
  value: number | null;
  unit: IndicatorUnit;
  reason: string | null;
  reference_date: string;
  ttm: boolean;
  lineage: { source: string; reference: string; url: string | null };
  methodology_url: string;
}

export function present(name: string, def: IndicatorDef, row: Row): IndicatorValue {
  const notForFinancial = row.isFinancial === true && NOT_FOR_FINANCIALS.has(name);
  const value = notForFinancial ? null : scaleValue(row[def.column] as number | null, def.unit);
  let reason: string | null = null;
  if (notForFinancial) {
    reason = FINANCIAL_REASON;
  } else if (value === null && def.unit !== "brl" && def.unit !== "brl_per_share") {
    reason =
      row.negativeEquity && EQUITY_SENSITIVE.has(name)
        ? "patrimônio líquido negativo"
        : "indicador não disponível para esta data";
  }
  return {
    name,
    label: def.label,
    value,
    unit: def.unit,
    reason,
    reference_date: row.evalDate,
    ttm: true,
    lineage: {
      source: "cvm_dfp_itr",
      reference: `${row.scope ?? "con"} TTM · demonstração ${row.statementDate ?? "n/d"}`,
      url: null,
    },
    methodology_url: `${METHODOLOGY_BASE}#${name}`,
  };
}

export function buildIndicators(row: Row, names?: string[]): IndicatorValue[] {
  const wanted =
    names && names.length ? names.filter((n) => n in INDICATORS) : INDICATOR_NAMES;
  return wanted.map((n) => present(n, INDICATORS[n]!, row));
}
