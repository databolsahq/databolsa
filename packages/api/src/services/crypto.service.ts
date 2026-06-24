import { NotFoundError } from "../middleware/errors";
import { marketsRepo } from "../repositories/markets.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface CryptoQuery extends PaginationQuery {
  interval?: "1d" | "1h";
  from?: string;
  to?: string;
}

export const cryptoService = {
  async quotes(symbol: string, q: CryptoQuery) {
    const upper = symbol.toUpperCase();
    const page = decodeCursor(q.cursor, q.limit);
    // Só o intervalo diário é servido no v1; 1h (intraday) devolve vazio.
    if (q.interval === "1h") return paginate([], page);
    const rows = await marketsRepo.cryptoQuotes(upper, { from: q.from, to: q.to, ...page });
    if (!rows.length && page.offset === 0 && !(await marketsRepo.cryptoExists(upper))) {
      throw new NotFoundError(`Cripto ${upper} não encontrada`);
    }
    const data = rows.map((r) => ({
      open_time: `${r.date}T00:00:00Z`,
      close_time: `${r.date}T23:59:59Z`,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
      quote_volume: r.quoteVolume,
      trades: r.trades,
    }));
    return paginate(data, page);
  },
};
