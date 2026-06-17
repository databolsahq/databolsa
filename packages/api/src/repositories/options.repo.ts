import { and, asc, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db, optionsChain, optionsQuotes } from "@databolsa/db";

export interface ChainOpts {
  expiry?: string;
  type?: string;
}
export interface OptionQuoteOpts {
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

const CHAIN_CAP = 2000;

export const optionsRepo = {
  async chain(underlying: string, opts: ChainOpts) {
    const conds: SQL[] = [eq(optionsChain.underlyingTicker, underlying)];
    if (opts.expiry) conds.push(eq(optionsChain.expiry, opts.expiry));
    if (opts.type) conds.push(eq(optionsChain.optionType, opts.type));
    return db
      .select()
      .from(optionsChain)
      .where(and(...conds))
      .orderBy(asc(optionsChain.expiry), asc(optionsChain.optionType), asc(optionsChain.strike))
      .limit(CHAIN_CAP);
  },

  async expiries(underlying: string) {
    return db
      .select({ expiry: optionsChain.expiry, count: sql<number>`count(*)::int` })
      .from(optionsChain)
      .where(eq(optionsChain.underlyingTicker, underlying))
      .groupBy(optionsChain.expiry)
      .orderBy(asc(optionsChain.expiry));
  },

  async underlyingExists(underlying: string) {
    const [row] = await db
      .select({ t: optionsChain.underlyingTicker })
      .from(optionsChain)
      .where(eq(optionsChain.underlyingTicker, underlying))
      .limit(1);
    return Boolean(row);
  },

  async quotes(optionTicker: string, opts: OptionQuoteOpts) {
    const conds: SQL[] = [eq(optionsQuotes.optionTicker, optionTicker)];
    if (opts.from) conds.push(gte(optionsQuotes.date, opts.from));
    if (opts.to) conds.push(lte(optionsQuotes.date, opts.to));
    return db
      .select()
      .from(optionsQuotes)
      .where(and(...conds))
      .orderBy(desc(optionsQuotes.date))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async optionExists(optionTicker: string) {
    const [row] = await db
      .select({ t: optionsQuotes.optionTicker })
      .from(optionsQuotes)
      .where(eq(optionsQuotes.optionTicker, optionTicker))
      .limit(1);
    return Boolean(row);
  },
};
