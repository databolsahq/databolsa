import { NotFoundError } from "../middleware/errors";
import { companyRepo } from "../repositories/company.repo";
import { priceRepo } from "../repositories/price.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

const TYPE_BY_SUFFIX: Record<string, string> = {
  "3": "ON",
  "4": "PN",
  "5": "PNA",
  "6": "PNB",
  "11": "UNIT",
};

export interface QuotesQuery extends PaginationQuery {
  from?: string;
  to?: string;
  adjusted: boolean;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
// Raw OHLC is reconstructed exactly from the adjusted value: adj = raw * adj_factor,
// applied uniformly across O/H/L/C, so raw = adj / adj_factor (close_raw confirms it).
const unadjust = (v: number | null, factor: number) => (v == null ? null : round6(v / factor));

export const stockService = {
  async get(ticker: string) {
    const latest = await priceRepo.latest(ticker);
    if (!latest) throw new NotFoundError(`Ticker ${ticker} não encontrado`);
    const company = await companyRepo.byTicker(ticker);
    // sufixo de classe = dígitos finais (robusto a raiz com dígito: B3SA3 -> "3").
    const suffix = ticker.match(/[0-9]+$/)?.[0] ?? "";
    // Papéis irmãos da empresa (SAPR3/SAPR4/SAPR11) — habilita o seletor de classe
    // na web. Cada papel é analisável separadamente (mart_fund__paper_indicators).
    const papers = (company?.tickers ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .sort()
      .map((t) => ({ ticker: t, type: TYPE_BY_SUFFIX[t.match(/[0-9]+$/)?.[0] ?? ""] ?? null }));
    return {
      ticker,
      isin: latest.isin,
      type: TYPE_BY_SUFFIX[suffix] ?? null,
      company: company
        ? { cvm_code: company.cdCvm, name: company.companyName, tickers: papers }
        : null,
      shares_outstanding: company?.totalShares ?? null,
      latest_quote: {
        date: latest.date,
        close: latest.closeAdj,
        adjust_type: latest.adjustType,
        adjust_quality: latest.adjustQuality,
      },
    };
  },

  async quotes(ticker: string, q: QuotesQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await priceRepo.quotes(ticker, { from: q.from, to: q.to, ...page });
    if (!rows.length && !(await priceRepo.exists(ticker))) {
      throw new NotFoundError(`Ticker ${ticker} não encontrado`);
    }
    // Default adjusted=true (events-only: splits/groupings/bonuses; dividends NOT
    // subtracted — adjust_type says so). adjusted=false returns the as-reported values.
    const quotes = rows.map((r) => {
      const factor = r.adjFactor && r.adjFactor > 0 ? r.adjFactor : 1;
      return {
        date: r.date,
        open: q.adjusted ? r.openAdj : unadjust(r.openAdj, factor),
        high: q.adjusted ? r.highAdj : unadjust(r.highAdj, factor),
        low: q.adjusted ? r.lowAdj : unadjust(r.lowAdj, factor),
        close: q.adjusted ? r.closeAdj : r.closeRaw,
        close_raw: r.closeRaw,
        // retorno total (proventos reinvestidos) — sempre servido; cai em close_adj
        // quando não há fonte de proventos para o ticker
        close_tr: r.closeTr ?? r.closeAdj,
        volume: r.volumeBrl,
        quantity: r.quantity,
        trades: null as number | null,
        adjusted: q.adjusted,
        adjust_type: r.adjustType,
        adjust_quality: r.adjustQuality,
      };
    });
    return paginate(quotes, page);
  },
};
