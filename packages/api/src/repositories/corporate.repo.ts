import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import {
  companyDocuments,
  corporateEvents,
  db,
  dividends,
  insiderMoves,
} from "@databolsa/db";

interface RangeOpts {
  from?: string;
  to?: string;
}
interface PageOpts extends RangeOpts {
  limit: number;
  offset: number;
}

export const corporateRepo = {
  async dividends(ticker: string, opts: PageOpts) {
    const conds: SQL[] = [eq(dividends.ticker, ticker)];
    if (opts.from) conds.push(gte(dividends.exDate, opts.from));
    if (opts.to) conds.push(lte(dividends.exDate, opts.to));
    return db
      .select()
      .from(dividends)
      .where(and(...conds))
      .orderBy(desc(dividends.exDate))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async events(ticker: string, opts?: RangeOpts) {
    const conds: SQL[] = [eq(corporateEvents.ticker, ticker)];
    if (opts?.from) conds.push(gte(corporateEvents.exDate, opts.from));
    if (opts?.to) conds.push(lte(corporateEvents.exDate, opts.to));
    return db
      .select()
      .from(corporateEvents)
      .where(and(...conds))
      .orderBy(desc(corporateEvents.exDate));
  },

  async insider(cnpj: string, opts?: RangeOpts) {
    const conds: SQL[] = [eq(insiderMoves.cnpj, cnpj)];
    // reference_month is 'YYYY-MM' text; range filters compare lexicographically (safe for ISO).
    if (opts?.from) conds.push(gte(insiderMoves.referenceMonth, opts.from.slice(0, 7)));
    if (opts?.to) conds.push(lte(insiderMoves.referenceMonth, opts.to.slice(0, 7)));
    return db
      .select()
      .from(insiderMoves)
      .where(and(...conds))
      .orderBy(desc(insiderMoves.referenceMonth));
  },

  async documents(cvmCode: number, opts: PageOpts & { category?: string }) {
    const conds: SQL[] = [eq(companyDocuments.cvmCode, cvmCode)];
    if (opts.category) conds.push(eq(companyDocuments.category, opts.category));
    if (opts.from) conds.push(gte(companyDocuments.filedAt, opts.from));
    if (opts.to) conds.push(lte(companyDocuments.filedAt, opts.to));
    return db
      .select()
      .from(companyDocuments)
      .where(and(...conds))
      .orderBy(desc(companyDocuments.filedAt))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },
};
