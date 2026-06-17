import { and, asc, desc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db, paperIndicators } from "@databolsa/db";

// Per-paper indicators (grão ticker): SAPR3/SAPR4/SAPR11 separados. Snapshot,
// histórico E screener leem daqui — a lista mostra 1 linha por papel (como o
// Fundamentus). fundIndicators (grão empresa) segue existindo p/ usos por-empresa.
const pi = paperIndicators;

// Whitelist of sort fields -> columns (the screener's `sort` is user input).
const SORT_COLUMNS = {
  pl: pi.pl,
  pvp: pi.pvp,
  psr: pi.psr,
  dy: pi.dy12m,
  dy_12m: pi.dy12m,
  roe: pi.roe,
  roic: pi.roic,
  ev_ebitda: pi.evEbitda,
  market_cap: pi.marketCap,
  margem_liquida: pi.margemLiquida,
} as const;

export const SORT_FIELDS = Object.keys(SORT_COLUMNS);

export interface ScreenOpts {
  pl_min?: number;
  pl_max?: number;
  pvp_min?: number;
  pvp_max?: number;
  dy_min?: number;
  roe_min?: number;
  ev_ebitda_max?: number;
  div_liq_ebitda_max?: number;
  // Allowed cnpj set when a sector filter is active. undefined = no filter; [] = the
  // sector matched no company (the screener then returns nothing).
  cnpjs?: string[];
  sortField: string;
  sortDir: "asc" | "desc";
  limit: number;
  offset: number;
}

export const indicatorRepo = {
  async maxEvalDate(): Promise<string | null> {
    const [r] = await db.select({ d: sql<string | null>`max(${pi.evalDate})` }).from(pi);
    return r?.d ?? null;
  },

  // Latest snapshot for a PAPER (optionally as-of a date — point-in-time). Lê do
  // grão por-papel: SAPR3/SAPR4/SAPR11 retornam preço/P-L/P-VP/DY próprios.
  async snapshot(ticker: string, at?: string) {
    const conds: SQL[] = [eq(pi.ticker, ticker)];
    if (at) conds.push(lte(pi.evalDate, at));
    const [row] = await db
      .select()
      .from(pi)
      .where(and(...conds))
      .orderBy(desc(pi.evalDate))
      .limit(1);
    return row ?? null;
  },

  // Fallback keyed by cnpj — quando o ticker pedido não está no grão por-papel
  // (ex.: classe sem preço recente). Retorna um papel representativo da empresa.
  async snapshotByCnpj(cnpj: string, at?: string) {
    const conds: SQL[] = [eq(pi.cnpj, cnpj)];
    if (at) conds.push(lte(pi.evalDate, at));
    const [row] = await db
      .select()
      .from(pi)
      .where(and(...conds))
      .orderBy(desc(pi.evalDate), asc(pi.ticker))
      .limit(1);
    return row ?? null;
  },

  // Full quarterly series for a paper (year-by-year, per papel).
  async history(ticker: string, from?: string, to?: string) {
    return this._history(eq(pi.ticker, ticker), from, to);
  },

  async historyByCnpj(cnpj: string, from?: string, to?: string) {
    return this._history(eq(pi.cnpj, cnpj), from, to);
  },

  async _history(keyCond: SQL, from?: string, to?: string) {
    const conds: SQL[] = [keyCond];
    if (from) conds.push(gte(pi.evalDate, from));
    if (to) conds.push(lte(pi.evalDate, to));
    return db
      .select()
      .from(pi)
      .where(and(...conds))
      .orderBy(asc(pi.evalDate));
  },

  // Screener over the most-recent eval_date. dy_min/roe_min arrive as percent (the
  // contract) but the mart stores decimals, so divide by 100.
  async screen(opts: ScreenOpts) {
    const maxEval = await this.maxEvalDate();
    if (!maxEval) return [];
    if (opts.cnpjs && opts.cnpjs.length === 0) return [];
    const conds: SQL[] = [eq(pi.evalDate, maxEval)];
    if (opts.pl_min != null) conds.push(gte(pi.pl, opts.pl_min));
    if (opts.pl_max != null) conds.push(lte(pi.pl, opts.pl_max));
    if (opts.pvp_min != null) conds.push(gte(pi.pvp, opts.pvp_min));
    if (opts.pvp_max != null) conds.push(lte(pi.pvp, opts.pvp_max));
    if (opts.dy_min != null) conds.push(gte(pi.dy12m, opts.dy_min / 100));
    if (opts.roe_min != null) conds.push(gte(pi.roe, opts.roe_min / 100));
    if (opts.ev_ebitda_max != null) conds.push(lte(pi.evEbitda, opts.ev_ebitda_max));
    if (opts.div_liq_ebitda_max != null) conds.push(lte(pi.divLiquidaEbitda, opts.div_liq_ebitda_max));
    if (opts.cnpjs && opts.cnpjs.length) conds.push(inArray(pi.cnpj, opts.cnpjs));
    const col = SORT_COLUMNS[opts.sortField as keyof typeof SORT_COLUMNS] ?? pi.dy12m;
    const order = opts.sortDir === "asc" ? asc(col) : desc(col);
    return db
      .select({
        ticker: pi.ticker,
        name: pi.companyName,
        cnpj: pi.cnpj,
        marketCap: pi.marketCap,
        pl: pi.pl,
        pvp: pi.pvp,
        dy12m: pi.dy12m,
        roe: pi.roe,
        roic: pi.roic,
        evEbitda: pi.evEbitda,
        divLiquidaEbitda: pi.divLiquidaEbitda,
        margemLiquida: pi.margemLiquida,
      })
      .from(pi)
      .where(and(...conds))
      .orderBy(order)
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },
};
