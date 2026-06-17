// @databolsa/contract — Zod schemas shared across api (validation + OpenAPI), web, cli,
// mcp. Importing this barrel pulls `zod-openapi/extend` (via ./zod), so `.openapi()`
// metadata is available to every consumer.
export { z } from "./zod";

export * from "./schemas/pagination";
export * from "./schemas/common";
export * from "./schemas/company";
export * from "./schemas/stock";
export * from "./schemas/screener";
export * from "./schemas/fii";
export * from "./schemas/macro";
export * from "./schemas/bonds";
export * from "./schemas/markets";
export * from "./schemas/bdr";
export * from "./schemas/options";
export * from "./schemas/system";
