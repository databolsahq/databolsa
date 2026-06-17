import { problem } from "@databolsa/contract";
import type { OpenApiSpecsOptions } from "hono-openapi";
import { resolver } from "hono-openapi/zod";
import type { ZodSchema } from "zod";
import { LICENSE, PUBLIC_API_URL, VERSION } from "./config";

// Top-level OpenAPI metadata, shared by the served /openapi.json route (app.ts) and the
// `gen:openapi` script that writes api/openapi.yaml — one source so they never diverge.
// Paths/schemas come from the routes themselves (describeRoute + the zod validators).
export const openApiDocumentation = {
  openapi: "3.1.0",
  info: {
    title: "DataBolsa API",
    version: VERSION,
    description: [
      "API aberta de dados do mercado financeiro brasileiro.",
      "",
      "Convenções:",
      "- Datas em ISO 8601; valores monetários em BRL salvo campo `currency`.",
      "- Preços de ações **ajustados por proventos por default** (`adjusted=true`).",
      "- Indicadores fundamentalistas **TTM por default**, de demonstrações consolidadas.",
      "- Paginação por cursor: `?cursor=&limit=`; envelope `{ data, meta: { next_cursor, count } }`.",
      "- Erros seguem RFC 9457 (`application/problem+json`).",
      "- Toda métrica é rastreável à fonte primária (campo `lineage`).",
    ].join("\n"),
    contact: { name: "DataBolsa" },
    license: { name: LICENSE },
  },
  // Bare origin — the route paths already carry the `/v1` prefix (routes are mounted
  // at /v1 in app.ts), so including it here too would make generated clients call
  // /v1/v1/....
  servers: [
    { url: PUBLIC_API_URL, description: "Produção" },
    { url: "http://localhost:8080", description: "Self-hosted" },
  ],
  security: [{ bearerApiKey: [] }],
  components: {
    securitySchemes: {
      bearerApiKey: { type: "http", scheme: "bearer" },
    },
  },
  tags: [
    { name: "Companies", description: "Companhias abertas (cadastro CVM) e demonstrações" },
    { name: "Stocks", description: "Ações — cotações, indicadores, proventos e eventos" },
    { name: "FIIs", description: "Fundos imobiliários — indicadores e distribuições" },
    { name: "Bonds", description: "Títulos públicos (Tesouro Direto) e curvas de juros" },
    { name: "Crypto", description: "Criptoativos em BRL" },
    { name: "Indices", description: "Índices da B3 (IBOV, IFIX, ...) e composições" },
    { name: "BDR", description: "BDRs (recibos de ações estrangeiras) — catálogo e cotações" },
    { name: "Options", description: "Opções sobre ações — cadeia vigente e histórico EOD" },
    { name: "Macro", description: "Séries macroeconômicas, expectativas Focus e regime" },
    { name: "Screener", description: "Filtros multi-critério sobre ações e FIIs" },
    { name: "System", description: "Saúde e metadados da API" },
  ],
} satisfies OpenApiSpecsOptions["documentation"];

// describeRoute helpers — keep the route chains terse. `ok(schema)` builds the 200 body
// plus a shared RFC 9457 error response so every documented route advertises both.
const problemResponse = {
  description: "Erro (RFC 9457 application/problem+json)",
  content: { "application/problem+json": { schema: resolver(problem) } },
};

export const jsonContent = (schema: ZodSchema) => ({
  content: { "application/json": { schema: resolver(schema) } },
});

export const ok = (schema: ZodSchema, description = "OK") => ({
  200: { description, ...jsonContent(schema) },
  default: problemResponse,
});

// For endpoints that only ever error (e.g. a not-yet-available resource).
export const errorOnly = { default: problemResponse };
