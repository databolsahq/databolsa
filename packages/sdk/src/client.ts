import type {
  CorporateEventsResponse,
  CryptoQuotesResponse,
  DividendsResponse,
  DocumentsResponse,
  ExpectationsResponse,
  Fii,
  FiiDistributionsResponse,
  FiiIndicatorsResponse,
  FiiReportsResponse,
  FiiScreenResponse,
  HealthResponse,
  IngestHealthResponse,
  IndexCompositionResponse,
  IndexMeta,
  IndexQuotesResponse,
  IndicatorHistoryResponse,
  BdrListResponse,
  BdrProfile,
  BdrQuotesResponse,
  InsiderResponse,
  MacroGearsResponse,
  OptionExpiriesResponse,
  OptionsChainResponse,
  OptionsQuotesResponse,
  Query,
  QuotesResponse,
  RangeParams,
  RegimeSnapshot,
  ScreenStocksResponse,
  SearchResult,
  SeriesResponse,
  Stock,
  StockIndicatorsResponse,
  TesouroBondsResponse,
  YieldCurveResponse,
} from "./types";

/** Filtros do screener de ações — derivados de `GET /v1/screener/stocks`. */
export type ScreenStocksParams = Query<"screenStocks">;

/**
 * Filtros do listing de FIIs — derivados de `GET /v1/screener/fiis`, com uma
 * ergonomia: `paper` aceita `boolean` (o contrato pede `"true"`/`"false"`; o
 * HttpClient serializa). true = papel, false = tijolo, undefined = todos.
 */
export type ScreenFiisParams = Omit<Query<"screenFiis">, "paper"> & { paper?: boolean };

/**
 * Interface do cliente DataBolsa — métodos = operationIds do api/openapi.yaml.
 * O SDK público implementa esta interface com HttpClient; apps podem envolver
 * a interface com cache, hooks ou adaptadores próprios sem duplicar contrato.
 */
export interface DataBolsaClient {
  getHealth(): Promise<HealthResponse>;

  /** Saúde da ingestão: última run + saúde por fonte + histórico (data lake). */
  getIngestHealth(): Promise<IngestHealthResponse>;

  /** Lista/filtra ações por fundamentos (o universo real, não o preview). */
  screenStocks(params?: ScreenStocksParams): Promise<ScreenStocksResponse>;

  getStock(ticker: string): Promise<Stock>;
  listQuotes(
    ticker: string,
    params?: RangeParams & { adjusted?: boolean; limit?: number },
  ): Promise<QuotesResponse>;
  getStockIndicators(ticker: string, params?: { at?: string }): Promise<StockIndicatorsResponse>;
  getStockIndicatorHistory(ticker: string, name: string, params?: RangeParams): Promise<IndicatorHistoryResponse>;
  listDividends(ticker: string, params?: RangeParams): Promise<DividendsResponse>;
  listCorporateEvents(ticker: string, params?: RangeParams): Promise<CorporateEventsResponse>;
  listCompanyDocuments(cvmCode: number, params?: RangeParams & { category?: string }): Promise<DocumentsResponse>;
  /** PENDÊNCIA DE CONTRATO — ver lib/api/types.ts (InsiderMove) */
  listInsiderMoves(ticker: string, params?: RangeParams): Promise<InsiderResponse>;

  /** Lista o universo real de FIIs (não o preview). */
  screenFiis(params?: ScreenFiisParams): Promise<FiiScreenResponse>;
  getFii(ticker: string): Promise<Fii>;
  getFiiIndicators(ticker: string, params?: { at?: string }): Promise<FiiIndicatorsResponse>;
  /** Série mensal de um indicador de FII (mart_fii__reports) — mesmo shape do histórico de ações. */
  getFiiIndicatorHistory(ticker: string, name: string, params?: RangeParams): Promise<IndicatorHistoryResponse>;
  listFiiDistributions(ticker: string, params?: RangeParams): Promise<FiiDistributionsResponse>;
  listFiiReports(ticker: string, params?: RangeParams): Promise<FiiReportsResponse>;

  listIndices(): Promise<IndexMeta[]>;
  listIndexQuotes(code: string, params?: RangeParams & { limit?: number }): Promise<IndexQuotesResponse>;
  getIndexComposition(code: string): Promise<IndexCompositionResponse>;

  getSeries(
    source: string,
    seriesId: string,
    params?: RangeParams & { accumulated?: "none" | "12m" | "ytd" },
  ): Promise<SeriesResponse>;
  getYieldCurve(params?: { kind?: "nominal" | "real" }): Promise<YieldCurveResponse>;
  listTesouroBonds(params?: {
    type?: string;
    maturity?: string;
    date?: string;
    limit?: number;
  }): Promise<TesouroBondsResponse>;
  getMarketExpectations(
    indicator: "ipca" | "selic" | "pib" | "cambio",
    params?: { reference?: string } & RangeParams,
  ): Promise<ExpectationsResponse>;
  getMacroRegime(params?: { at?: string }): Promise<RegimeSnapshot>;
  getMacroGears(params?: { gear?: string }): Promise<MacroGearsResponse>;

  listCryptoQuotes(
    symbol: string,
    params?: RangeParams & { interval?: "1d" | "1h"; limit?: number },
  ): Promise<CryptoQuotesResponse>;

  // --- opções (chain viva + greeks europeus/americanos; histórico por série) ---
  /** Cadeia viva de um subjacente (séries não vencidas, mais negociadas). Filtra por vencimento/tipo. */
  listOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse>;
  /** Vencimentos distintos disponíveis para um subjacente (com contagem de séries). */
  listOptionExpiries(underlying: string): Promise<OptionExpiriesResponse>;
  /** Histórico EOD de UMA série de opção (paginado; só europeu). */
  listOptionQuotes(
    optionTicker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<OptionsQuotesResponse>;

  // --- BDRs (catálogo + cotações em BRL; dolarização via USD/BRL no client) ---
  /** Catálogo de BDRs (paginado; busca por ticker/nome). */
  listBdrs(params?: { search?: string; limit?: number; cursor?: string }): Promise<BdrListResponse>;
  getBdr(ticker: string): Promise<BdrProfile>;
  /** Histórico EOD de um BDR em BRL (paginado). */
  listBdrQuotes(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<BdrQuotesResponse>;

  /** Busca unificada (ações, FIIs, índices, títulos, séries macro) — backed o Cmd+K. */
  search(q: string, params?: { limit?: number }): Promise<SearchResult[]>;
}

export class NotInPreviewError extends Error {
  constructor(public readonly entity: string) {
    super(`"${entity}" não está disponível na API DataBolsa atual.`);
    this.name = "NotInPreviewError";
  }
}
