import { sql } from "drizzle-orm";
import { db } from "@databolsa/db";

export const freshnessRepo = {
  // Most-recent observation per serving domain — feeds /health data_freshness.
  async dataFreshness(): Promise<Record<string, string>> {
    const rows = (await db.execute(sql`
      SELECT 'prices' AS source, max(date)::text AS d FROM prices
      UNION ALL SELECT 'fundamentals', max(eval_date)::text FROM fund_indicators
      UNION ALL SELECT 'statements', max(ref_date)::text FROM fund_statements
      UNION ALL SELECT 'macro', max(date)::text FROM macro_indicators
    `)) as unknown as Array<{ source: string; d: string | null }>;
    const out: Record<string, string> = {};
    for (const r of rows) if (r.d) out[r.source] = r.d;
    return out;
  },

  async ping(): Promise<void> {
    await db.execute(sql`SELECT 1`);
  },
};
