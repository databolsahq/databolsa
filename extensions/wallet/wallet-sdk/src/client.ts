/**
 * Cliente fino da API da Wallet do DataBolsa — cada método é uma operação do contrato
 * `openapi-wallet.yaml`, com request/response tipados por lookup no schema gerado
 * (openapi-typescript). Autentica com a chave de API da plataforma (`db_live_...`) ou com um
 * access token OAuth do conector (os dois vão em `Authorization: Bearer`); no workspace,
 * cookies de sessão via `credentials: "include"`.
 *
 * A carteira pertence ao WORKSPACE DA CREDENCIAL: a chave `db_live_` o fixa na emissão e o
 * access token OAuth o recebe no consentimento. O cliente não escolhe — para operar as
 * carteiras de uma organização, use uma credencial emitida nela.
 */
import type { paths } from "./schema";

type JsonOf<T> = T extends { content: { "application/json": infer J } } ? J : never;
type Ok<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends { responses: infer R }
  ? R extends { 200: infer S }
    ? JsonOf<S>
    : R extends { 201: infer S }
      ? JsonOf<S>
      : R extends { 204: unknown }
        ? void
        : never
  : never;
type Body<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends { requestBody?: infer B } ? JsonOf<NonNullable<B>> : never;
type Query<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends { parameters: { query?: infer Q } } ? NonNullable<Q> : never;

export class DataBolsaWalletError extends Error {
  constructor(
    readonly status: number,
    readonly problem: { title?: string; detail?: string; code?: string; details?: Record<string, unknown> } | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
  }
}

export interface WalletClientOptions {
  /** Origem da API (default: https://api.databolsa.com). Os paths já têm /v1. */
  baseUrl?: string;
  /** Chave `db_live_...` ou access token OAuth. Omitida no workspace (sessão via cookie). */
  apiKey?: string;
  /*
   * NÃO existe opção de workspace. Toda credencial já traz o seu — a chave `db_live_` o fixa na
   * emissão e o access token OAuth o recebe no consentimento. Deixar o cliente apontar a mesma
   * credencial para outra organização era o caminho para uma leitura ou escrita pousar no lugar
   * errado; hoje o servidor recusa (409). Para agir noutro workspace, use uma credencial dele.
   */
  credentials?: "omit" | "same-origin" | "include";
  fetch?: FetchLike;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class DataBolsaWallet {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly credentials?: "omit" | "same-origin" | "include";
  private readonly fetchImpl: FetchLike;

  constructor(opts: WalletClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://api.databolsa.com").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.credentials = opts.credentials;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, unknown>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, String(v));
    const res = await this.fetchImpl(url, {
      method,
      credentials: this.credentials,
      headers: {
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => null)) as { title?: string; detail?: string; code?: string; details?: Record<string, unknown> } | null;
      throw new DataBolsaWalletError(res.status, problem);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Seu perfil de investidor (suitability). `profile` é nulo se ainda não definido. */
  getSuitability() {
    return this.request<Ok<"/v1/suitability", "get">>("GET", "/v1/suitability");
  }

  /** Sua carteira (consolidada) */
  getPortfolio() {
    return this.request<Ok<"/v1/portfolio", "get">>("GET", "/v1/portfolio");
  }

  /** Histórico mensal consolidado */
  getPortfolioHistory() {
    return this.request<Ok<"/v1/portfolio/history", "get">>("GET", "/v1/portfolio/history");
  }

  /** Suas carteiras */
  listPortfolios() {
    return this.request<Ok<"/v1/portfolios", "get">>("GET", "/v1/portfolios");
  }

  /** Criar carteira */
  createPortfolio(body: Body<"/v1/portfolios", "post">) {
    return this.request<Ok<"/v1/portfolios", "post">>("POST", "/v1/portfolios", body);
  }

  /** Template CSV de import manual */
  getPortfolioImportTemplate() {
    return this.request<Ok<"/v1/portfolios/import-template", "get">>("GET", "/v1/portfolios/import-template");
  }

  /** Detalhe de uma carteira */
  getPortfolioDetail(id: string, query?: Query<"/v1/portfolios/{id}", "get">) {
    return this.request<Ok<"/v1/portfolios/{id}", "get">>("GET", `/v1/portfolios/${enc(id)}`, undefined, query);
  }

  /** Editar carteira */
  updatePortfolio(id: string, body: Body<"/v1/portfolios/{id}", "patch">) {
    return this.request<Ok<"/v1/portfolios/{id}", "patch">>("PATCH", `/v1/portfolios/${enc(id)}`, body);
  }

  /** Apagar carteira */
  deletePortfolio(id: string) {
    return this.request<Ok<"/v1/portfolios/{id}", "delete">>("DELETE", `/v1/portfolios/${enc(id)}`);
  }

  /** Histórico mensal de uma carteira */
  getPortfolioHistoryById(id: string) {
    return this.request<Ok<"/v1/portfolios/{id}/history", "get">>("GET", `/v1/portfolios/${enc(id)}/history`);
  }

  /** Raio-X de concentração da carteira */
  getPortfolioXray(id: string) {
    return this.request<Ok<"/v1/portfolios/{id}/xray", "get">>("GET", `/v1/portfolios/${enc(id)}/xray`);
  }

  /** Raio-X de custos recorrentes da carteira */
  getPortfolioCosts(id: string) {
    return this.request<Ok<"/v1/portfolios/{id}/costs", "get">>("GET", `/v1/portfolios/${enc(id)}/costs`);
  }

  /** Exposição efetiva (abre as posições em fundos) */
  getPortfolioLookThrough(id: string) {
    return this.request<Ok<"/v1/portfolios/{id}/look-through", "get">>("GET", `/v1/portfolios/${enc(id)}/look-through`);
  }

  /** Adicionar ativo à carteira */
  addPortfolioAsset(id: string, body: Body<"/v1/portfolios/{id}/assets", "post">) {
    return this.request<Ok<"/v1/portfolios/{id}/assets", "post">>("POST", `/v1/portfolios/${enc(id)}/assets`, body);
  }

  /** Remover ativo da carteira */
  removePortfolioAsset(id: string, query?: Query<"/v1/portfolios/{id}/assets", "delete">) {
    return this.request<Ok<"/v1/portfolios/{id}/assets", "delete">>("DELETE", `/v1/portfolios/${enc(id)}/assets`, undefined, query);
  }

  /** Taxa contratada de renda fixa */
  updatePortfolioAsset(id: string, body: Body<"/v1/portfolios/{id}/assets", "patch">, query?: Query<"/v1/portfolios/{id}/assets", "patch">) {
    return this.request<Ok<"/v1/portfolios/{id}/assets", "patch">>("PATCH", `/v1/portfolios/${enc(id)}/assets`, body, query);
  }

  /** Ledger de um ativo */
  listPortfolioTransactions(id: string, query?: Query<"/v1/portfolios/{id}/transactions", "get">) {
    return this.request<Ok<"/v1/portfolios/{id}/transactions", "get">>("GET", `/v1/portfolios/${enc(id)}/transactions`, undefined, query);
  }

  /** Lançar transação */
  addPortfolioTransaction(id: string, body: Body<"/v1/portfolios/{id}/transactions", "post">) {
    return this.request<Ok<"/v1/portfolios/{id}/transactions", "post">>("POST", `/v1/portfolios/${enc(id)}/transactions`, body);
  }

  /** Editar transação */
  updatePortfolioTransaction(id: string, txId: string, body: Body<"/v1/portfolios/{id}/transactions/{txId}", "patch">) {
    return this.request<Ok<"/v1/portfolios/{id}/transactions/{txId}", "patch">>("PATCH", `/v1/portfolios/${enc(id)}/transactions/${enc(txId)}`, body);
  }

  /** Remover transação */
  deletePortfolioTransaction(id: string, txId: string) {
    return this.request<Ok<"/v1/portfolios/{id}/transactions/{txId}", "delete">>("DELETE", `/v1/portfolios/${enc(id)}/transactions/${enc(txId)}`);
  }

  /** Importar planilha (B3 ou template manual) */
  importPortfolioFile(id: string, body: Body<"/v1/portfolios/{id}/imports", "post">) {
    return this.request<Ok<"/v1/portfolios/{id}/imports", "post">>("POST", `/v1/portfolios/${enc(id)}/imports`, body);
  }

  /** Histórico de imports */
  listPortfolioImports(id: string) {
    return this.request<Ok<"/v1/portfolios/{id}/imports", "get">>("GET", `/v1/portfolios/${enc(id)}/imports`);
  }

  /** Linhas de um import */
  listPortfolioImportRows(id: string, importId: string, query?: Query<"/v1/portfolios/{id}/imports/{importId}/rows", "get">) {
    return this.request<Ok<"/v1/portfolios/{id}/imports/{importId}/rows", "get">>("GET", `/v1/portfolios/${enc(id)}/imports/${enc(importId)}/rows`, undefined, query);
  }

  /** Reconciliar posição à B3 */
  reconcilePortfolioAsset(id: string, body: Body<"/v1/portfolios/{id}/reconcile", "post">) {
    return this.request<Ok<"/v1/portfolios/{id}/reconcile", "post">>("POST", `/v1/portfolios/${enc(id)}/reconcile`, body);
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
