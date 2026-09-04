/**
 * `@databolsa/sdk` - cliente TypeScript tipado da Serving API pública.
 *
 * Casca fina e agnóstica de runtime: o `HttpClient` implementa
 * {@link DataBolsaClient} sobre o `fetch` nativo, com Bearer opcional e
 * 501/404 mapeados para {@link NotInPreviewError}. Os tipos são gerados do
 * contrato OpenAPI.
 */

// Cliente (valor) + nome amigável p/ uso externo.
export { type ClientPlugin, type FetchLike, type PluginContext, HttpClient, HttpClient as DataBolsa } from "./http-client";
export type { HttpClientOptions } from "./http-client";

// Contrato do cliente, params de busca e a exceção de degradação.
export { NotInPreviewError } from "./client";
export type { DataBolsaClient, ScreenFiisParams } from "./client";

// Todos os tipos de domínio e de resposta derivados do schema.
export type * from "./types";

// Tipos crus do contrato (paths/operations/components), p/ quem quiser cavar.
export type { paths, components, operations } from "./schema";

// O vocabulário do grafo, gerado do manifesto de ontologia do contrato.
export { ONTOLOGY, ONTOLOGY_VERSION } from "./ontology";
export type { ObjectKind, Rel, FactName, PropertyName, FactsByKind, PropertiesByKind, Loose } from "./ontology";

// A superfície object-first: `db.objects`, os handles por tipo e os erros com contexto.
export * from "./objects";
