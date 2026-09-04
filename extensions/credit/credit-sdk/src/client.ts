/**
 * Cliente fino da API da mesa de crédito do DataBolsa — cada método é uma operação do
 * contrato, com request/response tipados por lookup no schema gerado (openapi-typescript).
 * Autentica com a chave pessoal do membro (`db_live_...`); no portal da mesa, cookies de
 * sessão via `credentials: "include"`.
 *
 * A API age na mesa DA CREDENCIAL, fixada quando a chave foi emitida. Não há como apontar a
 * mesma chave para outra mesa: emita uma chave dentro dela.
 */
import type { paths } from "./schema";

type JsonOf<T> = T extends { content: { "application/json": infer J } } ? J : never;
/**
 * Resposta de sucesso da operação. As criações do contrato respondem 201 (convite,
 * watchlist, nota, regra de alerta, limiar proposto) — o lookup cai no 201 quando não
 * existe 200, em vez de degradar para `never` em silêncio.
 */
type Ok<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  responses: infer R;
}
  ? R extends { 200: infer S }
    ? JsonOf<S>
    : R extends { 201: infer S }
      ? JsonOf<S>
      : never
  : never;
type Body<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
  requestBody?: infer B;
}
  ? JsonOf<NonNullable<B>>
  : never;

export class DataBolsaCreditError extends Error {
  constructor(
    readonly status: number,
    readonly problem: { title?: string; detail?: string; code?: string } | null,
  ) {
    super(problem?.detail ?? problem?.title ?? `HTTP ${status}`);
  }
}

export interface CreditClientOptions {
  /** Origem da API (default: https://api.databolsa.com). Os paths já têm /v1/desk. */
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

export class DataBolsaCredit {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly credentials?: "omit" | "same-origin" | "include";
  private readonly fetchImpl: typeof fetch;

  constructor(opts: CreditClientOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? "https://api.databolsa.com").replace(/\/+$/, "");
    this.apiKey = opts.apiKey;
    this.credentials = opts.credentials;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
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
      const problem = (await res.json().catch(() => null)) as {
        title?: string;
        detail?: string;
        code?: string;
      } | null;
      throw new DataBolsaCreditError(res.status, problem);
    }
    return (await res.json()) as T;
  }

  /* --------------------------------- conta --------------------------------- */

  getMe() {
    return this.request<Ok<"/v1/desk/me", "get">>("GET", "/v1/desk/me");
  }

  acceptInvitation(body: Body<"/v1/desk/invitations/accept", "post">) {
    return this.request<Ok<"/v1/desk/invitations/accept", "post">>("POST", "/v1/desk/invitations/accept", body);
  }

  /* ---------------------------------- mesa ---------------------------------- */

  getOrganization(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}", "get">>("GET", `/v1/desk/orgs/${enc(org)}`);
  }

  updateOrganization(org: string, body: Body<"/v1/desk/orgs/{org}", "patch">) {
    return this.request<Ok<"/v1/desk/orgs/{org}", "patch">>("PATCH", `/v1/desk/orgs/${enc(org)}`, body);
  }

  getLicense(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/license", "get">>("GET", `/v1/desk/orgs/${enc(org)}/license`);
  }

  listMembers(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/members", "get">>("GET", `/v1/desk/orgs/${enc(org)}/members`);
  }

  assignSeat(org: string, body: Body<"/v1/desk/orgs/{org}/members", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/members", "post">>("POST", `/v1/desk/orgs/${enc(org)}/members`, body);
  }

  updateMember(org: string, memberId: string, body: Body<"/v1/desk/orgs/{org}/members/{memberId}", "patch">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/members/{memberId}", "patch">>(
      "PATCH",
      `/v1/desk/orgs/${enc(org)}/members/${enc(memberId)}`,
      body,
    );
  }

  listInvitations(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/invitations", "get">>("GET", `/v1/desk/orgs/${enc(org)}/invitations`);
  }

  createInvitation(org: string, body: Body<"/v1/desk/orgs/{org}/invitations", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/invitations", "post">>(
      "POST",
      `/v1/desk/orgs/${enc(org)}/invitations`,
      body,
    );
  }

  revokeInvitation(org: string, invitationId: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/invitations/{invitationId}", "delete">>(
      "DELETE",
      `/v1/desk/orgs/${enc(org)}/invitations/${enc(invitationId)}`,
    );
  }

  listAudit(org: string, params?: { entityId?: string; cursor?: string; limit?: number }) {
    return this.request<Ok<"/v1/desk/orgs/{org}/audit", "get">>(
      "GET",
      `/v1/desk/orgs/${enc(org)}/audit`,
      undefined,
      { entity_id: params?.entityId, cursor: params?.cursor, limit: params?.limit },
    );
  }

  /* ------------------------------- watchlists ------------------------------- */

  listWatchlists(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists", "get">>("GET", `/v1/desk/orgs/${enc(org)}/watchlists`);
  }

  createWatchlist(org: string, body: Body<"/v1/desk/orgs/{org}/watchlists", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists", "post">>(
      "POST",
      `/v1/desk/orgs/${enc(org)}/watchlists`,
      body,
    );
  }

  deleteWatchlist(org: string, list: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists/{list}", "delete">>(
      "DELETE",
      `/v1/desk/orgs/${enc(org)}/watchlists/${enc(list)}`,
    );
  }

  listWatchlistItems(org: string, list: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists/{list}/items", "get">>(
      "GET",
      `/v1/desk/orgs/${enc(org)}/watchlists/${enc(list)}/items`,
    );
  }

  addWatchlistItems(org: string, list: string, body: Body<"/v1/desk/orgs/{org}/watchlists/{list}/items", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists/{list}/items", "post">>(
      "POST",
      `/v1/desk/orgs/${enc(org)}/watchlists/${enc(list)}/items`,
      body,
    );
  }

  removeWatchlistItem(org: string, list: string, cnpj: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists/{list}/items/{cnpj}", "delete">>(
      "DELETE",
      `/v1/desk/orgs/${enc(org)}/watchlists/${enc(list)}/items/${enc(cnpj)}`,
    );
  }

  getWatchlistBoard(org: string, list: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists/{list}/board", "get">>(
      "GET",
      `/v1/desk/orgs/${enc(org)}/watchlists/${enc(list)}/board`,
    );
  }

  /* ---------------------------------- grade ---------------------------------- */

  getGrid(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/grid", "get">>("GET", `/v1/desk/orgs/${enc(org)}/grid`);
  }

  setGrid(org: string, body: Body<"/v1/desk/orgs/{org}/grid", "put">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/grid", "put">>("PUT", `/v1/desk/orgs/${enc(org)}/grid`, body);
  }

  /* --------------------------------- alertas --------------------------------- */

  listAlerts(org: string, list: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/watchlists/{list}/alerts", "get">>(
      "GET",
      `/v1/desk/orgs/${enc(org)}/watchlists/${enc(list)}/alerts`,
    );
  }

  listAlertHistory(
    org: string,
    params?: { cnpj?: string; source?: "covenant" | "rule" | "reporting"; since?: string; limit?: number },
  ) {
    return this.request<Ok<"/v1/desk/orgs/{org}/alert-history", "get">>(
      "GET",
      `/v1/desk/orgs/${enc(org)}/alert-history`,
      undefined,
      { cnpj: params?.cnpj, source: params?.source, since: params?.since, limit: params?.limit },
    );
  }

  acknowledgeAlert(org: string, key: string, body: Body<"/v1/desk/orgs/{org}/alerts/{key}/ack", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/alerts/{key}/ack", "post">>(
      "POST",
      `/v1/desk/orgs/${enc(org)}/alerts/${enc(key)}/ack`,
      body,
    );
  }

  listAlertRules(org: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/alert-rules", "get">>("GET", `/v1/desk/orgs/${enc(org)}/alert-rules`);
  }

  upsertAlertRule(org: string, body: Body<"/v1/desk/orgs/{org}/alert-rules", "put">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/alert-rules", "put">>(
      "PUT",
      `/v1/desk/orgs/${enc(org)}/alert-rules`,
      body,
    );
  }

  deleteAlertRule(org: string, ruleId: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/alert-rules/{ruleId}", "delete">>(
      "DELETE",
      `/v1/desk/orgs/${enc(org)}/alert-rules/${enc(ruleId)}`,
    );
  }

  /* ---------------------------------- notas ---------------------------------- */

  listNotes(org: string, params?: { entityId?: string; limit?: number }) {
    return this.request<Ok<"/v1/desk/orgs/{org}/notes", "get">>("GET", `/v1/desk/orgs/${enc(org)}/notes`, undefined, {
      entity_id: params?.entityId,
      limit: params?.limit,
    });
  }

  createNote(org: string, body: Body<"/v1/desk/orgs/{org}/notes", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/notes", "post">>("POST", `/v1/desk/orgs/${enc(org)}/notes`, body);
  }

  deleteNote(org: string, noteId: string) {
    return this.request<Ok<"/v1/desk/orgs/{org}/notes/{noteId}", "delete">>(
      "DELETE",
      `/v1/desk/orgs/${enc(org)}/notes/${enc(noteId)}`,
    );
  }

  /* --------------------------- limiares do regulamento --------------------------- */

  listRegulationTerms(
    org: string,
    cnpj: string,
    params?: { includeHistory?: boolean; status?: "pending" | "confirmed" | "rejected" },
  ) {
    return this.request<Ok<"/v1/desk/orgs/{org}/classes/{cnpj}/terms", "get">>(
      "GET",
      `/v1/desk/orgs/${enc(org)}/classes/${enc(cnpj)}/terms`,
      undefined,
      { include_history: params?.includeHistory, status: params?.status },
    );
  }

  proposeRegulationTerm(org: string, cnpj: string, body: Body<"/v1/desk/orgs/{org}/classes/{cnpj}/terms", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/classes/{cnpj}/terms", "post">>(
      "POST",
      `/v1/desk/orgs/${enc(org)}/classes/${enc(cnpj)}/terms`,
      body,
    );
  }

  listOrgRegulationTerms(org: string, params?: { status?: "pending" | "confirmed" | "rejected"; limit?: number }) {
    return this.request<Ok<"/v1/desk/orgs/{org}/terms", "get">>("GET", `/v1/desk/orgs/${enc(org)}/terms`, undefined, {
      status: params?.status,
      limit: params?.limit,
    });
  }

  reviewRegulationTerm(org: string, termId: string, body: Body<"/v1/desk/orgs/{org}/terms/{termId}/review", "post">) {
    return this.request<Ok<"/v1/desk/orgs/{org}/terms/{termId}/review", "post">>(
      "POST",
      `/v1/desk/orgs/${enc(org)}/terms/${enc(termId)}/review`,
      body,
    );
  }
}

function enc(segment: string): string {
  return encodeURIComponent(segment);
}
