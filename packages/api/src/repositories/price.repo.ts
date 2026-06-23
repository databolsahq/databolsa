import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { db, priceStats, prices } from "@databolsa/db";

export interface QuoteOpts {
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export const priceRepo = {
  async quotes(ticker: string, opts: QuoteOpts) {
    const conds: SQL[] = [eq(prices.ticker, ticker)];
    if (opts.from) conds.push(gte(prices.date, opts.from));
    if (opts.to) conds.push(lte(prices.date, opts.to));
    return db
      .select()
      .from(prices)
      .where(and(...conds))
      .orderBy(desc(prices.date))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async latest(ticker: string) {
    const [row] = await db
      .select()
      .from(prices)
      .where(eq(prices.ticker, ticker))
      .orderBy(desc(prices.date))
      .limit(1);
    return row ?? null;
  },

  async exists(ticker: string) {
    const [row] = await db
      .select({ t: prices.ticker })
      .from(prices)
      .where(eq(prices.ticker, ticker))
      .limit(1);
    return Boolean(row);
  },

  async stats(ticker: string) {
    const [row] = await db
      .select()
      .from(priceStats)
      .where(eq(priceStats.ticker, ticker))
      .limit(1);
    return row ?? null;
  },
};
