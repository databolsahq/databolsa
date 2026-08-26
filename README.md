# DataBolsa

[![CI](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml/badge.svg)](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/databolsahq/databolsa?label=release&color=2ea44f)](https://github.com/databolsahq/databolsa/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-2ea44f)](LICENSE)

[![@databolsa/sdk](https://img.shields.io/npm/v/@databolsa/sdk?label=%40databolsa%2Fsdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/sdk)
[![@databolsa/cli](https://img.shields.io/npm/v/@databolsa/cli?label=%40databolsa%2Fcli&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/cli)
[![@databolsa/mcp](https://img.shields.io/npm/v/@databolsa/mcp?label=%40databolsa%2Fmcp&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/mcp)

🌐 **[databolsa.com](https://databolsa.com)** — a plataforma ao vivo · [documentação](https://docs.databolsa.com)

SDK TypeScript, CLI e servidor Model Context Protocol open source para a API do
DataBolsa — dados do mercado financeiro brasileiro (ações, FIIs, BDRs, Tesouro
Direto, índices e indicadores macroeconômicos), com a fonte e a data de
referência em cada resposta.

Licenciado sob **Apache-2.0**.

## Pacotes

Clientes finos da API do DataBolsa — dados de mercado, documentos e a carteira
da sua conta:

| Pacote | O que é |
| --- | --- |
| `packages/core/sdk` | Cliente TypeScript tipado (fetch nativo); tipos gerados do contrato OpenAPI. |
| `packages/core/cli` | CLI sobre a API — um subcomando por operação do contrato. |
| `packages/core/mcp` | Servidor Model Context Protocol que expõe os dados como ferramentas para agentes. |

O contrato OpenAPI da API fica em [`api/openapi.yaml`](api/openapi.yaml).

### DataBolsa Advisor

Clientes do **DataBolsa Advisor**, a camada organizacional para escritórios de
assessoria, consultorias e wealth managers: organizações, membros e papéis,
clientes e famílias, carteiras por cliente e trilha de auditoria. Contrato
**separado**, em [`api/openapi-advisor.yaml`](api/openapi-advisor.yaml).

[![@databolsa/advisor-sdk](https://img.shields.io/npm/v/@databolsa/advisor-sdk?label=%40databolsa%2Fadvisor-sdk&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-sdk)
[![@databolsa/advisor-cli](https://img.shields.io/npm/v/@databolsa/advisor-cli?label=%40databolsa%2Fadvisor-cli&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-cli)
[![@databolsa/advisor-mcp](https://img.shields.io/npm/v/@databolsa/advisor-mcp?label=%40databolsa%2Fadvisor-mcp&color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-mcp)

| Pacote | O que é |
| --- | --- |
| `packages/advisor/advisor-sdk` | Cliente TypeScript tipado do contrato do Advisor. |
| `packages/advisor/advisor-cli` | CLI do Advisor — um comando por operação (`databolsa-advisor`). |
| `packages/advisor/advisor-mcp` | Servidor MCP com as tools `advisor*` do escritório. |

Autenticam com chave de organização (`db_org_…`) ou com a chave pessoal de um
membro. Documentação em
[docs.databolsa.com/advisor](https://docs.databolsa.com/advisor).

## Início rápido

```bash
npm i @databolsa/sdk
# ou: npx -y @databolsa/cli --help
# ou: npx -y @databolsa/mcp   (config de MCP em docs.databolsa.com/mcp)

# escritório:
npx -y @databolsa/advisor-cli advisorGetMe
```

Uma API key gratuita fica disponível em [databolsa.com](https://databolsa.com).

## Agent Skills

Instale a skill pública para que agentes descubram e usem a CLI com segurança:

```bash
npx skills add databolsahq/databolsa --skill databolsa-cli
# escritório:
npx skills add databolsahq/databolsa --skill databolsa-advisor-cli
```

As skills requerem Node.js 18+, rede e a chave no ambiente
(`DATABOLSA_API_KEY`, ou `DATABOLSA_ADVISOR_API_KEY` no Advisor). Elas usam a
CLI e consultam a ajuda gerada pelo contrato antes de executar operações.

Checagem de tipos de tudo: `bun run typecheck`.

## Contribuindo

Veja o [CONTRIBUTING.md](./CONTRIBUTING.md). Issues e pull requests são bem-vindos.
