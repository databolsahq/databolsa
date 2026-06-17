import { and, asc, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import {
  db,
  fiiDistributions,
  fiiIndicators,
  fiiProfile,
  fiiReports,
} from "@databolsa/db";

interface Page {
  limit: number;
  offset: number;
  from?: string;
  to?: string;
}

export interface FiiListOpts {
  limit: number;
  offset: number;
  segment?: string;
  paper?: boolean;
  sortField: string;
  sortDir: "asc" | "desc";
}

// Whitelist de ordenação (o `sort` é entrada do usuário). dy_12m/pvp/etc. vêm da
// linha larga mart_fii__indicators; ticker do perfil.
const FII_SORT_COLUMNS = {
  ticker: fiiProfile.ticker,
  preco: fiiIndicators.preco,
  dy: fiiIndicators.dy12m,
  dy_12m: fiiIndicators.dy12m,
  pvp: fiiIndicators.pvp,
  vacancia: fiiIndicators.vacanciaFisica,
  pl: fiiIndicators.patrimonioLiquido,
  patrimonio_liquido: fiiIndicators.patrimonioLiquido,
} as const;

export const fiiRepo = {
  async profile(ticker: string) {
    const [row] = await db.select().from(fiiProfile).where(eq(fiiProfile.ticker, ticker)).limit(1);
    return row ?? null;
  },

  async indicators(ticker: string) {
    const [row] = await db
      .select()
      .from(fiiIndicators)
      .where(eq(fiiIndicators.ticker, ticker))
      .limit(1);
    return row ?? null;
  },

  // Universo de FIIs para o listing: 1 linha por fundo (perfil + snapshot largo de
  // indicadores). LEFT JOIN para que fundos ainda sem indicadores apareçam. O
  // segundo critério (ticker) estabiliza a ordem quando o campo escolhido empata.
  async list(opts: FiiListOpts) {
    const conds: SQL[] = [];
    if (opts.segment) conds.push(eq(fiiProfile.segment, opts.segment));
    if (opts.paper != null) conds.push(eq(fiiProfile.isPaper, opts.paper));
    const col = FII_SORT_COLUMNS[opts.sortField as keyof typeof FII_SORT_COLUMNS] ?? fiiProfile.ticker;
    const primary = opts.sortDir === "asc" ? asc(col) : desc(col);
    return db
      .select({
        ticker: fiiProfile.ticker,
        name: fiiProfile.name,
        segment: fiiProfile.segment,
        isPaper: fiiProfile.isPaper,
        referenceDate: fiiIndicators.referenceDate,
        preco: fiiIndicators.preco,
        dy12m: fiiIndicators.dy12m,
        pvp: fiiIndicators.pvp,
        vacanciaFisica: fiiIndicators.vacanciaFisica,
        patrimonioLiquido: fiiIndicators.patrimonioLiquido,
      })
      .from(fiiProfile)
      .leftJoin(fiiIndicators, eq(fiiProfile.ticker, fiiIndicators.ticker))
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(primary, asc(fiiProfile.ticker))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  // Série temporal de fundamentos do FII a partir do informe mensal (mart_fii__reports).
  // É a única fonte histórica por fundo — o mart_fii__indicators é snapshot (1 linha).
  async history(ticker: string, opts: { from?: string; to?: string }) {
    const conds: SQL[] = [eq(fiiReports.ticker, ticker)];
    if (opts.from) conds.push(gte(fiiReports.referenceMonth, opts.from.slice(0, 7)));
    if (opts.to) conds.push(lte(fiiReports.referenceMonth, opts.to.slice(0, 7)));
    return db
      .select()
      .from(fiiReports)
      .where(and(...conds))
      .orderBy(asc(fiiReports.referenceMonth));
  },

  async reports(ticker: string, opts: Page) {
    const conds: SQL[] = [eq(fiiReports.ticker, ticker)];
    if (opts.from) conds.push(gte(fiiReports.referenceMonth, opts.from.slice(0, 7)));
    if (opts.to) conds.push(lte(fiiReports.referenceMonth, opts.to.slice(0, 7)));
    return db
      .select()
      .from(fiiReports)
      .where(and(...conds))
      .orderBy(desc(fiiReports.referenceMonth))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async distributions(ticker: string, opts: Page) {
    const conds: SQL[] = [eq(fiiDistributions.ticker, ticker)];
    if (opts.from) conds.push(gte(fiiDistributions.exDate, opts.from));
    if (opts.to) conds.push(lte(fiiDistributions.exDate, opts.to));
    return db
      .select()
      .from(fiiDistributions)
      .where(and(...conds))
      .orderBy(desc(fiiDistributions.exDate))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },
};
