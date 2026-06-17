import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { PUBLIC_API_URL } from "../lib/config";

export type ProblemStatus = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 501;

const PROBLEM_BASE = `${PUBLIC_API_URL}/problems`;

// Errors are emitted as RFC 9457 application/problem+json (the OpenAPI contract's
// error format): { type, title, status, detail, instance }.
export class ApiError extends Error {
  constructor(
    public readonly status: ProblemStatus,
    public readonly title: string,
    public readonly detail?: string,
    public readonly type: string = "about:blank",
  ) {
    super(detail ?? title);
    this.name = "ApiError";
  }
}

export class BadRequestError extends ApiError {
  constructor(detail?: string) {
    super(400, "Requisição inválida", detail, `${PROBLEM_BASE}/bad-request`);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(detail?: string) {
    super(401, "Não autorizado", detail, `${PROBLEM_BASE}/unauthorized`);
  }
}

export class NotFoundError extends ApiError {
  constructor(detail?: string) {
    super(404, "Recurso não encontrado", detail, `${PROBLEM_BASE}/not-found`);
  }
}

export class NotImplementedError extends ApiError {
  constructor(detail?: string) {
    super(501, "Não implementado", detail, `${PROBLEM_BASE}/not-implemented`);
  }
}

function problem(
  c: Context,
  status: ProblemStatus,
  title: string,
  detail?: string,
  type = "about:blank",
): Response {
  const headers: Record<string, string> = {
    "content-type": "application/problem+json; charset=UTF-8",
  };
  if (status === 401) headers["www-authenticate"] = "Bearer";
  const body = JSON.stringify({ type, title, status, detail, instance: c.req.path });
  return new Response(body, { status, headers });
}

export function errorHandler(err: Error, c: Context): Response {
  if (err instanceof ApiError) {
    return problem(c, err.status, err.title, err.detail, err.type);
  }
  if (err instanceof HTTPException) {
    return problem(c, err.status as ProblemStatus, "Requisição inválida", err.message || undefined);
  }
  console.error("[databolsa-api] unhandled error:", err);
  return problem(c, 500, "Erro interno do servidor");
}

// Unmatched routes. A path under /v1 looks like an API call that isn't served yet -> 501.
// The spec is code-first: api/openapi.yaml lists only what is implemented. Anything
// else is a genuine 404. Either way the body is problem+json, so no route falls
// through to Hono's text/plain default.
export function notFoundHandler(c: Context): Response {
  if (c.req.path.startsWith("/v1/")) {
    return problem(
      c,
      501,
      "Não implementado",
      `${c.req.method} ${c.req.path} não está implementado nesta versão. Consulte GET /openapi.json para os endpoints servidos.`,
      `${PROBLEM_BASE}/not-implemented`,
    );
  }
  return problem(
    c,
    404,
    "Recurso não encontrado",
    `Rota não encontrada: ${c.req.method} ${c.req.path}`,
    `${PROBLEM_BASE}/not-found`,
  );
}
