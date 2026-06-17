import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import {
  cryptoQuotes,
  db,
  indexComposition,
  indexQuotes,
  macroExpectations,
  macroSeries,
  macroSeriesCatalog,
  tesouroBonds,
} from "@databolsa/db";

interface Page {
  limit: number;
  offset: number;
}

// LTN/NTN-F = curva nominal (prefixados); NTN-B(-Principal) = curva real (IPCA+).
const NOMINAL_TYPES = ["LTN", "NTN-F"];
const REAL_TYPES = ["NTN-B", "NTN-B-Principal"];

export const marketsRepo = {
  // --- Tesouro Direto ------------------------------------------------------
  async tesouroLatestDate(type?: string): Promise<string | null> {
    const conds = type ? [eq(tesouroBonds.type, type)] : [];
    const [row] = await db
      .select({ d: sql<string>`max(${tesouroBonds.date})` })
      .from(tesouroBonds)
      .where(conds.length ? and(...conds) : undefined);
    return row?.d ?? null;
  },

  async tesouroBonds(opts: Page & { type?: string; maturity?: string; date?: string }) {
    // Modo HISTÓRICO: com maturity (e sem date explícita) devolve a série temporal
    // daquele título (todas as datas-base, mais recente primeiro). Sem maturity é
    // o snapshot da última data-base disponível (lista de mercado).
    const history = Boolean(opts.maturity) && !opts.date;
    const date = history ? null : (opts.date ?? (await this.tesouroLatestDate(opts.type)));
    if (!history && !date) return [];
    const conds: SQL[] = [];
    if (date) conds.push(eq(tesouroBonds.date, date));
    if (opts.type) conds.push(eq(tesouroBonds.type, opts.type));
    if (opts.maturity) conds.push(eq(tesouroBonds.maturity, opts.maturity));
    return db
      .select()
      .from(tesouroBonds)
      .where(and(...conds))
      .orderBy(history ? desc(tesouroBonds.date) : asc(tesouroBonds.maturity))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async tesouroCurve(kind: "nominal" | "real", date?: string) {
    const types = kind === "real" ? REAL_TYPES : NOMINAL_TYPES;
    const base = date ?? (await this.tesouroLatestDate());
    if (!base) return { date: null, rows: [] as (typeof tesouroBonds.$inferSelect)[] };
    const rows = await db
      .select()
      .from(tesouroBonds)
      .where(and(eq(tesouroBonds.date, base), inArray(tesouroBonds.type, types)))
      .orderBy(asc(tesouroBonds.maturity));
    return { date: base, rows };
  },

  // --- índices -------------------------------------------------------------
  async indexQuotes(code: string, opts: Page & { from?: string; to?: string }) {
    const conds: SQL[] = [eq(indexQuotes.code, code)];
    if (opts.from) conds.push(gte(indexQuotes.date, opts.from));
    if (opts.to) conds.push(lte(indexQuotes.date, opts.to));
    return db
      .select()
      .from(indexQuotes)
      .where(and(...conds))
      .orderBy(desc(indexQuotes.date))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async indexExists(code: string) {
    const [row] = await db
      .select({ c: indexQuotes.code })
      .from(indexQuotes)
      .where(eq(indexQuotes.code, code))
      .limit(1);
    return Boolean(row);
  },

  // Carteira teórica vigente do índice (já materializada na carteira mais recente
  // pelo mart), ordenada por peso desc.
  async indexComposition(code: string) {
    return db
      .select()
      .from(indexComposition)
      .where(eq(indexComposition.code, code))
      .orderBy(desc(indexComposition.weight));
  },

  // --- cripto --------------------------------------------------------------
  async cryptoQuotes(symbol: string, opts: Page & { from?: string; to?: string }) {
    const conds: SQL[] = [eq(cryptoQuotes.symbol, symbol)];
    if (opts.from) conds.push(gte(cryptoQuotes.date, opts.from));
    if (opts.to) conds.push(lte(cryptoQuotes.date, opts.to));
    return db
      .select()
      .from(cryptoQuotes)
      .where(and(...conds))
      .orderBy(desc(cryptoQuotes.date))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async cryptoExists(symbol: string) {
    const [row] = await db
      .select({ s: cryptoQuotes.symbol })
      .from(cryptoQuotes)
      .where(eq(cryptoQuotes.symbol, symbol))
      .limit(1);
    return Boolean(row);
  },

  // --- séries macro --------------------------------------------------------
  async seriesMeta(source: string, seriesId: string) {
    const [row] = await db
      .select()
      .from(macroSeriesCatalog)
      .where(and(eq(macroSeriesCatalog.source, source), eq(macroSeriesCatalog.seriesId, seriesId)))
      .limit(1);
    return row ?? null;
  },

  async seriesObservations(
    source: string,
    seriesId: string,
    opts?: { from?: string; to?: string },
  ) {
    const conds: SQL[] = [eq(macroSeries.source, source), eq(macroSeries.seriesId, seriesId)];
    if (opts?.from) conds.push(gte(macroSeries.date, opts.from));
    if (opts?.to) conds.push(lte(macroSeries.date, opts.to));
    return db
      .select({ date: macroSeries.date, value: macroSeries.value })
      .from(macroSeries)
      .where(and(...conds))
      .orderBy(asc(macroSeries.date));
  },

  async seriesCatalog(opts: Page & { source?: string; search?: string }) {
    const conds: SQL[] = [];
    if (opts.source) conds.push(eq(macroSeriesCatalog.source, opts.source));
    if (opts.search) {
      const q = `%${opts.search}%`;
      const m = or(ilike(macroSeriesCatalog.name, q), ilike(macroSeriesCatalog.label, q));
      if (m) conds.push(m);
    }
    return db
      .select()
      .from(macroSeriesCatalog)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(macroSeriesCatalog.seriesId))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  // --- expectativas Focus --------------------------------------------------
  async expectations(indicator: string, opts?: { reference?: string; from?: string; to?: string }) {
    const conds: SQL[] = [eq(macroExpectations.indicator, indicator)];
    if (opts?.reference) conds.push(eq(macroExpectations.reference, opts.reference));
    if (opts?.from) conds.push(gte(macroExpectations.surveyDate, opts.from));
    if (opts?.to) conds.push(lte(macroExpectations.surveyDate, opts.to));
    return db
      .select()
      .from(macroExpectations)
      .where(and(...conds))
      .orderBy(desc(macroExpectations.surveyDate));
  },
};
