import type {
  CorporateEventsResponse,
  CryptoAsset,
  CryptoListResponse,
  CryptoLiveResponse,
  CryptoQuotesResponse,
  UsAssetsResponse,
  UsAssetDetail,
  UsQuotesResponse,
  UsFilingsResponse,
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
  MarketEventsResponse,
  MarketEvent,
  EventThread,
  MarketAnomaliesResponse,
  SimilarMarketEventsResponse,
  MarketEventSearchResponse,
  OptionExpiriesResponse,
  OptionsChainResponse,
  OptionsQuotesResponse,
  DocumentSearchResponse,
  DocumentTaxonomy,
  PortfolioResponse,
  CommunityBotsResponse,
  CommunityBotPostInput,
  CommunityBotPostResponse,
  CommunityBotReplyResponse,
  CommunityFeedParams,
  CommunityFeedResponse,
  CommunityPostResponse,
  RegisterCommunityBotInput,
  RegisterCommunityBotResponse,
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
  AddPortfolioTransactionResponse,
  CreatePortfolioResponse,
  PortfolioAssetRef,
  PortfolioDetail,
  PortfolioHistoryResponse,
  PortfolioImportInput,
  PortfolioImportRowsResponse,
  PortfolioImportsResponse,
  PortfolioImportSummary,
  PortfolioPatch,
  PortfolioRfContract,
  PortfolioTransaction,
  PortfolioTransactionInput,
  PortfolioTransactionPatch,
  PortfoliosResponse,
  PortfolioTransactionsResponse,
  ThesesResponse,
  ThesisResponse,
  CreateThesisResponse,
  ThesisExportStatus,
  ThesisWriteInput,
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

  /** Ledger de eventos de mercado — o que foi relevante em cada dia. */
  listMarketEvents(params?: {
    date?: string;
    from?: string;
    to?: string;
    layer?: "estrutural" | "setorial" | "corporativa";
    category?: string;
    entity?: string;
    ticker?: string;
    thread?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MarketEventsResponse>;
  getMarketEvent(id: number): Promise<MarketEvent>;
  getEventThread(slug: string): Promise<EventThread>;
  listMarketAnomalies(params?: {
    series?: "IBOV" | "IFIX" | "USDBRL" | "BRENT" | "VIX" | "SP500" | "NASDAQ";
    min_z?: number;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MarketAnomaliesResponse>;
  findSimilarMarketEvents(id: number, params?: { limit?: number }): Promise<SimilarMarketEventsResponse>;
  searchMarketEvents(q: string, params?: { limit?: number }): Promise<MarketEventSearchResponse>;

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

  // --- cripto (catálogo + velas diárias em BRL + snapshot quase-live) ---
  /** Catálogo de criptoativos (paginado; busca por símbolo/nome). */
  listCrypto(params?: { search?: string; limit?: number; cursor?: string }): Promise<CryptoListResponse>;
  getCrypto(symbol: string): Promise<CryptoAsset>;
  /** Snapshot quase-live (~1 min, 24/7) de todo o universo de cripto. */
  listCryptoLive(): Promise<CryptoLiveResponse>;
  listCryptoQuotes(
    symbol: string,
    params?: RangeParams & { interval?: "1d" | "1h"; limit?: number },
  ): Promise<CryptoQuotesResponse>;

  // --- ativos dos EUA (EOD em USD + fundamentos e filings SEC) ---
  /** Catálogo de ativos dos EUA (paginado; filtra por tipo, busca por ticker/nome). */
  listUsAssets(params?: {
    search?: string;
    type?: "stock" | "etf";
    bdr?: string;
    limit?: number;
    cursor?: string;
  }): Promise<UsAssetsResponse>;
  /** Perfil de um ativo dos EUA com fundamentos SEC inline. */
  getUsAsset(ticker: string): Promise<UsAssetDetail>;
  /** Cotações EOD em USD (ajustadas por desdobramento na fonte). */
  listUsAssetQuotes(
    ticker: string,
    params?: RangeParams & { limit?: number; cursor?: string },
  ): Promise<UsQuotesResponse>;
  /** Filings SEC (10-K/10-Q/8-K…) com link do documento no EDGAR. */
  listUsFilings(
    ticker: string,
    params?: { form?: string; limit?: number; cursor?: string },
  ): Promise<UsFilingsResponse>;

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
  /** Histórico mensal consolidado da carteira (patrimônio × aporte × proventos × realizado). */
  getPortfolioHistory(): Promise<PortfolioHistoryResponse>;
  /** Seu perfil de investidor (suitability). `profile` é nulo se ainda não definido. */
  getSuitability(): Promise<SuitabilityResponse>;

  // --- gestão de carteira (escrevem na SUA carteira real; exigem chave por usuário) ---
  /** Lista as suas carteiras (id, nome, nº de ativos). */
  listPortfolios(): Promise<PortfoliosResponse>;
  /** Cria uma carteira. O número de carteiras depende do plano (erro 402 no teto). */
  createPortfolio(name: string, visibility?: "private" | "unlisted" | "public"): Promise<CreatePortfolioResponse>;
  /** Uma carteira computada: posições, preço médio, P&L, alocação. */
  getPortfolioDetail(id: string): Promise<PortfolioDetail>;
  /** Renomeia, muda visibilidade e/ou marca como simulação. */
  updatePortfolio(id: string, patch: PortfolioPatch): Promise<unknown>;
  /** APAGA a carteira com todos os ativos e transações (irreversível). */
  deletePortfolio(id: string): Promise<{ deleted?: boolean }>;

  // --- teses de investimento (documentos de research; exigem chave por usuário) ---
  /** Lista as suas teses (resumo + limite do plano). */
  listMyTheses(): Promise<ThesesResponse>;
  /** Cria uma tese a partir de um ReportDoc (validado no servidor; 402 no teto do plano). */
  createThesis(input: ThesisWriteInput): Promise<CreateThesisResponse>;
  /** Cria uma tese enviando o arquivo JSON do doc em base64 (caminho do CLI `--file`). */
  importThesisFile(input: { filename?: string; contentBase64: string; visibility?: "private" | "unlisted" | "public" }): Promise<CreateThesisResponse>;
  /** Documento completo + status do export. */
  getThesis(id: string): Promise<ThesisResponse>;
  /** Atualiza doc, visibilidade, arquivamento e/ou tags privadas. */
  updateThesis(id: string, patch: Partial<ThesisWriteInput>): Promise<ThesisResponse>;
  /** Define a ordem manual da vitrine (perfil + gerenciador): `ids` na ordem desejada. */
  reorderTheses(ids: string[]): Promise<{ ok?: boolean }>;
  /** APAGA a tese (irreversível). */
  deleteThesis(id: string): Promise<{ deleted?: boolean }>;
  /** Muda a visibilidade (public aparece no perfil; o doc publicado vai inteiro). */
  publishThesis(id: string, visibility: "private" | "unlisted" | "public"): Promise<ThesisResponse>;
  /** Exporta em PDF (plano pago): 202 queued ou 200 ready com o link. */
  exportThesis(id: string): Promise<ThesisExportStatus>;
  /** Histórico mensal de UMA carteira. */
  getPortfolioHistoryById(id: string): Promise<PortfolioHistoryResponse>;
  /** Adiciona um ativo à carteira (idempotente; sem transações = watchlist). */
  addPortfolioAsset(id: string, asset: PortfolioAssetRef): Promise<unknown>;
  /** Remove um ativo da carteira, APAGANDO o ledger dele nela (irreversível). */
  removePortfolioAsset(id: string, asset: PortfolioAssetRef): Promise<unknown>;
  /** Define a taxa contratada de uma posição de renda fixa (indexer "none" limpa). */
  updatePortfolioAsset(id: string, asset: PortfolioAssetRef, rf: PortfolioRfContract): Promise<unknown>;
  /** Ledger (transações) de um ativo da carteira. */
  listPortfolioTransactions(id: string, asset: PortfolioAssetRef): Promise<PortfolioTransactionsResponse>;
  /** Lança uma transação; o ativo é adicionado automaticamente se preciso. */
  addPortfolioTransaction(
    id: string,
    asset: PortfolioAssetRef,
    tx: PortfolioTransactionInput,
  ): Promise<AddPortfolioTransactionResponse>;
  /** Edita uma transação (patch parcial). */
  updatePortfolioTransaction(id: string, txId: string, patch: PortfolioTransactionPatch): Promise<PortfolioTransaction>;
  /** Remove uma transação do ledger (irreversível). */
  deletePortfolioTransaction(id: string, txId: string): Promise<{ deleted?: boolean }>;
  /**
   * Importa uma planilha (Negociação/Movimentação da B3 em .xlsx, ou o template
   * manual em .csv/.xlsx) para a carteira. Idempotente: reenviar o mesmo arquivo
   * não duplica lançamentos. Retorna o resumo (importadas/duplicadas/avisos).
   */
  importPortfolioFile(id: string, input: PortfolioImportInput): Promise<PortfolioImportSummary>;
  /** Histórico de imports da carteira. */
  listPortfolioImports(id: string): Promise<PortfolioImportsResponse>;
  /** Linhas de um import, com status (imported/ignored/duplicate/error) e motivo. */
  listPortfolioImportRows(
    id: string,
    importId: string,
    params?: { status?: "imported" | "ignored" | "duplicate" | "error"; limit?: number; offset?: number },
  ): Promise<PortfolioImportRowsResponse>;
  /** Template CSV do import manual (texto). */
  getPortfolioImportTemplate(): Promise<string>;
  /** Reconcilia a posição de um ativo à quantidade declarada pela B3 (ajuste idempotente). */
  reconcilePortfolioAsset(
    id: string,
    asset: PortfolioAssetRef,
    targetQty: number,
    asOf: string,
  ): Promise<unknown>;
  /**
   * Busca semântica no texto de documentos CVM/B3 (fatos relevantes, releases,
   * balanços, relatórios de FII, atas). Filtre por papel/categoria/ano quando souber.
   */
  searchDocuments(q: string, params?: SearchDocumentsParams): Promise<DocumentSearchResponse>;
  /** Categorias, subtipos e cobertura disponíveis para filtrar documentos. */
  getDocumentTaxonomy(): Promise<DocumentTaxonomy>;

  // --- comunidade (bots registrados + leitura; exigem chave por usuário) --------
  /** Lista os bots de comunidade registrados pela sua conta. */
  listCommunityBots(): Promise<CommunityBotsResponse>;
  /**
   * Registra um bot de comunidade (perfil público @handle que publica via API,
   * com selo BOT). O número de bots por conta depende do plano.
   */
  registerCommunityBot(input: RegisterCommunityBotInput): Promise<RegisterCommunityBotResponse>;
  /** Desativa um bot da conta (publicações antigas permanecem, rotuladas BOT). */
  deleteCommunityBot(handle: string): Promise<{ ok?: boolean }>;
  /**
   * Publica um post na comunidade em nome do bot (público, com selo BOT).
   * Moderação automática: conteúdo reprovado vira erro 422 com o motivo.
   */
  createCommunityBotPost(handle: string, input: CommunityBotPostInput): Promise<CommunityBotPostResponse>;
  /** Publica uma resposta em nome do bot num post existente (mesma moderação). */
  createCommunityBotReply(handle: string, postId: string, body: string): Promise<CommunityBotReplyResponse>;
  /** Feed público da comunidade, paginado por cursor. */
  getCommunityFeed(params?: CommunityFeedParams): Promise<CommunityFeedResponse>;
  /** Um post da comunidade com a discussão completa. */
  getCommunityPost(id: string): Promise<CommunityPostResponse>;
}

export class NotInPreviewError extends Error {
  constructor(public readonly entity: string) {
    super(`"${entity}" não está disponível na API DataBolsa atual.`);
    this.name = "NotInPreviewError";
  }
}
