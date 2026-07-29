/**
 * `@databolsa/sdk` - cliente TypeScript tipado da Serving API pública.
 *
 * Casca fina e agnóstica de runtime: o `HttpClient` implementa
 * {@link DataBolsaClient} sobre o `fetch` nativo, com Bearer opcional e
 * 501/404 mapeados para {@link NotInPreviewError}. Os tipos são gerados do
 * contrato OpenAPI.
 */

// Cliente (valor) + nome amigável p/ uso externo.
export { HttpClient, HttpClient as DataBolsa } from "./http-client";
export type { HttpClientOptions } from "./http-client";

// Contrato do cliente, params de busca e a exceção de degradação.
export { NotInPreviewError } from "./client";
export type { DataBolsaClient, ScreenStocksParams, ScreenFiisParams, ScreenFundsParams } from "./client";

// Todos os tipos de domínio e de resposta derivados do schema.
export type * from "./types";

// Tipos crus do contrato (paths/operations/components), p/ quem quiser cavar.
export type { paths, components, operations } from "./schema";
