import { searchRepo, type SearchHit } from "../repositories/search.repo";

export interface SearchQuery {
  q: string;
  limit?: number;
}

export const searchService = {
  async search(query: SearchQuery): Promise<SearchHit[]> {
    const q = query.q.trim();
    if (!q) return [];
    // Display fields (incl. index names) come straight from the search_catalog view —
    // no app-side enrichment needed.
    return searchRepo.query(q, query.limit);
  },
};
