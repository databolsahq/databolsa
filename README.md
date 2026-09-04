# DataBolsa

[![CI](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml/badge.svg)](https://github.com/databolsahq/databolsa/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/databolsahq/databolsa?label=release&color=2ea44f)](https://github.com/databolsahq/databolsa/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-2ea44f)](LICENSE)

Clientes open source para usar o contexto financeiro do DataBolsa em código, no
terminal e em agentes. SDK, CLI e MCP são interfaces finas sobre contratos
OpenAPI: a API preserva dados, fontes, datas, unidades e regras de negócio.

[Plataforma](https://databolsa.com) · [Documentação](https://docs.databolsa.com) ·
[Referência da API](https://docs.databolsa.com/api)

## Contratos

| Superfície | Contrato | Clientes |
| --- | --- | --- |
| Mercado, documentos e objetos | [`api/openapi.yaml`](api/openapi.yaml) | `@databolsa/sdk`, `@databolsa/cli`, `@databolsa/mcp` |
| Wallet | [`api/openapi-wallet.yaml`](api/openapi-wallet.yaml) | `@databolsa/wallet-sdk`, `@databolsa/wallet-cli`, `@databolsa/wallet-mcp` |
| Advisor | [`api/openapi-advisor.yaml`](api/openapi-advisor.yaml) | `@databolsa/advisor-sdk`, `@databolsa/advisor-cli`, `@databolsa/advisor-mcp` |
| Credit Desk | [`api/openapi-credit.yaml`](api/openapi-credit.yaml) | `@databolsa/credit-sdk`, `@databolsa/credit-cli`, `@databolsa/credit-mcp` |

Cada contrato é separado. Use o cliente da superfície que possui o dado; não
presuma que uma operação de carteira ou escritório exista no contrato de
mercado.

## Começar

```bash
npm install @databolsa/sdk
npx -y @databolsa/cli --list
npx -y @databolsa/mcp
```

```ts
import { DataBolsa } from "@databolsa/sdk";

const db = new DataBolsa("https://api.databolsa.com", {
  apiKey: process.env.DATABOLSA_API_KEY,
});

const stock = await db.getStock("PETR4");
```

Crie uma chave em [databolsa.com/conta](https://databolsa.com/conta) e mantenha-a
fora do browser, de logs e do controle de versão.

## Descobrir em vez de memorizar

As superfícies acompanham o contrato carregado:

- na CLI, use `--list` e `<operação> --help`;
- no MCP, use o catálogo de tools e os schemas exibidos pelo cliente;
- no SDK, use os tipos gerados e os exports `paths`/`*Paths`;
- para detalhes exatos, consulte apenas a operação ou o schema necessário no
  OpenAPI vivo.

Os READMEs de cada pacote contêm instalação, configuração e um exemplo mínimo.
A referência completa e as limitações ficam em
[docs.databolsa.com](https://docs.databolsa.com).

## Extensões

```bash
# Carteiras
npx -y @databolsa/wallet-cli --list

# Escritórios de assessoria e consultoria
npx -y @databolsa/advisor-cli --list

# Mesas de crédito privado
npx -y @databolsa/credit-cli --list
```

Wallet pode usar o workspace pessoal ou uma organização. Advisor e Credit Desk
são organizacionais. Operações de escrita alteram dados reais e devem ter alvo e
efeito confirmados antes da execução.

## Agent Skills

```bash
npx skills add databolsahq/databolsa --skill databolsa-cli
npx skills add databolsahq/databolsa --skill databolsa-wallet-cli
npx skills add databolsahq/databolsa --skill databolsa-advisor-cli
npx skills add databolsahq/databolsa --skill databolsa-credit-cli
```

As skills ensinam o agente a observar a CLI e o contrato atuais, preservar
fontes e unidades e confirmar escritas. Elas não duplicam um catálogo fixo de
operações.

## Desenvolvimento

```bash
bun install
bun run typecheck
bun run cli:wallet -- --list
bun run cli:advisor -- --list
bun run cli:credit -- --list
```

Dentro deste checkout, prefira os scripts acima: o npm pode resolver um pacote
de CLI para o workspace local antes de instalar seu binário publicado. Fora do
checkout, os comandos `npx` desta página continuam sendo o launcher de uso único.

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para contribuir.

Apache-2.0. O DataBolsa fornece informação e contexto, não recomendação de investimento.
