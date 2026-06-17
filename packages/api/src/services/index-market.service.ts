import { NotFoundError } from "../middleware/errors";
import { marketsRepo } from "../repositories/markets.repo";
import { decodeCursor, paginate, type PaginationQuery } from "../lib/pagination";

// Metadados estáticos dos índices servidos (níveis vêm do mart B3). Códigos sem
// série ingerida não são listados; o quotes() resolve qualquer code que exista no mart.
const REBAL = "jan/mai/set (vigência fev/jun/out)";
const INDEX_META: Record<string, { name: string; rebalancing: string }> = {
  IBOV: { name: "Índice Bovespa", rebalancing: REBAL },
  IFIX: { name: "Índice de Fundos Imobiliários", rebalancing: REBAL },
  // amplos / estilo
  IBXX: { name: "IBrX 100 (mercado amplo)", rebalancing: REBAL },
  IBXL: { name: "IBrX 50", rebalancing: REBAL },
  IBRA: { name: "Índice Brasil Amplo", rebalancing: REBAL },
  IDIV: { name: "Índice Dividendos", rebalancing: REBAL },
  MLCX: { name: "Índice MidLarge Cap", rebalancing: REBAL },
  SMLL: { name: "Índice Small Cap", rebalancing: REBAL },
  IGCX: { name: "Índice de Governança Corporativa", rebalancing: REBAL },
  ITAG: { name: "Índice de Tag Along Diferenciado", rebalancing: REBAL },
  // setoriais
  IFNC: { name: "Índice Financeiro", rebalancing: REBAL },
  ICON: { name: "Índice de Consumo", rebalancing: REBAL },
  IEEX: { name: "Índice de Energia Elétrica", rebalancing: REBAL },
  IMOB: { name: "Índice Imobiliário", rebalancing: REBAL },
  UTIL: { name: "Índice de Utilidade Pública", rebalancing: REBAL },
  IMAT: { name: "Índice de Materiais Básicos", rebalancing: REBAL },
  INDX: { name: "Índice do Setor Industrial", rebalancing: REBAL },
};

export interface IndexQuotesQuery extends PaginationQuery {
  from?: string;
  to?: string;
}

export const indexMarketService = {
  list() {
    return Object.entries(INDEX_META).map(([code, m]) => ({ code, ...m }));
  },

  async quotes(code: string, q: IndexQuotesQuery) {
    const upper = code.toUpperCase();
    const page = decodeCursor(q.cursor, q.limit);
    const rows = await marketsRepo.indexQuotes(upper, { from: q.from, to: q.to, ...page });
    if (!rows.length && page.offset === 0 && !(await marketsRepo.indexExists(upper))) {
      throw new NotFoundError(`Índice ${upper} não encontrado`);
    }
    const data = rows.map((r) => ({ date: r.date, value: r.close }));
    return paginate(data, page);
  },

  // Carteira teórica vigente (constituintes + peso % + qtde teórica), do mart
  // mart_indices__composition (indexProxy/GetPortfolioDay). 404 se o índice não
  // tem carteira coletada.
  async composition(code: string) {
    const upper = code.toUpperCase();
    const rows = await marketsRepo.indexComposition(upper);
    const first = rows[0];
    if (!first) {
      throw new NotFoundError(`Composição de ${upper} não encontrada`);
    }
    return {
      code: upper,
      effective_date: first.effectiveDate,
      components: rows.map((r) => ({
        ticker: r.ticker,
        weight: r.weight,
        theoretical_quantity: r.theoreticalQuantity,
      })),
    };
  },
};
