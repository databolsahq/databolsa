import { sql } from "drizzle-orm";
import { db } from "@databolsa/db";

export type SearchKind = "stock" | "fii" | "index" | "bond" | "macro";

export interface SearchHit {
  kind: SearchKind;
  ticker: string;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
}

export const searchRepo = {
  // Ranked query over the search_catalog view. Rank tiers: exact ticker (0),
  // ticker prefix (1), fuzzy name/text match (2); tie-broken by word_similarity desc.
  // word_similarity (not plain similarity) scores the query against the BEST-matching
  // substring of search_text — the right metric for short-query typeahead over long
  // "TICKER Company Name" blobs, and it's typo-tolerant (petrr → Petrobras). The 0.4
  // floor trims noise. At <5k catalog rows a seq scan is trivial; the trgm GIN indexes
  // still back the ticker prefix (ILIKE) and are ready if we later switch to the <% operator.
  async query(term: string, limit = 20): Promise<SearchHit[]> {
    const q = term.trim();
    if (!q) return [];
    const upper = q.toUpperCase();
    const prefix = `${upper}%`;
    const rows = await db.execute(sql`
      SELECT kind, ticker, title, subtitle, href,
             word_similarity(${q}, search_text) AS score
      FROM search_catalog
      WHERE upper(ticker) = ${upper}
         OR upper(ticker) LIKE ${prefix}
         OR word_similarity(${q}, search_text) >= 0.4
      ORDER BY
        CASE
          WHEN upper(ticker) = ${upper} THEN 0
          WHEN upper(ticker) LIKE ${prefix} THEN 1
          ELSE 2
        END,
        word_similarity(${q}, search_text) DESC,
        title ASC
      LIMIT ${limit}
    `);
    return rows as unknown as SearchHit[];
  },
};
