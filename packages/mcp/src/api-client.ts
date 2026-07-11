/**
 * Cliente HTTP mínimo para a Serving API do DataBolsa.
 *
 * Espelha o padrão de `@databolsa/sdk`: Bearer opcional,
 * parsing de `application/problem+json` e degradação graciosa de 501/404
 * ("fora do preview"). A API não mantém dados de usuário. Base URL e chave
 * vêm do ambiente.
 */

export interface ApiClientOptions {
  /** Origem da API (com ou sem sufixo `/v1`). Default: https://api.databolsa.com */
  baseUrl?: string;
  /** Token bearer opcional (DATABOLSA_API_KEY). */
  apiKey?: string | null;
  /** Headers extras enviados em toda requisição (ex.: atrás de um proxy). */
  headers?: Record<string, string>;
}

export interface ApiResult {
  ok: boolean;
  status: number;
  /** corpo já parseado (JSON) quando houver; senão texto cru. */
  body: unknown;
  /** detalhe legível de problem+json quando o status for de erro. */
  detail?: string;
}

const DEFAULT_BASE = "https://api.databolsa.com";

export class ApiClient {
  /** origem normalizada terminando exatamente em `/v1`. */
  private readonly base: string;
  private readonly apiKey: string | null;
  private readonly extraHeaders: Record<string, string>;

  constructor(opts: ApiClientOptions = {}) {
    const raw = (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, "");
    this.base = raw.endsWith("/v1") ? raw : `${raw}/v1`;
    this.apiKey = opts.apiKey ?? null;
    this.extraHeaders = opts.headers ?? {};
  }

  /** Origem sem o sufixo `/v1` — usada para buscar `/openapi.json`. */
  get origin(): string {
    return this.base.replace(/\/v1$/, "");
  }

  /**
   * GET em um path do contrato. `path` pode vir com ou sem o prefixo `/v1`
   * (as chaves do OpenAPI usam `/v1`); normalizamos para não duplicar.
   */
  async get(path: string, query?: Record<string, unknown>): Promise<ApiResult> {
    const rel = path.replace(/^\/v1/, "");
    const url = new URL(this.base + rel);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { accept: "application/json", ...this.extraHeaders };
    if (this.apiKey) headers.authorization = `Bearer ${this.apiKey}`;

    const res = await fetch(url, { headers });
    const text = await res.text();
    let body: unknown = text;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        // mantém texto cru
      }
    } else {
      body = null;
    }

    if (res.ok) return { ok: true, status: res.status, body };
    return { ok: false, status: res.status, body, detail: problemDetail(body) ?? `HTTP ${res.status}` };
  }

  /** Busca o spec OpenAPI vivo (JSON) servido pela API. */
  async fetchOpenApi(): Promise<unknown> {
    const res = await fetch(`${this.origin}/openapi.json`, {
      headers: { accept: "application/json", ...this.extraHeaders },
    });
    if (!res.ok) throw new Error(`GET ${this.origin}/openapi.json → HTTP ${res.status}`);
    return res.json();
  }
}

function problemDetail(body: unknown): string | null {
  if (body && typeof body === "object") {
    const b = body as { detail?: unknown; title?: unknown };
    if (typeof b.detail === "string") return b.detail;
    if (typeof b.title === "string") return b.title;
  }
  return null;
}
