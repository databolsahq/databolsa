import { BadRequestError, NotFoundError } from "../middleware/errors";
import { companyRepo } from "../repositories/company.repo";
import { SORT_FIELDS, indicatorRepo, type ScreenOpts } from "../repositories/indicator.repo";
import { priceRepo } from "../repositories/price.repo";
import { INDICATORS, buildIndicators, scaleValue, type IndicatorUnit } from "../lib/indicators";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface ScreenQuery extends PaginationQuery {
  pl_min?: number;
  pl_max?: number;
  pvp_min?: number;
  pvp_max?: number;
  dy_min?: number;
  roe_min?: number;
  ev_ebitda_max?: number;
  div_liq_ebitda_max?: number;
  sector?: string;
  segment?: string;
  sort?: string;
}

// Indicators not in the fundamentals mart (INDICATORS) but appended to a snapshot from
// other sources: free_float (CVM FRE) and the price-stats (mart_prices__stats). `?names=`
// must accept these too, or it rejects names a full snapshot would otherwise include.
const DYNAMIC_INDICATORS = new Set([
  "free_float",
  "retorno_12m",
  "volatilidade",
  "beta",
  "volume_medio_2m",
]);

function parseSort(sort?: string): { sortField: string; sortDir: "asc" | "desc" } {
  if (!sort) return { sortField: "dy_12m", sortDir: "desc" };
  const descending = sort.startsWith("-");
  return { sortField: sort.replace(/^[-+]/, ""), sortDir: descending ? "desc" : "asc" };
}

export const indicatorService = {
  // Snapshot — TTM by default; `at` gives a point-in-time read (latest <= at). Fundamentals
  // are company-level, so a non-main share class resolves through its company's cnpj.
  async snapshot(ticker: string, names?: string[], at?: string) {
    if (names?.length) {
      const unknown = names.filter((n) => !(n in INDICATORS) && !DYNAMIC_INDICATORS.has(n));
      if (unknown.length) {
        throw new BadRequestError(
          `indicador(es) desconhecido(s): ${unknown.join(", ")}. Veja /metodologia`,
        );
      }
    }
    let row = await indicatorRepo.snapshot(ticker, at);
    let company = null;
    if (!row) {
      company = await companyRepo.byTicker(ticker);
      if (company) row = await indicatorRepo.snapshotByCnpj(company.cnpj, at);
    }
    if (!row) {
      const known = company != null || (await priceRepo.exists(ticker));
      throw new NotFoundError(
        known ? `Sem indicadores fundamentalistas para ${ticker}` : `Ticker ${ticker} não encontrado`,
      );
    }
    const indicators = buildIndicators(row, names);
    const wants = (n: string) => !names?.length || names.includes(n);
    const methodology = (n: string) => `/metodologia#${n}`;
    // free_float é nível-companhia (FRE distribuição de capital), não está no mart de
    // indicadores fundamentalistas — anexado aqui a partir do cadastro.
    if (wants("free_float")) {
      company = company ?? (await companyRepo.byTicker(ticker));
      if (company?.freeFloatPct != null) {
        indicators.push({
          name: "free_float",
          label: "Free float",
          value: company.freeFloatPct, // já em pontos percentuais (ex.: 61.2)
          unit: "percent",
          reason: null,
          reference_date: row.evalDate,
          ttm: false,
          lineage: { source: "cvm_fre", reference: "FRE — distribuição do capital (% em circulação)", url: null },
          methodology_url: methodology("free_float"),
        });
      }
    }
    // Performance e risco: derivados da série de preços (mart_prices__stats), não dos
    // fundamentos — anexados quando disponíveis (já em % onde aplicável).
    const PRICE_STATS: { name: string; label: string; unit: IndicatorUnit; key: "retorno12m" | "volatilidade" | "beta" | "volumeMedio2m" }[] = [
      { name: "retorno_12m", label: "Retorno 12m", unit: "percent", key: "retorno12m" },
      { name: "volatilidade", label: "Volatilidade anual.", unit: "percent", key: "volatilidade" },
      { name: "beta", label: "Beta (vs IBOV)", unit: "ratio", key: "beta" },
      { name: "volume_medio_2m", label: "Volume médio 2m", unit: "brl", key: "volumeMedio2m" },
    ];
    if (PRICE_STATS.some((d) => wants(d.name))) {
      const stats = await priceRepo.stats(ticker);
      if (stats) {
        for (const d of PRICE_STATS) {
          if (!wants(d.name)) continue;
          const value = stats[d.key] ?? null;
          indicators.push({
            name: d.name,
            label: d.label,
            value,
            unit: d.unit,
            reason: value == null ? "indicador não disponível para esta data" : null,
            reference_date: stats.referenceDate ?? row.evalDate,
            ttm: false,
            lineage: {
              source: d.name === "beta" ? "b3_cotahist+b3_indices" : "b3_cotahist",
              reference: `série ajustada · ${stats.referenceDate ?? "n/d"}`,
              url: null,
            },
            methodology_url: methodology(d.name),
          });
        }
      }
    }
    return { ticker, reference_date: row.evalDate, is_financial: row.isFinancial ?? false, indicators };
  },

  // History of one indicator across the quarterly eval_dates (year-by-year source).
  async history(ticker: string, name: string, from?: string, to?: string) {
    const def = INDICATORS[name];
    if (!def) throw new BadRequestError(`indicador desconhecido: ${name}. Veja /metodologia`);
    let rows = await indicatorRepo.history(ticker, from, to);
    let company = null;
    if (!rows.length) {
      company = await companyRepo.byTicker(ticker);
      if (company) rows = await indicatorRepo.historyByCnpj(company.cnpj, from, to);
    }
    if (!rows.length) {
      const known = company != null || (await priceRepo.exists(ticker));
      if (!known) throw new NotFoundError(`Ticker ${ticker} não encontrado`);
    }
    return {
      ticker,
      name,
      label: def.label,
      unit: def.unit,
      observations: rows.map((r) => ({
        date: r.evalDate,
        value: scaleValue(r[def.column] as number | null, def.unit),
      })),
    };
  },

  async screen(q: ScreenQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const { sortField, sortDir } = parseSort(q.sort);
    if (q.sort && !SORT_FIELDS.includes(sortField)) {
      throw new BadRequestError(
        `campo de ordenação inválido: '${sortField}'. Use um de: ${SORT_FIELDS.join(", ")}`,
      );
    }
    // sector and segment both narrow the universe to a cnpj set; with both present we
    // intersect (a company must match the sector AND the listing segment).
    const cnpjSets: string[][] = [];
    if (q.sector) cnpjSets.push(await companyRepo.cnpjsBySector(q.sector));
    if (q.segment) cnpjSets.push(await companyRepo.cnpjsBySegment(q.segment));
    const cnpjs = cnpjSets.length
      ? cnpjSets.reduce((acc, s) => acc.filter((c) => s.includes(c)))
      : undefined;
    const opts: ScreenOpts = {
      pl_min: q.pl_min,
      pl_max: q.pl_max,
      pvp_min: q.pvp_min,
      pvp_max: q.pvp_max,
      dy_min: q.dy_min,
      roe_min: q.roe_min,
      ev_ebitda_max: q.ev_ebitda_max,
      div_liq_ebitda_max: q.div_liq_ebitda_max,
      cnpjs,
      sortField,
      sortDir,
      ...page,
    };
    const rows = await indicatorRepo.screen(opts);
    const sectors = await companyRepo.sectorByCnpj(rows.map((r) => r.cnpj));
    const mapped = rows.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      sector: sectors.get(r.cnpj) ?? null,
      indicators: {
        market_cap: scaleValue(r.marketCap, "brl"),
        pl: scaleValue(r.pl, "ratio"),
        pvp: scaleValue(r.pvp, "ratio"),
        dy: scaleValue(r.dy12m, "percent"),
        roe: scaleValue(r.roe, "percent"),
        roic: scaleValue(r.roic, "percent"),
        ev_ebitda: scaleValue(r.evEbitda, "ratio"),
        div_liq_ebitda: scaleValue(r.divLiquidaEbitda, "ratio"),
        margem_liquida: scaleValue(r.margemLiquida, "percent"),
      },
    }));
    return paginate(mapped, page);
  },
};
