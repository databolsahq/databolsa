import { NotFoundError } from "../middleware/errors";
import { companyRepo } from "../repositories/company.repo";
import { corporateRepo } from "../repositories/corporate.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

type CompanyRow = NonNullable<Awaited<ReturnType<typeof companyRepo.byCvmCode>>>;

// Maps a serving row to the contract's Company schema. shares_outstanding (FRE/B3
// cross) and trade_name/subsector aren't in the marts yet -> nulled, not faked.
function toCompany(row: CompanyRow) {
  return {
    cvm_code: row.cdCvm,
    cnpj: row.cnpj,
    name: row.companyName,
    trade_name: null as string | null,
    sector: row.sector,
    subsector: null as string | null,
    listing_segment: row.listingSegment,
    tickers: row.tickers ? row.tickers.split(",").filter(Boolean) : [],
    shares_outstanding: { common: row.onShares, preferred: row.pnShares, total: row.totalShares },
    free_float_pct: row.freeFloatPct,
    status: row.issuerStatus ?? row.status,
    has_active_ticker: row.hasActiveTicker,
  };
}

export interface CompanyListQuery extends PaginationQuery {
  sector?: string;
  segment?: string;
  search?: string;
}

export const companyService = {
  async list(q: CompanyListQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await companyRepo.list({
      sector: q.sector,
      segment: q.segment,
      search: q.search,
      ...page,
    });
    return paginate(rows.map(toCompany), page);
  },

  async getByCvmCode(cdCvm: number) {
    const row = await companyRepo.byCvmCode(cdCvm);
    if (!row) throw new NotFoundError(`Companhia CVM ${cdCvm} não encontrada`);
    return toCompany(row);
  },

  async documents(cvmCode: number, q: CompanyDocumentsQuery) {
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await corporateRepo.documents(cvmCode, {
      category: q.category,
      from: q.from,
      to: q.to,
      ...page,
    });
    if (!rows.length && page.offset === 0 && !(await companyRepo.byCvmCode(cvmCode))) {
      throw new NotFoundError(`Companhia CVM ${cvmCode} não encontrada`);
    }
    const data = rows.map((r) => ({
      cvm_code: r.cvmCode,
      category: r.category,
      type: r.type,
      subject: r.subject,
      reference_date: r.referenceDate,
      filed_at: r.filedAt,
      protocol: r.protocol,
      download_url: r.downloadUrl,
      has_text: r.hasText ?? false,
    }));
    return paginate(data, page);
  },
};

export interface CompanyDocumentsQuery extends PaginationQuery {
  category?: string;
  from?: string;
  to?: string;
}
