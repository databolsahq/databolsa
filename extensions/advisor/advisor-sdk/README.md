# @databolsa/advisor-sdk

[![npm version](https://img.shields.io/npm/v/@databolsa/advisor-sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-sdk)
[![license](https://img.shields.io/npm/l/@databolsa/advisor-sdk?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Cliente TypeScript tipado do DataBolsa Advisor. Ele cobre o contexto do
escritório — organização, clientes, carteiras e auditoria — por um contrato
separado da API de mercado.

## Uso

```bash
npm install @databolsa/advisor-sdk
```

```ts
import { DataBolsaAdvisor } from "@databolsa/advisor-sdk";

const advisor = new DataBolsaAdvisor({
  apiKey: process.env.DATABOLSA_ADVISOR_API_KEY,
  workspace: process.env.DATABOLSA_ADVISOR_WORKSPACE,
});

const me = await advisor.getMe();
const { data: clients } = await advisor.listClients(me.organizations[0].org_slug, {
  status: "active",
});
```

A chave é pessoal e deve permanecer no servidor. `workspace` envia o header
`x-databolsa-workspace`; `getMe()` mostra as organizações acessíveis.

## Descobrir a superfície atual

- Consulte o [OpenAPI do Advisor](https://api.databolsa.com/openapi-advisor.json)
  para operações, schemas, enums e erros.
- O pacote exporta `AdvisorPaths`, gerado do mesmo contrato.
- Use `npx -y @databolsa/advisor-cli --list` e
  `npx -y @databolsa/advisor-cli <operação> --help` para explorar os métodos
  sem manter um inventário neste README.

`DataBolsaAdvisorError` expõe `status` e o corpo `problem+json` em `problem`.

## Regras de uso

Recursos fora da organização ou da visibilidade do membro respondem 404.
Licença vencida bloqueia escritas com 402, mas mantém leituras. Escritas são
auditadas; dados de clientes devem permanecer no escopo pedido. Posições são
derivadas do ledger, portanto correções devem ser feitas nas transações.

O mesmo contrato está disponível em `@databolsa/advisor-cli` e
`@databolsa/advisor-mcp`. Para mercado, use `@databolsa/sdk`.

Documentação: [docs.databolsa.com/advisor](https://docs.databolsa.com/advisor).

Apache-2.0. A recomendação ao cliente final continua sob responsabilidade do profissional habilitado.
