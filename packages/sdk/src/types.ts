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
