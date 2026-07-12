import type { components, operations } from "./schema";

/** Corpo JSON da resposta 200 de uma operação do contrato. */
export type Ok<Op extends keyof operations> = operations[Op] extends {
  responses: { 200: { content: { "application/json": infer T } } };
}
  ? T
  : never;

/** Parâmetros de query de uma operação do contrato (sem o `| undefined`). */
export type Query<Op extends keyof operations> = operations[Op] extends {
  parameters: { query?: infer Q };
}
  ? NonNullable<Q>
  : never;

export type Schemas = components["schemas"];

// --- objetos de domínio (schemas do contrato) -----------------------------
export type Lineage = Schemas["Lineage"];
export type Company = Schemas["Company"];
export type Stock = Schemas["Stock"];
export type Quote = Schemas["Quote"];
export type IndicatorValue = Schemas["IndicatorValue"];
export type Observation = Schemas["Observation"];
export type Document = Schemas["Document"];
export type Dividend = Schemas["Dividend"];
export type CorporateEvent = Schemas["CorporateEvent"];
export type Fii = Schemas["Fii"];
export type FiiDistribution = Schemas["FiiDistribution"];
export type FiiMonthlyReport = Schemas["FiiMonthlyReport"];
export type FiiListRow = Schemas["FiiListRow"];
export type SeriesMeta = Schemas["SeriesMeta"];
export type TesouroBondQuote = Schemas["TesouroBondQuote"];
export type IndexMeta = Schemas["IndexMeta"];
export type Expectation = Schemas["Expectation"];
export type RegimeSnapshot = Schemas["RegimeSnapshot"];
export type RegimeSignal = Schemas["RegimeSignal"];
export type ScreenerRow = Schemas["ScreenerRow"];
export type CryptoCandle = Schemas["CryptoCandle"];
export type SearchResult = Schemas["SearchResult"];
export type InsiderMove = Schemas["InsiderMove"];
export type OptionContract = Schemas["OptionContract"];
export type OptionExpiry = Schemas["OptionExpiries"]["expiries"][number];
export type OptionQuote = Schemas["OptionQuote"];
export type BdrProfile = Schemas["BdrProfile"];
export type BdrQuote = Schemas["BdrQuote"];
export type IngestSourceStatus = Schemas["IngestSourceHealth"]["status"];
export type IngestSourceHealth = Schemas["IngestSourceHealth"];
export type IngestRunSummary = Schemas["IngestRunSummary"];
export type EtfProfile = Schemas["EtfProfile"];
export type FundProfile = Schemas["FundProfile"];
export type FundQuote = Schemas["FundQuote"];
export type FundHolding = Schemas["FundHolding"];
export type FundOwnershipSummary = Schemas["FundOwnershipSummary"];
export type FundScreenerItem = Schemas["FundScreenerItem"];
export type TradeStat = Schemas["TradeStat"];
export type InvestorFlow = Schemas["InvestorFlow"];
export type InvestorFlowMonthly = Schemas["InvestorFlowMonthly"];
export type PublicOffering = Schemas["PublicOffering"];
export type LiveQuote = Schemas["LiveQuote"];
export type IntradayPoint = Schemas["IntradayPoint"];
// --- carteira / perfil / documentos (servidos sob /v1, exigem chave por usuário) ---
export type PortfolioContext = Schemas["PortfolioContext"];
export type PortfolioHolding = Schemas["PortfolioHolding"];
export type SuitabilityProfile = Schemas["SuitabilityProfile"];
export type DocumentChunk = Schemas["DocumentChunk"];

// --- respostas (corpo 200 de cada operação) -------------------------------
export type HealthResponse = Ok<"getHealth">;
export type IngestHealthResponse = Ok<"getIngestHealth">;
export type ScreenStocksResponse = Ok<"screenStocks">;
export type FiiScreenResponse = Ok<"screenFiis">;
export type QuotesResponse = Ok<"listQuotes">;
export type StockIndicatorsResponse = Ok<"getStockIndicators">;
export type IndicatorHistoryResponse = Ok<"getStockIndicatorHistory">;
export type DividendsResponse = Ok<"listDividends">;
export type CorporateEventsResponse = Ok<"listCorporateEvents">;
export type DocumentsResponse = Ok<"listCompanyDocuments">;
export type InsiderResponse = Ok<"listInsiderMoves">;
export type FiiIndicatorsResponse = Ok<"getFiiIndicators">;
export type FiiDistributionsResponse = Ok<"listFiiDistributions">;
export type FiiReportsResponse = Ok<"listFiiReports">;
export type SeriesResponse = Ok<"getSeries">;
export type IndexQuotesResponse = Ok<"listIndexQuotes">;
export type IndexCompositionResponse = Ok<"getIndexComposition">;
export type YieldCurveResponse = Ok<"getYieldCurve">;
export type TesouroBondsResponse = Ok<"listTesouroBonds">;
export type ExpectationsResponse = Ok<"getMarketExpectations">;
export type MacroGearsResponse = Ok<"getMacroGears">;
export type CryptoQuotesResponse = Ok<"listCryptoQuotes">;
export type SearchResponse = Ok<"search">;
export type OptionsChainResponse = Ok<"getOptionsChain">;
export type OptionExpiriesResponse = Ok<"listOptionExpiries">;
export type OptionsQuotesResponse = Ok<"listOptionQuotes">;
export type BdrListResponse = Ok<"listBdrs">;
export type BdrQuotesResponse = Ok<"listBdrQuotes">;
export type EtfListResponse = Ok<"listEtfs">;
export type FundListResponse = Ok<"listFunds">;
export type FundQuotesResponse = Ok<"listFundQuotes">;
export type FundHoldingsResponse = Ok<"listFundHoldings">;
export type FundHoldersResponse = Ok<"listFundHolders">;
export type FundScreenerResponse = Ok<"screenFunds">;
export type TradeStatsResponse = Ok<"listTradeStats">;
export type InvestorFlowResponse = Ok<"listInvestorFlow">;
export type InvestorFlowMonthlyResponse = Ok<"listInvestorFlowMonthly">;
export type OfferingsResponse = Ok<"listOfferings">;
export type LiveQuotesResponse = Ok<"getLiveQuotes">;
export type IntradaySeriesResponse = Ok<"getStockIntraday">;
export type PortfolioResponse = Ok<"getPortfolio">;
export type SuitabilityResponse = Ok<"getSuitability">;
export type DocumentSearchResponse = Ok<"searchDocuments">;

/** Corpo JSON da resposta 201 (criação) de uma operação do contrato. */
export type Created<Op extends keyof operations> = operations[Op] extends {
  responses: { 201: { content: { "application/json": infer T } } };
}
  ? T
  : never;

// --- comunidade (bots registrados + leitura do feed; exigem chave por usuário) ---
export type CommunityBot = Schemas["CommunityBot"];
export type CommunityItem = Schemas["CommunityItem"];
export type CommunityBotsResponse = Ok<"listCommunityBots">;
export type CommunityFeedResponse = Ok<"getCommunityFeed">;
export type CommunityPostResponse = Ok<"getCommunityPost">;
export type RegisterCommunityBotResponse = Created<"registerCommunityBot">;
export type CommunityBotPostResponse = Created<"createCommunityBotPost">;
export type CommunityBotReplyResponse = Created<"createCommunityBotReply">;

/** Registro de um bot de comunidade — `POST /v1/community/bots`. */
export interface RegisterCommunityBotInput {
  /** Handle público (^[a-z0-9_.]{3,20}$). */
  handle: string;
  displayName: string;
  bio?: string;
}

/** Publicação como bot — `POST /v1/community/bots/{handle}/posts`. */
export interface CommunityBotPostInput {
  /** Texto do post (12–2000 caracteres; cashtags $PETR4 viram links). */
  body: string;
  title?: string;
  ticker?: string;
  assetType?: "stock" | "fii";
}

/** Filtros do feed — `GET /v1/community/feed`. */
export interface CommunityFeedParams {
  tab?: "recentes" | "alta";
  ticker?: string;
  q?: string;
  cursor?: string;
}

// --- gestão de carteira (escrita; exigem chave por usuário) --------------------
export type PortfolioListItem = Schemas["PortfolioListItem"];
export type PortfolioDetail = Schemas["PortfolioDetail"];
export type PortfolioTransaction = Schemas["PortfolioTransaction"];
export type PortfolioHistoryResponse = Ok<"getPortfolioHistory">;
export type PortfoliosResponse = Ok<"listPortfolios">;
export type PortfolioTransactionsResponse = Ok<"listPortfolioTransactions">;
export type PortfolioImportsResponse = Ok<"listPortfolioImports">;
export type PortfolioImportRowsResponse = Ok<"listPortfolioImportRows">;
export type CreatePortfolioResponse = Created<"createPortfolio">;
export type AddPortfolioTransactionResponse = Created<"addPortfolioTransaction">;
export type PortfolioImportSummary = Schemas["PortfolioImportSummary"];

/** Referência de ativo dentro de uma carteira (chave natural). */
export interface PortfolioAssetRef {
  assetType: "stock" | "fii" | "bdr" | "index" | "tesouro" | "crypto" | "option" | "renda_fixa";
  /** Ticker (PETR4) ou, para Tesouro, o nome oficial do título. */
  symbol: string;
}

/** Campos de uma transação — `POST /v1/portfolios/{id}/transactions`. */
export interface PortfolioTransactionInput {
  kind: "buy" | "sell" | "split";
  /** Data do negócio (AAAA-MM-DD). */
  tradeDate: string;
  /** Obrigatória em buy/sell (> 0). */
  quantity?: number;
  /** Preço unitário em BRL (omita se desconhecido). */
  price?: number | null;
  fees?: number;
  /** Fator do split (2 = 2:1; 0.5 = grupamento 1:2). */
  ratio?: number;
  note?: string;
}

/** Patch parcial de uma transação — `PATCH /v1/portfolios/{id}/transactions/{txId}`. */
export type PortfolioTransactionPatch = Partial<PortfolioTransactionInput>;

/** Ajustes de uma carteira — `PATCH /v1/portfolios/{id}`. */
export interface PortfolioPatch {
  name?: string;
  visibility?: "private" | "unlisted" | "public";
  /** true = carteira de simulação (fora do consolidado). */
  excludeFromConsolidated?: boolean;
}

/** Import de planilha — `POST /v1/portfolios/{id}/imports`. */
export interface PortfolioImportInput {
  /** Conteúdo do arquivo (xlsx da B3 ou CSV do template) em base64. Máx. 8 MB. */
  contentBase64: string;
  filename?: string;
}

/** Taxa contratada de renda fixa — `PATCH /v1/portfolios/{id}/assets`. */
export interface PortfolioRfContract {
  /** cdi = % do CDI; prefixado = % a.a.; ipca = IPCA + % a.a.; none limpa. */
  indexer: "cdi" | "prefixado" | "ipca" | "none";
  rate?: number;
}

/** Filtros da busca semântica de documentos — `GET /v1/documents/search`. */
export interface SearchDocumentsParams {
  /** Papéis a filtrar; array serializado em CSV pelo HttpClient. */
  tickers?: string[] | string;
  /** Categoria do documento, ex.: "Fato Relevante". */
  category?: string;
  /** Ano de referência (AAAA). */
  year?: number;
  /** Restringe a trechos de tabela (fatos numéricos). */
  tablesOnly?: boolean;
  /** Máximo de trechos (1–25, default 8). */
  limit?: number;
}

/**
 * Agrupamento client-side de `from`/`to` (datas ISO) — não é um schema do
 * contrato; os endpoints os recebem como query params soltos. Único tipo
 * mantido à mão de propósito.
 */
export interface RangeParams {
  from?: string;
  to?: string;
}
