import path from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../../package.json";

// Versão única do monorepo — vem do package.json deste pacote (todos os pacotes
// compartilham a mesma versão; use `bun run bump` para subir). Surge no documento
// OpenAPI, no `/` e no /health.
export const VERSION = pkg.version;

// License surfaced in generated API metadata. Keep this configurable while the
// public/private split and final OSS license are being settled.
export const LICENSE = process.env.DATABOLSA_CORE_LICENSE?.trim() || process.env.LICENSE?.trim() || "Apache-2.0";

// Raiz do data lake. Mesma variável que o ingest (Python) usa, para os dois
// lados concordarem; senão resolve a raiz do repo a partir deste arquivo
// (packages/api/src/lib -> ../../../../ = repo) + /data.
const here = path.dirname(fileURLToPath(import.meta.url));

export const DATA_ROOT =
  process.env.DATABOLSA_DATA_ROOT?.trim() || path.resolve(here, "../../../../data");

// Ledger append-only de execuções do ingest (escrito por `databolsa-ingest run`).
export const RUNS_DIR = path.join(DATA_ROOT, "_runs");

// Origem pública da API — usada no documento OpenAPI (server) e na base dos
// `type` dos problemas RFC 9457. Sem barra final. Defina PUBLIC_API_URL no deploy.
export const PUBLIC_API_URL =
  process.env.PUBLIC_API_URL?.trim().replace(/\/+$/, "") || "https://api.databolsa.com";
