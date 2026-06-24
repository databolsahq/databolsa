import { NotFoundError } from "../middleware/errors";
import { companyRepo } from "../repositories/company.repo";
import { corporateRepo } from "../repositories/corporate.repo";
import { priceRepo } from "../repositories/price.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

export interface RangeQuery {
  from?: string;
  to?: string;
}
export interface DividendsQuery extends PaginationQuery, RangeQuery {}

async function assertTickerKnown(ticker: string) {
  if (await priceRepo.exists(ticker)) return;
  if (await companyRepo.byTicker(ticker)) return;
  throw new NotFoundError(`Ticker ${ticker} não encontrado`);
}

export const corporateService = {
  async dividends(ticker: string, q: DividendsQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await corporateRepo.dividends(ticker, { from: q.from, to: q.to, ...page });
    if (!rows.length && page.offset === 0) await assertTickerKnown(ticker);
    const data = rows.map((r) => ({
      type: r.type,
      ex_date: r.exDate,
      payment_date: r.paymentDate,
      value_per_share_gross: r.valuePerShareGross,
      value_per_share_net: r.valuePerShareNet,
    }));
    return paginate(data, page);
  },

  // Contract serves events as a plain array (no envelope).
  async events(ticker: string, q: RangeQuery) {
    const rows = await corporateRepo.events(ticker, q);
    if (!rows.length) await assertTickerKnown(ticker);
    return rows.map((r) => ({
      type: r.type,
      approved_date: r.approvedDate,
      ex_date: r.exDate,
      factor: r.factor,
      detail: r.detail,
    }));
  },

  // Insider moves are company-level (CVM VLMO): resolve ticker -> cnpj, aggregate by month.
  async insider(ticker: string, q: RangeQuery) {
    const company = await companyRepo.byTicker(ticker);
    if (!company) await assertTickerKnown(ticker);
    // companies.cnpj is formatted (33.000.167/0001-01); the VLMO mart keys on digits.
    const cnpj = company?.cnpj?.replace(/\D/g, "");
    const rows = cnpj ? await corporateRepo.insider(cnpj, q) : [];
    const refYear = (m: string) => m.slice(0, 4);
    return {
      ticker,
      data: rows.map((r) => ({
        reference_month: r.referenceMonth,
        net_shares: r.netShares,
        net_value_brl: r.netValueBrl,
        buy_value_brl: r.buyValueBrl,
        sell_value_brl: r.sellValueBrl,
        lineage: {
          source: "cvm_vlmo",
          reference: `vlmo_cia_aberta ${refYear(r.referenceMonth)}, CNPJ ${company?.cnpj ?? cnpj}`,
          url: "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/VLMO/DADOS/",
        },
      })),
    };
  },
};
