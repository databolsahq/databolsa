import type {
  CorporateEventsResponse,
  CryptoQuotesResponse,
  DividendsResponse,
  DocumentsResponse,
  EtfListResponse,
  EtfProfile,
  ExpectationsResponse,
  Fii,
  FiiDistributionsResponse,
  FiiIndicatorsResponse,
  FiiReportsResponse,
  FiiScreenResponse,
  FundHoldersResponse,
  FundHoldingsResponse,
  FundListResponse,
  FundProfile,
  FundQuotesResponse,
  FundScreenerResponse,
  HealthResponse,
  IngestHealthResponse,
  IndexCompositionResponse,
  IndexMeta,
  IndexQuotesResponse,
  IndicatorHistoryResponse,
  IntradaySeriesResponse,
  LiveQuotesResponse,
  BdrListResponse,
  BdrProfile,
  BdrQuotesResponse,
  InsiderResponse,
  InvestorFlowMonthlyResponse,
  InvestorFlowResponse,
  MacroGearsResponse,
  OfferingsResponse,
  OptionExpiriesResponse,
  OptionsChainResponse,
  OptionsQuotesResponse,
  DocumentSearchResponse,
  PortfolioResponse,
  Query,
  QuotesResponse,
  RangeParams,
  RegimeSnapshot,
  ScreenStocksResponse,
  SearchDocumentsParams,
  SearchResult,
  SeriesResponse,
  Stock,
  StockIndicatorsResponse,
  SuitabilityResponse,
  TesouroBondsResponse,
  TradeStatsResponse,
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

/** Filtros do screener de fundos — derivados de `GET /v1/screener/funds`. */
export type ScreenFundsParams = Query<"screenFunds">;

/**
 * Params do lote de cotações ao vivo — `GET /v1/quotes/live`, com uma ergonomia:
 * `tickers` aceita `string[]` (o contrato pede CSV; o HttpClient serializa). Forneça
 * exatamente um de `tickers` ou `index`.
 */
export type LiveQuotesParams = Omit<Query<"getLiveQuotes">, "tickers"> & { tickers?: string[] | string };

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
  /** Fundos de investimento que detêm o ativo (visão reversa do CDA/CVM), da competência mais recente por default. */
  listFundHolders(
    ticker: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldersResponse>;
  /** VWAP oficial (TradAvrgPric) e nº de negócios por pregão, do consolidado B3. */
  listTradeStats(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<TradeStatsResponse>;

  /** Lista o universo real de FIIs (não o preview). */
  screenFiis(params?: ScreenFiisParams): Promise<FiiScreenResponse>;
  getFii(ticker: string): Promise<Fii>;
  getFiiIndicators(ticker: string, params?: { at?: string }): Promise<FiiIndicatorsResponse>;
  /** Série mensal de um indicador de FII (mart_fii__reports) — mesmo shape do histórico de ações. */
  getFiiIndicatorHistory(ticker: string, name: string, params?: RangeParams): Promise<IndicatorHistoryResponse>;
  listFiiDistributions(ticker: string, params?: RangeParams): Promise<FiiDistributionsResponse>;
  listFiiReports(ticker: string, params?: RangeParams): Promise<FiiReportsResponse>;

  // --- ETFs ------------------------------------------------------------------
  /** Catálogo de ETFs listados na B3. */
  listEtfs(params?: { cursor?: string; limit?: number; search?: string; segment?: string }): Promise<EtfListResponse>;
  getEtf(ticker: string): Promise<EtfProfile>;

  // --- fundos de investimento (CVM 175) ---------------------------------------
  /** Ranqueia o universo de fundos por patrimônio, retorno ou nº de cotistas. */
  screenFunds(params?: ScreenFundsParams): Promise<FundScreenerResponse>;
  /** Catálogo de fundos de investimento (CVM 175). */
  listFunds(
    params?: { cursor?: string; limit?: number; search?: string; classificacao?: string },
  ): Promise<FundListResponse>;
  /** Perfil de um fundo pelo CNPJ da classe. */
  getFund(cnpj: string): Promise<FundProfile>;
  /** Série diária de cota/PL/fluxo de um fundo. */
  listFundQuotes(
    cnpj: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<FundQuotesResponse>;
  /** Carteira (holdings) de um fundo — BLC_4 do CDA, competência mais recente por default. */
  listFundHoldings(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldingsResponse>;

  // --- fluxo de investidores (B3, BDM/BDI) ------------------------------------
  /** Fluxo diário por perfil de investidor (participação na B3). */
  listInvestorFlow(
    params?: RangeParams & { limit?: number; cursor?: string; investor_type?: string },
  ): Promise<InvestorFlowResponse>;
  /** Fechamento mensal por perfil de investidor × segmento de mercado. */
  listInvestorFlowMonthly(params?: {
    cursor?: string;
    limit?: number;
    month?: string;
    investor_type?: string;
    segment?: string;
  }): Promise<InvestorFlowMonthlyResponse>;

  // --- ofertas públicas (mercado primário, CVM) --------------------------------
  /** Ofertas públicas de distribuição (IPO/follow-on, debêntures, cotas de fundos). */
  listOfferings(
    params?: RangeParams & {
      cursor?: string;
      limit?: number;
      search?: string;
      regime?: "ICVM_400_476" | "RCVM_160";
      tipo_ativo?: string;
    },
  ): Promise<OfferingsResponse>;

  listIndices(): Promise<IndexMeta[]>;
  listIndexQuotes(code: string, params?: RangeParams & { limit?: number }): Promise<IndexQuotesResponse>;
  getIndexComposition(code: string): Promise<IndexCompositionResponse>;
  /** Série intradiária (delay 15 min) de um índice; default = sessão mais recente. */
  getIndexIntraday(code: string, params?: { session?: string }): Promise<IntradaySeriesResponse>;

  // --- cotações ao vivo (delay 15 min) ---------------------------------------
  /** Lote de cotações ao vivo por `tickers` (CSV/array, máx 200) OU `index` (constituintes). */
  getLiveQuotes(params: LiveQuotesParams): Promise<LiveQuotesResponse>;
  /** Série intradiária (delay 15 min) de uma ação; default = sessão mais recente. */
  getStockIntraday(ticker: string, params?: { session?: string }): Promise<IntradaySeriesResponse>;

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

  // --- carteira / perfil / documentos (exigem chave por usuário; /conta) --------
  /**
   * Sua carteira consolidada: patrimônio, posições, preço médio, P&L, alocação.
   * Escopada ao dono da chave de API (a mesma da conta) — passe sua chave por usuário.
   */
  getPortfolio(): Promise<PortfolioResponse>;
  /** Seu perfil de investidor (suitability). `profile` é nulo se ainda não definido. */
  getSuitability(): Promise<SuitabilityResponse>;
  /**
   * Busca semântica no texto de documentos CVM/B3 (fatos relevantes, releases,
   * balanços, relatórios de FII, atas). Filtre por papel/categoria/ano quando souber.
   */
  searchDocuments(q: string, params?: SearchDocumentsParams): Promise<DocumentSearchResponse>;
}

export class NotInPreviewError extends Error {
  constructor(public readonly entity: string) {
    super(`"${entity}" não está disponível na API DataBolsa atual.`);
    this.name = "NotInPreviewError";
  }
}
