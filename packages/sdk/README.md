# @databolsa/sdk

[![npm version](https://img.shields.io/npm/v/@databolsa/sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/sdk)
[![license](https://img.shields.io/npm/l/@databolsa/sdk?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

SDK TypeScript tipado para a Serving API pública do DataBolsa.

O DataBolsa oferece infraestrutura aberta e reprodutível de dados para o mercado
financeiro brasileiro: ações, FIIs, índices, séries macro, renda fixa, BDRs,
opções, cripto e busca. O SDK é uma casca fina sobre o contrato OpenAPI. Ele não
calcula indicadores financeiros no cliente.

## Instalação

```bash
npm install @databolsa/sdk
```

## Uso Rápido

```ts
import { DataBolsa, NotInPreviewError } from "@databolsa/sdk";
import type { QuotesResponse, Stock } from "@databolsa/sdk";

const db = new DataBolsa("https://api.databolsa.com", {
  apiKey: process.env.DATABOLSA_API_KEY,
});

try {
  const stock: Stock = await db.getStock("PETR4");
  const quotes: QuotesResponse = await db.listQuotes("PETR4", {
    from: "2024-01-01",
    limit: 30,
  });

  console.log(stock.company?.name, quotes.data.length);
} catch (err) {
  if (err instanceof NotInPreviewError) {
    console.warn(err.message);
  } else {
    throw err;
  }
}
```

`DataBolsa` é um alias de `HttpClient`.

## Configuração

Use um `baseUrl` absoluto em Node ou no servidor:

```ts
const db = new DataBolsa("https://api.databolsa.com");
```

Use um `baseUrl` relativo apenas em apps browser que fazem proxy de `/v1` para a
API a partir da mesma origem:

```ts
const db = new DataBolsa("/");
```

Autenticação é opcional em implantações abertas. Se você usar uma chave de API,
mantenha a chave no servidor e passe por `apiKey` ou `getToken`.

## Tipos

O pacote exporta tipos de domínio e de resposta gerados do contrato OpenAPI,
incluindo `Stock`, `Fii`, `QuotesResponse`, `ScreenStocksResponse`,
`RegimeSnapshot`, `YieldCurveResponse` e outros.

Também exporta os tipos brutos do OpenAPI: `paths`, `components` e `operations`.

## Erros

`NotInPreviewError` é lançado quando a API retorna 501 para um endpoint ainda não
servido ou 404 para um recurso ausente. Outros status não-2xx lançam um `Error`
com o status da API e o detalhe do problema quando disponível.

## Pacotes Relacionados

A CLI e o MCP expõem o mesmo contrato da API em formatos diferentes:

```bash
npm install -g @databolsa/cli
npx -y @databolsa/mcp
```

## Links

- OpenAPI: https://api.databolsa.com/openapi.json
- Fontes e cobertura: https://github.com/databolsahq/databolsa/blob/main/docs/sources.md
- Metodologia dos indicadores: https://github.com/databolsahq/databolsa/blob/main/docs/indicators.md
- Limitações conhecidas: https://github.com/databolsahq/databolsa/blob/main/docs/limitations.md

## Licença

Apache-2.0. O DataBolsa é infraestrutura de dados, não recomendação de investimento.
