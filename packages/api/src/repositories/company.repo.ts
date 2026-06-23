import { and, asc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { companies, db } from "@databolsa/db";

export interface CompanyListOpts {
  sector?: string;
  segment?: string;
  search?: string;
  limit: number;
  offset: number;
}

export const companyRepo = {
  async list(opts: CompanyListOpts) {
    const conds: SQL[] = [];
    if (opts.sector) conds.push(eq(companies.sector, opts.sector));
    if (opts.segment) conds.push(ilike(companies.listingSegment, `%${opts.segment}%`));
    if (opts.search) {
      const q = `%${opts.search}%`;
      const match = or(
        ilike(companies.companyName, q),
        ilike(companies.tickers, q),
        ilike(companies.cnpj, q),
      );
      if (match) conds.push(match);
    }
    return db
      .select()
      .from(companies)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(asc(companies.companyName))
      .limit(opts.limit + 1)
      .offset(opts.offset);
  },

  async byCvmCode(cdCvm: number) {
    const [row] = await db.select().from(companies).where(eq(companies.cdCvm, cdCvm)).limit(1);
    return row ?? null;
  },

  async byTicker(ticker: string) {
    // `tickers` is a comma-joined string (e.g. "PETR3,PETR4") — match a single element.
    const [row] = await db
      .select()
      .from(companies)
      .where(sql`',' || ${companies.tickers} || ',' LIKE ${"%," + ticker + ",%"}`)
      .limit(1);
    return row ?? null;
  },

  // Distinct cnpjs in a sector — used to drive the screener's sector filter.
  async cnpjsBySector(sector: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ cnpj: companies.cnpj })
      .from(companies)
      .where(eq(companies.sector, sector));
    return rows.map((r) => r.cnpj);
  },

  // Distinct cnpjs in a listing segment (Novo Mercado, Nível 2, ...) — drives the
  // screener's segment filter. Substring match mirrors companyRepo.list.
  async cnpjsBySegment(segment: string): Promise<string[]> {
    const rows = await db
      .selectDistinct({ cnpj: companies.cnpj })
      .from(companies)
      .where(ilike(companies.listingSegment, `%${segment}%`));
    return rows.map((r) => r.cnpj);
  },

  // cnpj -> sector, preferring an active record when a cnpj has multiple registrations.
  async sectorByCnpj(cnpjs: string[]): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (!cnpjs.length) return out;
    const rows = await db
      .select({ cnpj: companies.cnpj, sector: companies.sector, active: companies.hasActiveTicker })
      .from(companies)
      .where(inArray(companies.cnpj, cnpjs));
    for (const r of rows) if (!out.has(r.cnpj) || r.active) out.set(r.cnpj, r.sector);
    return out;
  },
};
