import { NotFoundError } from "../middleware/errors";
import { optionsRepo } from "../repositories/options.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface ChainQuery {
  expiry?: string;
  type?: string;
}
export interface OptionQuotesQuery extends PaginationQuery {
  from?: string;
  to?: string;
}

export const optionsService = {
  async chain(underlying: string, q: ChainQuery) {
    const rows = await optionsRepo.chain(underlying, { expiry: q.expiry, type: q.type });
    if (!rows.length && !(await optionsRepo.underlyingExists(underlying))) {
      throw new NotFoundError(`Sem opções para ${underlying}`);
    }
    return {
      underlying_ticker: underlying,
      date: rows[0]?.date ?? null,
      count: rows.length,
      options: rows.map((r) => ({
        option_ticker: r.optionTicker,
        underlying_ticker: r.underlyingTicker,
        underlying_root: r.underlyingRoot,
        option_type: r.optionType,
        strike: r.strike,
        expiry: r.expiry,
        date: r.date,
        last: r.last,
        volume_brl: r.volumeBrl,
        trades: r.trades,
        underlying_spot: r.underlyingSpot,
        days_to_expiry: r.daysToExpiry,
        moneyness: r.moneyness,
        intrinsic: r.intrinsic,
        time_value: r.timeValue,
        iv: r.iv,
        delta: r.delta,
        gamma: r.gamma,
        vega: r.vega,
        theta: r.theta,
        iv_amer: r.ivAmer,
        delta_amer: r.deltaAmer,
        gamma_amer: r.gammaAmer,
        vega_amer: r.vegaAmer,
        theta_amer: r.thetaAmer,
        early_ex_premium: r.earlyExPremium,
      })),
    };
  },

  async expiries(underlying: string) {
    const rows = await optionsRepo.expiries(underlying);
    if (!rows.length) throw new NotFoundError(`Sem opções para ${underlying}`);
    return {
      underlying_ticker: underlying,
      expiries: rows
        .filter((r): r is { expiry: string; count: number } => r.expiry != null)
        .map((r) => ({ expiry: r.expiry, count: r.count })),
    };
  },

  async quotes(optionTicker: string, q: OptionQuotesQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await optionsRepo.quotes(optionTicker, { from: q.from, to: q.to, ...page });
    if (!rows.length && !(await optionsRepo.optionExists(optionTicker))) {
      throw new NotFoundError(`Série de opção ${optionTicker} não encontrada`);
    }
    const data = rows.map((r) => ({
      date: r.date,
      option_ticker: r.optionTicker,
      option_type: r.optionType,
      strike: r.strike,
      expiry: r.expiry,
      open: r.open,
      high: r.high,
      low: r.low,
      last: r.last,
      volume_brl: r.volumeBrl,
      trades: r.trades,
      underlying_spot: r.underlyingSpot,
      moneyness: r.moneyness,
      intrinsic: r.intrinsic,
      time_value: r.timeValue,
      iv: r.iv,
      delta: r.delta,
      gamma: r.gamma,
      vega: r.vega,
      theta: r.theta,
    }));
    return paginate(data, page);
  },
};
