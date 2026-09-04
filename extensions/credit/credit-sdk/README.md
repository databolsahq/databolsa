# @databolsa/credit-sdk

[![npm version](https://img.shields.io/npm/v/@databolsa/credit-sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/credit-sdk)
[![license](https://img.shields.io/npm/l/@databolsa/credit-sdk?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Cliente TypeScript tipado da mesa de crédito do DataBolsa. Watchlists, notas,
alertas e revisões de regulamento vivem em contrato separado dos dados públicos
de mercado.

## Uso

```bash
npm install @databolsa/credit-sdk
```

```ts
import { DataBolsaCredit } from "@databolsa/credit-sdk";

const credit = new DataBolsaCredit({
  apiKey: process.env.DATABOLSA_CREDIT_API_KEY,
});

const me = await credit.getMe();
const { data: watchlists } = await credit.listWatchlists(me.organizations[0].org_slug);
```

A chave é pessoal e deve permanecer no servidor. A mesa vem da própria chave, fixada quando ela
foi criada — crie-a dentro da mesa em que quer agir.

## Descobrir a superfície atual

- Consulte o [OpenAPI da mesa](https://api.databolsa.com/openapi-credit.json)
  para operações, schemas, unidades, enums e erros.
- O pacote exporta `CreditPaths`, gerado do mesmo contrato.
- Use `npx -y @databolsa/credit-cli --list` e
  `npx -y @databolsa/credit-cli <operação> --help` para descoberta interativa.

`DataBolsaCreditError` expõe `status` e o corpo `problem+json` em `problem`.

Recursos fora da mesa respondem 404. Licença vencida bloqueia escritas com 402,
mas mantém leituras. Toda escrita é auditada. Preserve as unidades e o significado
de `null` descritos pelo contrato.

O mesmo contrato está disponível em `@databolsa/credit-cli` e
`@databolsa/credit-mcp`. Para dados públicos de crédito e mercado, use
`@databolsa/sdk`.

Apache-2.0. O DataBolsa fornece informação e contexto, não decisão de crédito.
