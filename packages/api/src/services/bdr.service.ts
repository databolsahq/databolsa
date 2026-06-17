import { NotFoundError } from "../middleware/errors";
import { bdrRepo } from "../repositories/bdr.repo";
import { priceRepo } from "../repositories/price.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface BdrListQuery extends PaginationQuery {
  search?: string;
}
export interface BdrQuotesQuery extends PaginationQuery {
  from?: string;
  to?: string;
}

interface BdrRow {
  ticker: string;
  name: string | null;
  isin: string | null;
  kind: string | null;
  spec: string | null;
  firstTraded: string | null;
  lastTraded: string | null;
  sessions: number | null;
}

const toProfile = (r: BdrRow) => ({
  ticker: r.ticker,
  name: r.name,
  isin: r.isin,
  kind: r.kind,
  spec: r.spec,
  first_traded: r.firstTraded,
  last_traded: r.lastTraded,
  sessions: r.sessions,
});

export const bdrService = {
  async list(q: BdrListQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await bdrRepo.list({ search: q.search, ...page });
    return paginate(rows.map(toProfile), page);
  },

  async get(ticker: string) {
    const row = await bdrRepo.get(ticker);
    if (!row) throw new NotFoundError(`BDR ${ticker} não encontrado`);
    return toProfile(row);
  },

  async quotes(ticker: string, q: BdrQuotesQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await priceRepo.quotes(ticker, { from: q.from, to: q.to, ...page });
    if (!rows.length && !(await bdrRepo.get(ticker))) {
      throw new NotFoundError(`BDR ${ticker} não encontrado`);
    }
    const data = rows.map((r) => ({
      date: r.date,
      open: r.openAdj,
      high: r.highAdj,
      low: r.lowAdj,
      close: r.closeAdj,
      close_raw: r.closeRaw,
      volume: r.volumeBrl,
      adjust_quality: r.adjustQuality,
    }));
    return paginate(data, page);
  },
};
