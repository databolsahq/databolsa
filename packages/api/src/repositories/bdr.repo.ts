import { and, asc, eq, ilike, or, type SQL } from "drizzle-orm";
import { bdrProfile, db } from "@databolsa/db";

export interface BdrListOpts {
  search?: string;
  limit: number;
  offset: number;
}

export const bdrRepo = {
  async get(ticker: string) {
    const [row] = await db.select().from(bdrProfile).where(eq(bdrProfile.ticker, ticker)).limit(1);
    return row ?? null;
  },

  async list(opts: BdrListOpts) {
    const conds: SQL[] = [];
    if (opts.search) {
      const term = `%${opts.search}%`;
      const m = or(ilike(bdrProfile.ticker, term), ilike(bdrProfile.name, term));
      if (m) conds.push(m);
    }
    return db
      .select()
      .from(bdrProfile)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(bdrProfile.ticker))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },
};
