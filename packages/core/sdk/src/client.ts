import type { Objects } from "./objects/facade";
import type { Account } from "./objects/account";
import type {
  ObjectIntersectResponse,
  ObjectPathResponse,
  ObjectPathsFoundResponse,
  ObjectFactsResponse,
  ObjectPropertiesResponse,
  ObjectHistoryResponse,
  FactCatalogResponse,
  ObjectAggregateResponse,
  ObjectRankResponse,
  ObjectListResponse,
  ObjectTableResult,
  ObjectEventsResponse,
  ObjectCensus,
  ObjectRelationsResponse,
  GlobalLinksResponse,
  ObjectLinkStats,
  ObjectEvidenceResponse,
  ObjectLinksResponse,
  ObjectLinkHistoryResponse,
  ObjectResolveResponse,
  ObjectResponse,
  TradingStatusResponse,
  CorporateEventsResponse,
  CryptoLiveResponse,
  DocumentReadResponse,
  DocumentSearchResponse,
  DocumentTaxonomy,
  DocumentsResponse,
  EventThread,
  FiiScreenResponse,
  FundHoldingsResponse,
  FundLookThroughResponse,
  FundProfile,
  HealthResponse,
  IngestHealthResponse,
  InsiderResponse,
  IntradaySeriesResponse,
  InvestorFlowMonthlyResponse,
  InvestorFlowResponse,
  MacroGearsResponse,
  MarketAnomaliesResponse,
  MarketEventSearchResponse,
  MarketEventsResponse,
  OptionExpiriesResponse,
  OptionsChainResponse,
  OptionsQuotesResponse,
  OwnershipMoversResponse,
  Query,
  RangeParams,
  ReadDocumentParams,
  RegimeSnapshot,
  SearchDocumentsParams,
  SearchResponse,
  SearchResult,
  SimilarMarketEventsResponse,
  StockIndicatorsResponse,
  BondCurveResponse,
  CommodityCurveResponse,
  CommoditySettlementsResponse,
  CreditCurveResponse,
  CreditOtcQuotesResponse,
  MineralObservationsResponse,
  FidcListResponse,
  FidcRegulationTerms,
  FidcDelinquencyResponse,
  FidcScrResponse,
  FidcSectorResponse,
  FidcInvestorResponse,
  FidcPricingResponse,
  DebentureScreenerResponse,
  UsAssetDetail,
  UsFilingsResponse,
} from "./types";

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
  /**
   * A entrada object-first: resolve um texto para o objeto do grafo e navega por fatos,
   * relações e capítulos sem conhecer o endpoint por baixo. Os métodos flat abaixo continuam
   * como escape hatch tipado.
   */
  readonly objects: Objects;
  /** A porta de escrita: carteiras e teses do dono da chave; aceita handles de `objects`. */
  readonly account: Account;

  getHealth(): Promise<HealthResponse>;

  /** Saúde da ingestão: última run + saúde por fonte + histórico (data lake). */
  getIngestHealth(): Promise<IngestHealthResponse>;

  getStockIndicators(ticker: string, params?: { at?: string }): Promise<StockIndicatorsResponse>;
  listCorporateEvents(ticker: string, params?: RangeParams): Promise<CorporateEventsResponse>;
  /** `company` aceita ticker (BBAS3) OU código CVM numérico (1023) — os dois resolvem. */
  listCompanyDocuments(
    company: string | number,
    params?: RangeParams & { category?: string },
  ): Promise<DocumentsResponse>;
  /**
   * Saldo mensal de negociação de insiders (CVM VLMO). Série nível-COMPANHIA: todos os
   * tickers do emissor devolvem os MESMOS números, então somar PETR3 + PETR4 conta a mesma
   * movimentação duas vezes. `corporate_event_shares` vem separado e não soma a `net_shares`.
   */
  listInsiderMoves(ticker: string, params?: RangeParams): Promise<InsiderResponse>;
  /**
   * Quais fundos se mexeram no papel numa competência, um a um. `direction` filtra pelo sinal
   * da variação de quantidade (in = comprou, out = vendeu).
   */
  listOwnershipMovers(
    ticker: string,
    params?: { cursor?: string; limit?: number; date?: string; direction?: "in" | "out" | "all" },
  ): Promise<OwnershipMoversResponse>;

  /** Lista o universo real de FIIs (não o preview). */
  screenFiis(params?: ScreenFiisParams): Promise<FiiScreenResponse>;

  // --- fundos de investimento (CVM 175) ---------------------------------------
  /** Perfil de um fundo pelo CNPJ da classe. */
  getFund(cnpj: string): Promise<FundProfile>;
  /** Carteira (holdings) de um fundo — BLC_4 do CDA, competência mais recente por default. */
  listFundHoldings(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string },
  ): Promise<FundHoldingsResponse>;
  /**
   * O que o REGULAMENTO da classe estipula, extraído com página e trecho literal: índices de
   * subordinação, eventos de avaliação e liquidação, limites de concentração, critérios de
   * elegibilidade, taxas, cascata de alocação e prestadores.
   *
   * `custo.total_pct_aa` soma apenas o que incide sobre o patrimônio ao ano, e `custo.parcial`
   * marca quando existe taxa declarada fora da soma — nesse caso o total é PISO. Ausência de
   * resposta significa que o regulamento ainda não foi lido, nunca que a classe não tem um.
   */
  getFidcRegulationTerms(cnpj: string): Promise<FidcRegulationTerms>;
  /**
   * Exposição do fundo a ativos listados somando a posição direta e a que chega através das
   * cotas que ele detém. O número é PISO, nunca total — `indirect_coverage_pct` diz quanto da
   * carteira em cotas foi possível abrir, e exposição baixa não significa exposição ausente.
   */
  listFundLookThrough(
    cnpj: string,
    params?: { cursor?: string; limit?: number; date?: string; ticker?: string },
  ): Promise<FundLookThroughResponse>;

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

  /** Série intradiária (delay 15 min) de um índice; default = sessão mais recente. */
  getIndexIntraday(code: string, params?: { session?: string }): Promise<IntradaySeriesResponse>;

  // --- série intradiária (delay 15 min) --------------------------------------
  /** Série intradiária (delay 15 min) de uma ação; default = sessão mais recente. */
  getStockIntraday(ticker: string, params?: { session?: string }): Promise<IntradaySeriesResponse>;

  /** Curvas de juros de mercado por vértice (DI e curvas de referência pré/IPCA+/implícita). */
  getBondCurves(params?: {
    kind?: "di" | "pre_ref" | "ipca_ref" | "implicita_ref";
    date?: string;
  }): Promise<BondCurveResponse>;
  /**
   * Observações em formato longo, para série temporal ou visão por país. Use
   * `country` com o código ISO3 para responder "o que este país produz" (ex.: BRA).
   */
  listMineralObservations(params?: {
    mineral?: string;
    country?: string;
    statistic?: "production" | "reserves";
    year?: number;
    from?: number;
    to?: number;
    include_world_total?: boolean;
    cursor?: string;
    limit?: number;
  }): Promise<MineralObservationsResponse>;
  /**
   * Curva de ajuste de um pregão, um ponto por vencimento. O vencimento mais curto
   * NÃO é preço à vista — é base futura.
   */
  getCommodityCurve(
    commodity: string,
    params?: { date?: string },
  ): Promise<CommodityCurveResponse>;
  /**
   * Série de ajuste diário. Filtre por `contract` para série comparável no tempo —
   * sem isso a mesma data traz vários vencimentos.
   */
  listCommoditySettlements(
    commodity: string,
    params?: { contract?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<CommoditySettlementsResponse>;

  // --- crédito privado (debêntures, balcão, risco de emissor) ---------------
  /** Secundário de balcão por família de instrumento (CDB, CRI, CRA, LCI, LCA…). */
  listOtcQuotes(
    params: { family: string; date?: string; cursor?: string; limit?: number } & RangeParams,
  ): Promise<CreditOtcQuotesResponse>;
  /**
   * Classes de FIDC numa competência. Superfície própria porque a cota de FIDC é marcada a
   * LAUDO e não passa pelo informe diário — o fundo não aparece nas séries de `/funds`.
   * A chave é a CLASSE: um fundo multiclasse tem um CNPJ por classe. As duas séries de
   * inadimplência (`*_with_risk` e `*_no_risk`) NÃO se somam.
   */
  listFidcs(params?: {
    q?: string;
    cnpj?: string;
    date?: string;
    minNetWorth?: number;
    cursor?: string;
    limit?: number;
  }): Promise<FidcListResponse>;
  /** Termos do regulamento da classe, com custo anual somado e procedência por fato. */
  getFidcRegulationTerms(cnpj: string): Promise<FidcRegulationTerms>;
  /** Aging por faixa. Somar `risk_retained` true e false conta o mesmo fundo duas vezes. */
  listFidcDelinquency(cnpj: string, params?: { date?: string }): Promise<FidcDelinquencyResponse>;
  /** Mix SCR (Res. CMN 2.682). NÃO é rating de agência — a nota vem da aresta `rates`. */
  listFidcScr(cnpj: string, params?: { date?: string }): Promise<FidcScrResponse>;
  /**
   * Carteira por SETOR do lastro, em DUAS camadas que não se somam: `is_subcategory: false`
   * é o topo e já cobre a carteira inteira, o resto reabre algumas delas. Somar as duas
   * dobra a carteira. `meta.unclassified_total` é a parte que a classe não abriu.
   */
  listFidcSectors(cnpj: string, params?: { date?: string }): Promise<FidcSectorResponse>;
  /**
   * Quem é o passivo, por tipo de cotista e senioridade. `pct_of_seniority` usa o total da
   * PRÓPRIA senioridade. `is_institutional` é classificação nossa e deixa fundo e corretora
   * de fora — são veículos de passagem. Série começa em 2019-11.
   */
  listFidcInvestors(cnpj: string, params?: { date?: string }): Promise<FidcInvestorResponse>;
  /**
   * Por quanto o fundo COMPRA o risco. As duas `rate_kind` não se somam (deságio de compra
   * × juros do papel). `peer_median_buy_avg` viaja em toda linha porque taxa isolada não
   * informa nada. Só ~27% das classes declaram taxa — vazio é normal da fonte.
   */
  listFidcPricing(cnpj: string, params?: { date?: string }): Promise<FidcPricingResponse>;
  /**
   * Curva de crédito observada no secundário de debêntures: spread mediano por bucket de
   * prazo (janela de 21 pregões). Spread é o DA EMISSÃO (as-filed, mix de safras); o
   * reapreçamento está em `pct_of_curve_median` (<100 = deságio).
   */
  getCreditCurve(params?: {
    indexer?: "DI" | "IPCA";
    date?: string;
  }): Promise<CreditCurveResponse>;
  /** Screener de debêntures: indexação, spread, vencimento, liquidez e demanda de fundos. */
  screenDebentures(params?: {
    q?: string;
    indexer?: string;
    incentivada?: boolean;
    active?: boolean;
    maturityFrom?: string;
    maturityTo?: string;
    minSpread?: number;
    maxSpread?: number;
    minTrades30d?: number;
    minFundHolders?: number;
    orderBy?: "spread" | "maturity" | "volume_30d" | "trades_30d" | "fund_holders" | "pct_of_curve";
    order?: "asc" | "desc";
    cursor?: string;
    limit?: number;
  }): Promise<DebentureScreenerResponse>;
  getMacroRegime(params?: { at?: string }): Promise<RegimeSnapshot>;
  getMacroGears(params?: { gear?: string }): Promise<MacroGearsResponse>;

  /** Snapshot quase-live (~1 min, 24/7) de todo o universo de cripto. */
  listCryptoLive(): Promise<CryptoLiveResponse>;

  /** Perfil de um ativo dos EUA com fundamentos SEC inline. */
  getUsAsset(ticker: string): Promise<UsAssetDetail>;
  /** Filings SEC (10-K/10-Q/8-K…) com link do documento no EDGAR. */
  listUsFilings(
    ticker: string,
    params?: { form?: string; limit?: number; cursor?: string },
  ): Promise<UsFilingsResponse>;

  // --- opções (chain viva + greeks europeus/americanos; histórico por série) ---
  /** Cadeia viva de um subjacente (séries não vencidas, mais negociadas). Filtra por vencimento/tipo. */
  getOptionsChain(
    underlying: string,
    params?: { expiry?: string; type?: "call" | "put" },
  ): Promise<OptionsChainResponse>;
  /** @deprecated use `getOptionsChain`, que é o nome da operação no contrato. */
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

  /** Busca unificada (ações, FIIs, índices, títulos, séries macro) — backed o Cmd+K. */
  search(q: string, params?: { limit?: number }): Promise<SearchResponse>;

  // --- documentos (exigem chave por usuário; /conta) ---------------------------
  // --- gestão de carteira (escrevem na SUA carteira real; exigem chave por usuário) ---
  /**
   * Busca semântica no texto de documentos CVM/B3 (fatos relevantes, releases,
   * balanços, relatórios de FII, atas). Filtre por papel/categoria/ano quando souber.
   */
  searchDocuments(q: string, params?: SearchDocumentsParams): Promise<DocumentSearchResponse>;
  /** Lê um documento inteiro, em ordem, paginando por meta.next_cursor. */
  readDocument(protocol: string, params?: ReadDocumentParams): Promise<DocumentReadResponse>;
  /** Categorias, subtipos e cobertura disponíveis para filtrar documentos. */
  getDocumentTaxonomy(): Promise<DocumentTaxonomy>;

  // ── grafo de identidade ───────────────────────────────────────────────────
  /**
   * Enumera o universo de um tipo sem exigir medida. Corte numérico pertence a
   * `rankObjects`; aqui `where` aceita apenas propriedades textuais.
   */
  listObjects(params: {
    kind: string;
    subkind?: string;
    rel?: string;
    rel_to?: string;
    rel_direction?: "in" | "out";
    at?: string;
    where?: string;
    /** Busca por NOME dentro da coorte (palavras em qualquer ordem, sem acento); pagina com `cursor`. */
    q?: string;
    /** Propriedades do catálogo projetadas em cada linha (`properties`), até 8, separadas por vírgula. */
    props?: string;
    total?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<ObjectListResponse>;

  /**
   * De um texto para o objeto. Devolve CANDIDATOS: chave exata é confiável, nome é palpite.
   * `q` aceita VÁRIAS consultas (até 20): cada candidato vem com `query` e `meta.queries` dá o
   * veredito de cada uma. Com mais de uma, `limit` vale por consulta e não há cursor.
   */
  resolveObject(params: {
    q: string | string[];
    kind?: string;
    /** Recorta DENTRO do tipo: `fii`, `fidc`, `etf`, `debenture`, `bdr`, `coe`, `tesouro`. É o corte que `kind` sozinho não dá — `fund` mistura FIF com FII. */
    subkind?: string;
    limit?: number;
  }): Promise<ObjectResolveResponse>;
  /**
   * O objeto, seus apelidos e o mapa de relações disponíveis.
   *
   * `resolve` decide COMO o id é lido: `auto` (default) o trata como referência publicada —
   * id fundido redireciona, id cindido responde 409 com a lista de sucessores —, e `exact` o
   * lê literalmente, sem consultar histórico. `exact` é o que dá endereço ao sucessor que
   * HERDOU o id numa cisão: sem ele, consultá-lo cairia no mesmo 409 e o ramo ficaria
   * inalcançável. Vale igual nas outras seis operações que resolvem id.
   */
  getObject(id: string, params?: { resolve?: "auto" | "exact" }): Promise<ObjectResponse>;
  /**
   * Atravessa uma relação. Sem `at`, a resposta é "quem JÁ", não "quem".
   *
   * `other_kind`/`other_subkind` recortam pelo OUTRO lado, no servidor, antes da paginação e do
   * `total`: um cedente com 331 arestas `assigned_to` custava cinco páginas para achar o FIDC
   * entre as séries de CRI.
   */
  listObjectLinks(
    id: string,
    params?: {
      rel?: string;
      direction?: "out" | "in";
      other_kind?: string;
      other_subkind?: string;
      at?: string;
      total?: boolean;
      limit?: number;
      cursor?: string;
      resolve?: "auto" | "exact";
    },
  ): Promise<ObjectLinksResponse>;
  /** Histórico da MAGNITUDE de uma relação snapshot — uma linha por competência publicada. Só verbos `snapshot`. */
  getObjectLinkHistory(
    id: string,
    params: {
      rel: string;
      direction?: "out" | "in";
      other_id?: string;
      source?: string;
      from?: string;
      to?: string;
      limit?: number;
      cursor?: string;
      resolve?: "auto" | "exact";
    },
  ): Promise<ObjectLinkHistoryResponse>;
  /** O TRECHO do documento que sustenta o objeto — protocolo, link, páginas e parágrafo. */
  getObjectEvidence(
    id: string,
    params?: { from?: string; to?: string; limit?: number; cursor?: string; resolve?: "auto" | "exact" },
  ): Promise<ObjectEvidenceResponse>;
  /** Emissoras fora de operação regular (recuperação judicial e afins). */
  listTradingStatus(params?: {
    status?: string;
    total?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<TradingStatusResponse>;
  /**
   * ÁLGEBRA DE CONJUNTOS sobre duas relações — a pergunta que os dois montes separados não
   * respondem. `op` escolhe a operação: `intersect` (default) é quem está nos dois, `union` é
   * quem está em qualquer um, e `difference` é quem está em A e NÃO em B — a pergunta de
   * concentração, porque cedente EXCLUSIVO é risco que não aparece em média nenhuma.
   */
  intersectObjects(params: {
    a: string;
    b: string;
    a_direction?: "out" | "in";
    b_direction?: "out" | "in";
    a_to_id?: string;
    b_to_id?: string;
    /** Recorta o TIPO da outra ponta. `issued` sai da companhia tanto para `instrument` quanto para `equity_security`: sem isto, "cede para FIDC e emite DÍVIDA" inclui quem só emitiu ação. */
    a_to_kind?: string;
    b_to_kind?: string;
    kind?: string;
    /** Recorta DENTRO do tipo: `fii`, `fidc`, `etf`, `debenture`, `bdr`, `coe`, `tesouro`. É o corte que `kind` sozinho não dá — `fund` mistura FIF com FII. */
    subkind?: string;
    at?: string;
    op?: "intersect" | "union" | "difference";
    /** `a_count`/`b_count`/`total` ordenam pelo GRAU — é assim que se pede "as três maiores da interseção" numa chamada só, em vez de paginar o universo e agregar no cliente. */
    order?: "name" | "a_count" | "b_count" | "total";
    total?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<ObjectIntersectResponse>;
  /** Travessia em CADEIA (A → B → C), com o meio invisível. `return_at` escolhe a posição listada. */
  traverseObjectPath(params: {
    steps: string;
    start_id?: string;
    start_kind?: string;
    start_subkind?: string;
    end_id?: string;
    end_kind?: string;
    end_subkind?: string;
    count_at?: number;
    return_at?: number;
    at?: string;
    total?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<ObjectPathResponse>;
  /** Como dois objetos se ligam: descobre a cadeia entre eles, agrupada e com exemplos. */
  findObjectPaths(params: {
    from_id: string;
    to_id: string;
    max_hops?: number;
    limit?: number;
    at?: string;
    resolve?: "auto" | "exact";
  }): Promise<ObjectPathsFoundResponse>;
  /** Quantos objetos EXISTEM, por tipo. Não confundir com getObjectLinkStats, que conta quem TEM a relação. */
  getObjectCensus(): Promise<ObjectCensus>;
  /**
   * O VOCABULÁRIO dos treze verbos: o que cada um afirma, o que NÃO afirma, quem pode
   * praticá-lo, sobre quem, a forma temporal e a última competência publicada. Leia antes de
   * atravessar — é o que diz que `shareholder_of` é quadro societário sem percentual, e qual
   * data faz sentido pedir em `at` para cada verbo.
   */
  listObjectRelations(): Promise<ObjectRelationsResponse>;
  /**
   * Todas as medidas numéricas de um ou VÁRIOS objetos (até 50) no último valor. Cada linha
   * traz `entity_id`; `meta.subjects` diz o que aconteceu com cada id. Leia `unit`: `ratio` é
   * fração, `pct` é percentual. `facts` recorta por nome.
   */
  getObjectFacts(
    id: string | string[],
    params?: { at?: string; facts?: string[]; resolve?: "auto" | "exact" },
  ): Promise<ObjectFactsResponse>;
  /** O que o objeto É, em palavras de vocabulário fechado. Leia `vocabulary` antes de concluir de um valor. */
  getObjectProperties(id: string | string[], params?: { resolve?: "auto" | "exact" }): Promise<ObjectPropertiesResponse>;
  /**
   * As séries de uma ou várias medidas, de um ou VÁRIOS objetos — uma por (objeto, medida),
   * cada uma com a própria régua. Medida que não existe para um objeto vem com `error`; com um
   * objeto e uma medida só, é 404.
   */
  /**
   * As séries de N medidas de N objetos numa chamada. `data` é sempre a lista de séries e
   * `meta.subjects` diz o que aconteceu com cada id — com um id ou cinquenta. Orçamento:
   * ids × facts ≤ 100 séries e × limit ≤ 100.000 pontos (422 acima disso).
   */
  getObjectHistory(
    id: string | string[],
    params: {
      facts: string | string[];
      series?: string;
      from?: string;
      to?: string;
      limit?: number;
      resolve?: "auto" | "exact";
      /**
       * Transformação sobre a série, guardada pela classe `axes.aggregation`: `sum_12m`/`ytd` somam fluxos,
       * `compound_12m`/`compound_ytd` compõem variações (IPCA em 12 meses), `mean_3m`/`mean_12m` tiram média,
       * `pct_change` e `diff` comparam com o ponto anterior. Classe que não sustenta a conta responde `error` na série.
       */
      transform?: "sum_12m" | "ytd" | "compound_12m" | "compound_ytd" | "mean_3m" | "mean_12m" | "pct_change" | "diff";
    },
  ): Promise<ObjectHistoryResponse>;
  /**
   * A mesma resposta de `getObjectHistory` ou `rankObjects` como TABELA com papéis declarados
   * (`time`, `measure`, `dimension`…). `input` são os parâmetros da operação pelo nome do
   * contrato; `id` é o sujeito em `getObjectHistory`. `meta.query` devolve a consulta reexecutável.
   */
  getObjectTable(params: { operation: "getObjectHistory" | "rankObjects" | "getObjectFacts" | "aggregateObjects"; id?: string | string[]; input?: Record<string, unknown> }): Promise<ObjectTableResult>;
  /** Que medidas existem no grafo e em que escala cada uma. */
  listFactCatalog(): Promise<FactCatalogResponse>;
  /** Resume a coorte por grupo — soma, média ou mediana, repartida por propriedade ou relação. */
  aggregateObjects(
    params: {
      kind: string;
      /** Omita com `agg: "count"` para o CENSO: contar objetos por grupo, sem medida. */
      fact?: string;
      /** Como resumir. `sum` é RECUSADO em `pct`, `ratio`, `x` e `points`. */
      agg: "sum" | "avg" | "median" | "min" | "max" | "count";
      /** Nome de PROPRIEDADE ou verbo de RELAÇÃO. `meta.groupable` lista os dois conjuntos. */
      group_by: string;
      /**
       * Onde a COORTE está na aresta. `manages` liga gestora a fundo: coorte de fundos é `in`.
       * Direção errada devolve lista vazia, e `meta.empty_reason` diz qual funcionaria.
       */
      group_by_direction?: "out" | "in";
      subkind?: string;
      at?: string;
      rel?: string;
      rel_to?: string;
      rel_direction?: "out" | "in";
      limit?: number;
      /** Cursor de `meta.next_cursor` da página anterior de GRUPOS; a ordem é estável. */
      cursor?: string;
      /** Busca no RÓTULO do grupo (gestora, setor…), antes de cortar a página. */
      q?: string;
      /** Os mesmos cortes de `rankObjects`, por número e por palavra. Recortam ANTES de agrupar. */
      where?: string;
      /**
       * Por qual coluna ordenar e CORTAR a página: `value` (default) usa a agregação;
       * `objects` usa o tamanho do grupo — "as gestoras com mais fundos" é essa pergunta.
       */
      order_by?: "value" | "objects";
      /** Piso da DATA-BASE do valor, a mesma régua de `rankObjects`: mais antigo alarga a coorte com valor, mais novo aperta. `meta.since`/`meta.since_policy` dizem o corte que valeu. */
      since?: string;
      /** Exclui valores fora da faixa plausível da medida e declara quantos saíram no meta. */
      exclude_out_of_prior?: boolean;
    },
  ): Promise<ObjectAggregateResponse>;
  rankObjects(
    params: {
      kind: string;
      fact: string;
      subkind?: string;
      measure?: "value" | "delta" | "pct_change";
      at?: string;
      from?: string;
      order?: "asc" | "desc";
      limit?: number;
      rel?: string;
      rel_to?: string;
      rel_direction?: "out" | "in";
      since?: string;
      /** Piso da data-base da ponta INICIAL, o que `since` faz pela final. Sem ele a janela pedida não é a recebida. */
      since_from?: string;
      exclude_out_of_prior?: boolean;
      /**
       * Verbo a expandir: cada linha volta com até 3 objetos ligados por ele, já com nome e
       * chave. `kind=offering&expand=issued` traz o emissor sem uma chamada por oferta.
       */
      expand?: string;
      /** De que lado está o vizinho. `in` (default) é quem APONTA para a linha. */
      expand_direction?: "out" | "in";
      /**
       * Condições sobre OUTRAS medidas: `fidc_impaired_ratio<0.05,fidc_portfolio>1000000`.
       * Confira a ESCALA da medida antes de escrever o número — `meta.applied_where` devolve a
       * unidade contra a qual cada corte foi feito, e é onde isto erra.
       */
      where?: string;
    },
  ): Promise<ObjectRankResponse>;
  /** O que ACONTECEU com o objeto: o ledger de eventos por TODOS os apelidos dele, sem contar duas vezes. */
  getObjectEvents(
    id: string,
    params?: {
      from?: string;
      to?: string;
      layer?: string;
      category?: string;
      /** `market_event` (ledger editorial) ou `renamed` (troca de código de negociação). Ausente = os dois. */
      type?: "market_event" | "renamed";
      total?: boolean;
      limit?: number;
      cursor?: string;
      resolve?: "auto" | "exact";
    },
  ): Promise<ObjectEventsResponse>;
  /** O resumo de um conjunto de relações, numa chamada — quantos, quantos distintos, extremos. */
  getObjectLinkStats(params?: {
    rel?: string;
    from_kind?: string;
    to_kind?: string;
    from_id?: string;
    to_id?: string;
    at?: string;
  }): Promise<ObjectLinkStats>;
  /** Relações no grafo inteiro, sem partir de um objeto. Para contar, prefira getObjectLinkStats. */
  listGlobalLinks(
    params?: {
    rel?: string;
    from_kind?: string;
    to_kind?: string;
    from_id?: string;
    to_id?: string;
    at?: string;
   total?: boolean; limit?: number; cursor?: string },
  ): Promise<GlobalLinksResponse>;
}

export class NotInPreviewError extends Error {
  constructor(public readonly entity: string) {
    super(`"${entity}" não está disponível na API DataBolsa atual.`);
    this.name = "NotInPreviewError";
  }
}
