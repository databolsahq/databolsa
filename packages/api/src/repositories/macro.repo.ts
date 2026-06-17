import { sql } from "drizzle-orm";
import { db } from "@databolsa/db";

export interface MacroRow {
  indicator_id: string;
  date: string;
  value: number | null;
  unit: string | null;
  label: string | null;
  lineage: string | null;
  prev_value: number | null; // the prior observation, for direction
}

export const macroRepo = {
  // Latest value per indicator within a section + the prior observation (for trend).
  async latestBySection(section: string, at?: string): Promise<MacroRow[]> {
    const rows = await db.execute(sql`
      SELECT indicator_id, date, value, unit, label, lineage, prev_value FROM (
        SELECT indicator_id, date::text AS date, value, unit, label, lineage,
               row_number() OVER (PARTITION BY indicator_id ORDER BY date DESC) AS rn,
               lead(value) OVER (PARTITION BY indicator_id ORDER BY date DESC) AS prev_value
        FROM macro_indicators
        WHERE section = ${section}${at ? sql` AND date <= ${at}` : sql``}
      ) t WHERE rn = 1 ORDER BY indicator_id
    `);
    return rows as unknown as MacroRow[];
  },

  async crossAssetLatest(at?: string): Promise<MacroRow[]> {
    const rows = await db.execute(sql`
      SELECT indicator_id, date, value, unit, label, lineage, prev_value FROM (
        SELECT indicator_id, date::text AS date, value, unit, label, lineage,
               row_number() OVER (PARTITION BY indicator_id ORDER BY date DESC) AS rn,
               lead(value) OVER (PARTITION BY indicator_id ORDER BY date DESC) AS prev_value
        FROM macro_cross_asset
        ${at ? sql`WHERE date <= ${at}` : sql``}
      ) t WHERE rn = 1 ORDER BY indicator_id
    `);
    return rows as unknown as MacroRow[];
  },

  // The 3 regime series (growth_score, inflation_score, quadrante), latest <= `at`.
  async regimeLatest(at?: string): Promise<MacroRow[]> {
    const rows = await db.execute(sql`
      SELECT indicator_id, date, value, unit, label, lineage, prev_value FROM (
        SELECT indicator_id, date::text AS date, value, unit, label, lineage,
               row_number() OVER (PARTITION BY indicator_id ORDER BY date DESC) AS rn,
               lead(value) OVER (PARTITION BY indicator_id ORDER BY date DESC) AS prev_value
        FROM macro_regime
        ${at ? sql`WHERE date <= ${at}` : sql``}
      ) t WHERE rn = 1 ORDER BY indicator_id
    `);
    return rows as unknown as MacroRow[];
  },
};
