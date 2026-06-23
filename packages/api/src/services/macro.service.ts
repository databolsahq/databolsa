import { macroRepo, type MacroRow } from "../repositories/macro.repo";
import { marketsRepo } from "../repositories/markets.repo";

// Contract `gear` enum -> mart `section`. cross_asset lives in its own mart.
const GEAR_TO_SECTION: Record<string, string> = {
  monetary: "juro_real",
  inflation: "inflacao",
  growth: "crescimento",
  employment: "emprego",
  credit: "credito",
  fiscal: "fiscal",
  external: "externo",
  sovereign_risk: "risco",
  global: "global",
  currency: "moeda",
};
const ALL_GEARS = [...Object.keys(GEAR_TO_SECTION), "cross_asset"];

// RegimeSignal.direction — latest vs the prior observation (null when undeterminable).
function trend(value: number | null, prev: number | null): "up" | "down" | "flat" | null {
  if (value == null || prev == null) return null;
  const eps = Math.max(Math.abs(prev), Math.abs(value), 1) * 1e-9;
  if (value > prev + eps) return "up";
  if (value < prev - eps) return "down";
  return "flat";
}

function toSignal(section: string, r: MacroRow) {
  return {
    name: r.indicator_id,
    value: r.value,
    direction: trend(r.value, r.prev_value),
    // `lineage` in the mart is a provenance string (e.g. "sgs:432;focus:..."); surfaced
    // as the source per the contract's Lineage object.
    lineage: { source: r.lineage ?? section, reference: `${section}/${r.indicator_id}`, url: null },
    // additive context beyond RegimeSignal — the value's unit and observation date
    unit: r.unit,
    label: r.label,
    date: r.date,
  };
}

// regime_quadrante (1–4, per mart_macro__regime CASE) -> contract enum.
const QUADRANT: Record<number, string> = {
  1: "growth_up_inflation_up",
  2: "growth_up_inflation_down",
  3: "growth_down_inflation_up",
  4: "growth_down_inflation_down",
};

// Axis direction from the score sign ([-1,1]; +1 = every signal positive).
function axisDirection(score: number | null | undefined): "up" | "down" | "flat" | null {
  if (score == null) return null;
  if (score > 1e-9) return "up";
  if (score < -1e-9) return "down";
  return "flat";
}

// Signals surfaced per axis: decimal-rate indicators from the loaded marts (the regime
// mart publishes only the aggregate scores). All render correctly under the UI's default
// percent format; `section` drives each signal's lineage reference.
const GROWTH_SIGNALS = [
  { id: "ibc_br_momentum_12m", section: "crescimento" },
  { id: "producao_industrial_yoy", section: "crescimento" },
  { id: "desemprego_pnad", section: "emprego" },
] as const;
const INFLATION_SIGNALS = [
  { id: "ipca_12m", section: "inflacao" },
  { id: "breakeven_5y", section: "inflacao" },
  { id: "ancoragem_expectativas", section: "inflacao" },
  { id: "surpresa_inflacao", section: "inflacao" },
] as const;

export const macroService = {
  async gears(gear?: string, at?: string) {
    const wanted = gear ? [gear] : ALL_GEARS;
    const gears = [];
    let maxDate: string | null = null;
    for (const g of wanted) {
      const section = g === "cross_asset" ? "cross_asset" : GEAR_TO_SECTION[g]!;
      const rows =
        g === "cross_asset"
          ? await macroRepo.crossAssetLatest(at)
          : await macroRepo.latestBySection(section, at);
      for (const r of rows) if (r.date && (!maxDate || r.date > maxDate)) maxDate = r.date;
      gears.push({ gear: g, indicators: rows.map((r) => toSignal(section, r)) });
    }
    // as_of reflects the data (latest observed date), not the wall clock — so the
    // response is a pure function of (params, dataset version) and fully cacheable.
    return { as_of: at ?? maxDate, gears };
  },

  // RegimeSnapshot: the published quadrant + scores (mart_macro__regime) plus the
  // individual signals (macro_indicators) and cross-asset spreads (macro_cross_asset),
  // assembled into the contract shape.
  async regime(at?: string) {
    const [regimeRows, cresc, emp, infl, juro, cross] = await Promise.all([
      macroRepo.regimeLatest(at),
      macroRepo.latestBySection("crescimento", at),
      macroRepo.latestBySection("emprego", at),
      macroRepo.latestBySection("inflacao", at),
      macroRepo.latestBySection("juro_real", at),
      macroRepo.crossAssetLatest(at),
    ]);

    const regimeById = new Map(regimeRows.map((r) => [r.indicator_id, r]));
    const quadrantVal = regimeById.get("regime_quadrante")?.value;
    const quadrant = quadrantVal != null ? (QUADRANT[Math.round(quadrantVal)] ?? null) : null;

    const bySection: Record<string, Map<string, MacroRow>> = {
      crescimento: new Map(cresc.map((r) => [r.indicator_id, r])),
      emprego: new Map(emp.map((r) => [r.indicator_id, r])),
      inflacao: new Map(infl.map((r) => [r.indicator_id, r])),
    };
    const pick = (specs: ReadonlyArray<{ id: string; section: string }>) =>
      specs
        .map(({ id, section }) => {
          const row = bySection[section]?.get(id);
          return row ? toSignal(section, row) : null;
        })
        .filter((s): s is ReturnType<typeof toSignal> => s !== null);

    // Cross-asset spreads are stored as decimals (a.a.); the contract documents these in
    // p.p., so scale ×100. real_selic stays decimal (the UI renders it as a percent).
    const crossById = new Map(cross.map((r) => [r.indicator_id, r.value]));
    const pp = (v: number | null | undefined) => (v == null ? null : v * 100);
    const realSelic = juro.find((r) => r.indicator_id === "juro_real_ex_post")?.value ?? null;

    // Monthly grain — as_of is the latest regime month (data-derived, fully cacheable).
    const as_of =
      at ?? regimeRows.reduce<string | null>((m, r) => (r.date && (!m || r.date > m) ? r.date : m), null);

    return {
      as_of,
      quadrant,
      growth: {
        direction: axisDirection(regimeById.get("regime_growth_score")?.value),
        signals: pick(GROWTH_SIGNALS),
      },
      inflation: {
        direction: axisDirection(regimeById.get("regime_inflation_score")?.value),
        signals: pick(INFLATION_SIGNALS),
      },
      cross_asset: {
        dy_vs_selic_spread: pp(crossById.get("dy_agregado_vs_selic")),
        equity_risk_premium: pp(crossById.get("erp_earnings_yield_vs_ntnb10")),
        real_selic: realSelic,
      },
    };
  },

  // Expectativas Focus (consenso por indicador/ano) + realizado (camada analítica
  // futura → null por ora, não inventado).
  async expectations(indicator: string, q: { reference?: string; from?: string; to?: string }) {
    const rows = await marketsRepo.expectations(indicator, q);
    return {
      indicator,
      reference: q.reference ?? null,
      realized: null as number | null,
      surveys: rows.map((r) => ({
        survey_date: r.surveyDate,
        reference: r.reference,
        median: r.median,
        mean: r.mean,
        std_dev: r.stdDev,
        respondents: r.respondents,
        base: r.base,
      })),
    };
  },
};
