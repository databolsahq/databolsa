# @databolsa/sdk

[![npm version](https://img.shields.io/npm/v/@databolsa/sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/sdk)
[![license](https://img.shields.io/npm/l/@databolsa/sdk?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Cliente TypeScript tipado da API pública do DataBolsa. É uma camada fina sobre o
contrato OpenAPI: dados, cálculos, unidades e regras de negócio permanecem na API.

## Instalação

```bash
npm install @databolsa/sdk
```

## Uso

```ts
import { DataBolsa } from "@databolsa/sdk";

const db = new DataBolsa("https://api.databolsa.com", {
  apiKey: process.env.DATABOLSA_API_KEY,
});

const papel = await db.resolveObject({ q: "PETR4" });
const quotes = await db.listQuotes("PETR4", {
  from: "2025-01-01",
  limit: 30,
});
```

Mantenha a chave no servidor. Em um app browser, use uma URL relativa somente
quando a própria aplicação fizer proxy para a API.

## Descobrir a superfície atual

- O contrato vivo descreve operações, parâmetros, schemas, enums e erros:
  [api.databolsa.com/openapi.json](https://api.databolsa.com/openapi.json).
- O pacote exporta os tipos brutos `paths`, `components` e `operations` gerados
  desse contrato.
- Para explorar sem escrever código, use `npx -y @databolsa/cli --list` e
  `npx -y @databolsa/cli <operação> --help`.

### Adaptadores de tools

Quem constrói uma interface para agentes pode importar a projeção pura do
contrato, sem depender do MCP ou da CLI:

```ts
import { describeOperation, extractOperations } from "@databolsa/sdk/openapi";

const operations = extractOperations(openApiDocument);
const description = describeOperation(operations[0]);
```

O OpenAPI continua sendo a única fonte autoral de descrições e schemas. A
projeção apenas resolve referências e preserva tipos, padrões, limites e a
forma compacta de objetos para cada cliente gerar sua própria definition.

Também existe uma façade orientada a objetos:

```ts
const paper = await db.objects.resolveOne("PETR4", { kind: "equity_security" });
const history = await paper.market.quotes.history({ from: "2025-01-01" });
const issuer = await paper.issuer();
```

Use `describe()` para observar os capítulos disponíveis para um objeto e
`fn(nome, entrada)` para executar uma função publicada pelo registry. Assim o
código acompanha o vocabulário servido sem manter uma lista manual no README.

## Erros

Respostas não-2xx lançam erro com o status e, quando disponível, o detalhe da
API. `NotInPreviewError` cobre endpoints ainda não servidos e recursos ausentes.

## Outras interfaces

```bash
npm install -g @databolsa/cli
npx -y @databolsa/mcp
```

Documentação, fontes, metodologia e limitações: [docs.databolsa.com](https://docs.databolsa.com).

Apache-2.0. O DataBolsa fornece informação e contexto, não recomendação de investimento.
