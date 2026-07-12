# DataBolsa

[![CI](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml/badge.svg)](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/databolsahq/databolsa?label=release&color=2ea44f)](https://github.com/databolsahq/databolsa/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-2ea44f)](LICENSE)

[![@databolsa/sdk](https://img.shields.io/npm/v/@databolsa/sdk?label=%40databolsa%2Fsdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/sdk)
[![@databolsa/cli](https://img.shields.io/npm/v/@databolsa/cli?label=%40databolsa%2Fcli&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/cli)
[![@databolsa/mcp](https://img.shields.io/npm/v/@databolsa/mcp?label=%40databolsa%2Fmcp&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/mcp)

🌐 **[databolsa.com](https://databolsa.com)** — a plataforma ao vivo · [referência da API](https://databolsa.com/docs)

SDK TypeScript, CLI e servidor Model Context Protocol open source para a API do
DataBolsa — dados do mercado financeiro brasileiro (ações, FIIs, BDRs, Tesouro
Direto, índices e indicadores macroeconômicos), com a fonte e a data de
referência em cada resposta.

Licenciado sob **Apache-2.0**.

## Pacotes

| Pacote | O que é |
| --- | --- |
| `packages/sdk` | Cliente TypeScript tipado (fetch nativo); tipos gerados do contrato OpenAPI. |
| `packages/cli` | CLI sobre a API — um subcomando por operação do contrato. |
| `packages/mcp` | Servidor Model Context Protocol que expõe os dados como ferramentas para agentes. |

O contrato OpenAPI da API fica em [`api/openapi.yaml`](api/openapi.yaml).

## Início rápido

```bash
npm i @databolsa/sdk
# ou: npx -y @databolsa/cli --help
# ou: npx -y @databolsa/mcp   (config de MCP em databolsa.com/desenvolvedores)
```

Uma API key gratuita fica disponível em [databolsa.com](https://databolsa.com).

Checagem de tipos de tudo: `bun run typecheck`.

## Contribuindo

Veja o [CONTRIBUTING.md](./CONTRIBUTING.md). Issues e pull requests são bem-vindos.
