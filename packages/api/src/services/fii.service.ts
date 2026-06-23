import { BadRequestError, NotFoundError } from "../middleware/errors";
import { fiiRepo } from "../repositories/fii.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";
import type { IndicatorUnit } from "../lib/indicators";

export interface FiiRangeQuery extends PaginationQuery {
  from?: string;
  to?: string;
}

export interface FiiListQuery extends PaginationQuery {
  segment?: string;
  paper?: "true" | "false";
  /** campo de ordenação; prefixo `-` = descendente (ex.: `-dy`) */
  sort?: string;
}

// Campos que o listing ordena (o repo mapeia coluna; ticker é o default estável).
const FII_SORT_FIELDS = ["ticker", "preco", "dy", "dy_12m", "pvp", "vacancia", "pl", "patrimonio_liquido"];

const METHODOLOGY = "/metodologia";

// Definição dos indicadores de FII servidos a partir da linha larga mart_fii__indicators.
const FII_INDICATORS: { key: string; label: string; unit: IndicatorUnit; brick?: boolean }[] = [
  { key: "preco", label: "Cota a mercado", unit: "brl_per_share" },
  { key: "dy_12m", label: "Dividend yield 12m", unit: "percent" },
  { key: "ffo_yield", label: "FFO yield 12m", unit: "percent" },
  { key: "pvp", label: "P/VP", unit: "ratio" },
  { key: "vp_cota", label: "Valor patrimonial/cota", unit: "brl_per_share" },
  { key: "dividend_yield_mes", label: "Dividend yield mês", unit: "percent" },
  { key: "patrimonio_liquido", label: "Patrimônio líquido", unit: "brl" },
  { key: "cotistas", label: "Nº de cotistas", unit: "count" },
  // imobiliários (informe trimestral) — só fundos de tijolo
  { key: "vacancia_fisica", label: "Vacância física", unit: "percent", brick: true },
  { key: "cap_rate", label: "Cap rate", unit: "percent", brick: true },
  { key: "qtd_imoveis", label: "Qtd. de imóveis", unit: "count", brick: true },
  { key: "area_m2", label: "Área bruta locável (m²)", unit: "count", brick: true },
  { key: "preco_m2", label: "Preço do m²", unit: "brl", brick: true },
  { key: "aluguel_m2", label: "Aluguel por m² (mês)", unit: "brl", brick: true },
];

// Indicadores de FII com série histórica (informe mensal). Subconjunto do snapshot:
// só o que o mart_fii__reports carrega ao longo do tempo. Valores RAW (mesma escala
// do snapshot — formatação por unidade fica no cliente).
const FII_HISTORY: Record<
  string,
  { label: string; unit: IndicatorUnit; pick: (r: FiiReportRow) => number | null }
> = {
  vp_cota: { label: "Valor patrimonial/cota", unit: "brl_per_share", pick: (r) => r.valuePerShare },
  dividend_yield_mes: { label: "Dividend yield mês", unit: "percent", pick: (r) => r.monthlyDividendYieldPct },
  patrimonio_liquido: { label: "Patrimônio líquido", unit: "brl", pick: (r) => r.netAssetValue },
  cotistas: { label: "Nº de cotistas", unit: "count", pick: (r) => r.shareholders },
};

type FiiReportRow = Awaited<ReturnType<typeof fiiRepo.history>>[number];

export const fiiService = {
  // Universo de FIIs (mart_fii__profile + snapshot de indicadores). Valores RAW,
  // no mesmo formato que `indicators()` serve por-ticker, para o web renderizar
  // igual (formatação por unidade fica no cliente).
  async list(q: FiiListQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const sortField = (q.sort ?? "").replace(/^-/, "") || "ticker";
    if (q.sort && !FII_SORT_FIELDS.includes(sortField)) {
      throw new BadRequestError(
        `campo de ordenação inválido: '${sortField}'. Use um de: ${FII_SORT_FIELDS.join(", ")}`,
      );
    }
    const rows = await fiiRepo.list({
      segment: q.segment,
      paper: q.paper == null ? undefined : q.paper === "true",
      sortField,
      sortDir: q.sort?.startsWith("-") ? "desc" : "asc",
      ...page,
    });
    const data = rows.map((r) => ({
      ticker: r.ticker,
      name: r.name,
      segment: r.segment,
      is_paper: r.isPaper ?? false,
      reference_date: r.referenceDate,
      preco: r.preco,
      dy_12m: r.dy12m,
      pvp: r.pvp,
      vacancia_fisica: r.vacanciaFisica,
      patrimonio_liquido: r.patrimonioLiquido,
    }));
    return paginate(data, page);
  },

  async get(ticker: string) {
    const row = await fiiRepo.profile(ticker);
    if (!row) throw new NotFoundError(`FII ${ticker} não encontrado`);
    return {
      ticker: row.ticker,
      cnpj: row.cnpj,
      name: row.name,
      segment: row.segment,
      administrator: row.administrator,
      manager: row.manager,
      is_paper: row.isPaper ?? false,
    };
  },

  async indicators(ticker: string) {
    const row = await fiiRepo.indicators(ticker);
    if (!row) {
      // perfil existe mas sem indicadores? então 404 só se o ticker é desconhecido
      if (!(await fiiRepo.profile(ticker))) throw new NotFoundError(`FII ${ticker} não encontrado`);
      return { ticker, reference_date: null, indicators: [] };
    }
    const reference_date = row.referenceDate;
    const values: Record<string, number | null> = {
      preco: row.preco,
      dy_12m: row.dy12m,
      ffo_yield: row.ffoYield,
      pvp: row.pvp,
      vp_cota: row.vpCota,
      dividend_yield_mes: row.dividendYieldMes,
      patrimonio_liquido: row.patrimonioLiquido,
      cotistas: row.cotistas,
      vacancia_fisica: row.vacanciaFisica,
      cap_rate: row.capRate,
      qtd_imoveis: row.qtdImoveis,
      area_m2: row.areaM2,
      preco_m2: row.precoM2,
      aluguel_m2: row.aluguelM2,
    };
    const isPaper = row.isPaper ?? false;
    const TRIMESTRAL = new Set([
      "vacancia_fisica",
      "cap_rate",
      "qtd_imoveis",
      "area_m2",
      "preco_m2",
      "aluguel_m2",
    ]);
    const lineageSource = (key: string) => {
      if (key === "preco") return "b3_cotahist";
      if (TRIMESTRAL.has(key)) return "cvm_fii_informe_trimestral";
      return "cvm_fii_informe_mensal";
    };
    const indicators = FII_INDICATORS.map((d) => {
      const value = values[d.key] ?? null;
      const reason =
        value != null
          ? null
          : d.brick && isPaper
            ? "fundo de papel"
            : "indicador não disponível para esta data";
      return {
        name: d.key,
        label: d.label,
        value,
        unit: d.unit,
        reason,
        reference_date,
        ttm: d.key === "dy_12m",
        lineage: {
          source: lineageSource(d.key),
          reference: `FII ${ticker} · ${reference_date ?? "n/d"}`,
          url: null,
        },
        methodology_url: `${METHODOLOGY}#${d.key}`,
      };
    });
    return { ticker, reference_date, indicators };
  },

  // Histórico de um indicador ao longo do informe mensal (gráfico + tabela no web).
  async history(ticker: string, name: string, from?: string, to?: string) {
    const def = FII_HISTORY[name];
    if (!def) {
      throw new BadRequestError(
        `indicador histórico desconhecido p/ FII: ${name}. Use: ${Object.keys(FII_HISTORY).join(", ")}`,
      );
    }
    const rows = await fiiRepo.history(ticker, { from, to });
    if (!rows.length && !(await fiiRepo.profile(ticker))) {
      throw new NotFoundError(`FII ${ticker} não encontrado`);
    }
    return {
      ticker,
      name,
      label: def.label,
      unit: def.unit,
      // informe mensal "YYYY-MM" → data ISO no 1º dia do mês (eixo temporal)
      observations: rows.map((r) => ({ date: `${r.referenceMonth}-01`, value: def.pick(r) })),
    };
  },

  async distributions(ticker: string, q: FiiRangeQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await fiiRepo.distributions(ticker, { from: q.from, to: q.to, ...page });
    if (!rows.length && page.offset === 0 && !(await fiiRepo.profile(ticker))) {
      throw new NotFoundError(`FII ${ticker} não encontrado`);
    }
    const data = rows.map((r) => ({
      ex_date: r.exDate,
      payment_date: r.paymentDate,
      value_per_share: r.valuePerShare,
      tax_free: r.taxFree ?? true,
    }));
    return paginate(data, page);
  },

  async reports(ticker: string, q: FiiRangeQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await fiiRepo.reports(ticker, { from: q.from, to: q.to, ...page });
    if (!rows.length && page.offset === 0 && !(await fiiRepo.profile(ticker))) {
      throw new NotFoundError(`FII ${ticker} não encontrado`);
    }
    const data = rows.map((r) => ({
      reference_month: r.referenceMonth,
      net_asset_value: r.netAssetValue,
      value_per_share: r.valuePerShare,
      monthly_dividend_yield_pct: r.monthlyDividendYieldPct,
      shareholders: r.shareholders,
      shares_issued: r.sharesIssued,
    }));
    return paginate(data, page);
  },
};
