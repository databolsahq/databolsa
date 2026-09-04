/**
 * Cliente fino da API do DataBolsa Advisor — cada método é uma operação do contrato,
 * com request/response tipados por lookup no schema gerado (openapi-typescript).
 * Autentica com a chave pessoal do membro (`db_live_...`); no portal, cookies de sessão
 * via `credentials: "include"`.
 *
 * A API age na organização DA CREDENCIAL, fixada quando a chave foi emitida. Não há como
 * apontar a mesma chave para outro escritório: emita uma chave dentro dele.
 */
import type { paths } from "./schema";

type JsonOf<T> = T extends { content: { "application/json": infer J } } ? J : never;
type Ok<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: infer R;
}
  ? R extends { 200: infer S }
    ? JsonOf<S>
    : never
  : never;
type Body<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer B;
}
  ? JsonOf<NonNullable<B>>
  : never;

export class DataBolsaAdvisorError extends Error {
  constructor(
    readonly status: number,
    readonly problem: { title?: string; detail?: string; code?: string } | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
  }
}

export interface AdvisorClientOptions {
  /** Origem da API (default: https://api.databolsa.com). Os paths já têm /v1/advisor. */
  baseUrl?: string;
  /** Chave pessoal `db_live_...`. Omitida no portal (sessão via cookie). */
  apiKey?: string;
  /*
   * NÃO existe opção de workspace. Toda credencial já traz o seu — a chave `db_live_` o fixa na
   * emissão e o access token OAuth o recebe no consentimento. Deixar o cliente apontar a mesma
   * credencial para outra organização era o caminho para uma leitura ou escrita pousar no lugar
   * errado; hoje o servidor recusa (409). Para agir noutro workspace, use uma credencial dele.
   */
  /** `include` no portal (cookie de sessão same-origin). */
  credentials?: "omit" | "same-origin" | "include";
  fetch?: typeof fetch;
}

export class DataBolsaAdvisor {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly credentials?: "omit" | "same-origin" | "include";
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AdvisorClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://api.databolsa.com").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.credentials = opts.credentials;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | undefined>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) if (v != null) url.searchParams.set(k, v);
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
      const problem = (await res.json().catch(() => null)) as {
        title?: string;
        detail?: string;
        code?: string;
      } | null;
      throw new DataBolsaAdvisorError(res.status, problem);
    }
    return (await res.json()) as T;
  }

  /* --------------------------------- conta --------------------------------- */

  getMe() {
    return this.request<Ok<"/v1/advisor/me", "get">>("GET", "/v1/advisor/me");
  }

  acceptInvitation(body: Body<"/v1/advisor/invitations/accept", "post">) {
    return this.request<Ok<"/v1/advisor/invitations/accept", "post">>("POST", "/v1/advisor/invitations/accept", body);
  }

  /* ------------------------------ organização ------------------------------ */

  getOrganization(org: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}", "get">>("GET", `/v1/advisor/orgs/${enc(org)}`);
  }

  updateOrganization(org: string, body: Body<"/v1/advisor/orgs/{org}", "patch">) {
    return this.request<Ok<"/v1/advisor/orgs/{org}", "patch">>("PATCH", `/v1/advisor/orgs/${enc(org)}`, body);
  }

  getLicense(org: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/license", "get">>("GET", `/v1/advisor/orgs/${enc(org)}/license`);
  }

  listMembers(org: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/members", "get">>("GET", `/v1/advisor/orgs/${enc(org)}/members`);
  }

  updateMember(org: string, memberId: string, body: Body<"/v1/advisor/orgs/{org}/members/{memberId}", "patch">) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/members/{memberId}", "patch">>(
      "PATCH",
      `/v1/advisor/orgs/${enc(org)}/members/${enc(memberId)}`,
      body,
    );
  }

  listInvitations(org: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/invitations", "get">>(
      "GET",
      `/v1/advisor/orgs/${enc(org)}/invitations`,
    );
  }

  createInvitation(org: string, body: Body<"/v1/advisor/orgs/{org}/invitations", "post">) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/invitations", "post">>(
      "POST",
      `/v1/advisor/orgs/${enc(org)}/invitations`,
      body,
    );
  }

  revokeInvitation(org: string, invitationId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/invitations/{invitationId}", "delete">>(
      "DELETE",
      `/v1/advisor/orgs/${enc(org)}/invitations/${enc(invitationId)}`,
    );
  }

  /* -------------------------------- clientes -------------------------------- */

  listFamilies(org: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/families", "get">>("GET", `/v1/advisor/orgs/${enc(org)}/families`);
  }

  createFamily(org: string, body: Body<"/v1/advisor/orgs/{org}/families", "post">) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/families", "post">>(
      "POST",
      `/v1/advisor/orgs/${enc(org)}/families`,
      body,
    );
  }

  listClients(org: string, params?: { status?: string; familyId?: string }) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients", "get">>(
      "GET",
      `/v1/advisor/orgs/${enc(org)}/clients`,
      undefined,
      { status: params?.status, family_id: params?.familyId },
    );
  }

  createClient(org: string, body: Body<"/v1/advisor/orgs/{org}/clients", "post">) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients", "post">>(
      "POST",
      `/v1/advisor/orgs/${enc(org)}/clients`,
      body,
    );
  }

  getClient(org: string, clientId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients/{clientId}", "get">>(
      "GET",
      `/v1/advisor/orgs/${enc(org)}/clients/${enc(clientId)}`,
    );
  }

  updateClient(org: string, clientId: string, body: Body<"/v1/advisor/orgs/{org}/clients/{clientId}", "patch">) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients/{clientId}", "patch">>(
      "PATCH",
      `/v1/advisor/orgs/${enc(org)}/clients/${enc(clientId)}`,
      body,
    );
  }

  setClientAssignment(
    org: string,
    clientId: string,
    body: Body<"/v1/advisor/orgs/{org}/clients/{clientId}/assignment", "put">,
  ) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients/{clientId}/assignment", "put">>(
      "PUT",
      `/v1/advisor/orgs/${enc(org)}/clients/${enc(clientId)}/assignment`,
      body,
    );
  }

  updateClientProfile(
    org: string,
    clientId: string,
    body: Body<"/v1/advisor/orgs/{org}/clients/{clientId}/profile", "put">,
  ) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients/{clientId}/profile", "put">>(
      "PUT",
      `/v1/advisor/orgs/${enc(org)}/clients/${enc(clientId)}/profile`,
      body,
    );
  }

  /* -------------------------------- carteiras -------------------------------- */

  listClientPortfolios(org: string, clientId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients/{clientId}/portfolios", "get">>(
      "GET",
      `/v1/advisor/orgs/${enc(org)}/clients/${enc(clientId)}/portfolios`,
    );
  }

  createClientPortfolio(
    org: string,
    clientId: string,
    body: Body<"/v1/advisor/orgs/{org}/clients/{clientId}/portfolios", "post">,
  ) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/clients/{clientId}/portfolios", "post">>(
      "POST",
      `/v1/advisor/orgs/${enc(org)}/clients/${enc(clientId)}/portfolios`,
      body,
    );
  }

  getPortfolio(org: string, portfolioId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}", "get">>(
      "GET",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}`,
    );
  }

  deletePortfolio(org: string, portfolioId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}", "delete">>(
      "DELETE",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}`,
    );
  }

  getPortfolioLedger(org: string, portfolioId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/ledger", "get">>(
      "GET",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}/ledger`,
    );
  }

  addPortfolioAsset(
    org: string,
    portfolioId: string,
    body: Body<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/assets", "post">,
  ) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/assets", "post">>(
      "POST",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}/assets`,
      body,
    );
  }

  removePortfolioAsset(org: string, portfolioId: string, assetId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/assets/{assetId}", "delete">>(
      "DELETE",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}/assets/${enc(assetId)}`,
    );
  }

  addPortfolioTransaction(
    org: string,
    portfolioId: string,
    assetId: string,
    body: Body<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/assets/{assetId}/transactions", "post">,
  ) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/assets/{assetId}/transactions", "post">>(
      "POST",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}/assets/${enc(assetId)}/transactions`,
      body,
    );
  }

  deletePortfolioTransaction(org: string, portfolioId: string, txId: string) {
    return this.request<Ok<"/v1/advisor/orgs/{org}/portfolios/{portfolioId}/transactions/{txId}", "delete">>(
      "DELETE",
      `/v1/advisor/orgs/${enc(org)}/portfolios/${enc(portfolioId)}/transactions/${enc(txId)}`,
    );
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
