# DataBolsa

[![CI](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml/badge.svg)](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/databolsahq/databolsa?label=release&color=2ea44f)](https://github.com/databolsahq/databolsa/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-2ea44f)](LICENSE)

[![@databolsa/sdk](https://img.shields.io/npm/v/@databolsa/sdk?label=%40databolsa%2Fsdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/sdk)
[![@databolsa/cli](https://img.shields.io/npm/v/@databolsa/cli?label=%40databolsa%2Fcli&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/cli)
[![@databolsa/mcp](https://img.shields.io/npm/v/@databolsa/mcp?label=%40databolsa%2Fmcp&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/mcp)

🌐 **[databolsa.com](https://databolsa.com)** — a plataforma ao vivo · [referência da API](https://databolsa.com/docs)

Motor de dados open source para o mercado financeiro brasileiro: ingestão
idempotente, um warehouse dbt sobre um lake Parquet, um schema Postgres de
serving e uma API HTTP tipada — além de um SDK, uma CLI e um servidor MCP por
cima de tudo isso.

Licenciado sob **Apache-2.0**.

## Pacotes

| Pacote | O que é |
| --- | --- |
| `packages/ingest` | Conectores de fontes (B3, CVM, BCB, FRED, IBGE, Tesouro, cripto…) — extratores Polars + httpx que escrevem o lake Parquet bruto. |
| `packages/warehouse` | Camada de transformação dbt-core + DuckDB: staging → intermediate → marts (Parquet externo). |
| `packages/db` | Schema Drizzle ORM que espelha os marts no Postgres (TimescaleDB + pgvector). |
| `packages/contract` | Schemas Zod + OpenAPI compartilhados entre API, SDK, CLI e MCP. |
| `packages/api` | Servidor REST Hono (RFC 9457, paginação por cursor) sobre os marts. Auth plugável: aberta / Bearer key / gateway-trust. |
| `packages/sdk` | Cliente TypeScript tipado (fetch nativo); tipos gerados do contrato OpenAPI. |
| `packages/cli` | CLI sobre a serving API — um subcomando por operação do contrato. |
| `packages/mcp` | Servidor Model Context Protocol que expõe os dados como ferramentas para agentes. |

O contrato OpenAPI fica em `api/openapi.yaml`.

## Início rápido

```bash
cp .env.example .env
bun install

# sobe o DB de serving + cache
docker compose up -d db redis

# faz a ingestão do lake, constrói o warehouse e carrega os marts no Postgres
bun run ingest
bun run warehouse:build
bun run db:load

# sobe a API
bun run api:dev          # http://localhost:8080
```

Checagem de tipos de tudo: `bun run typecheck`.

## Contribuindo

Veja o [CONTRIBUTING.md](./CONTRIBUTING.md). Issues e pull requests são bem-vindos.
