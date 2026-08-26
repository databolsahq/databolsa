# @databolsa/advisor-sdk

[![npm version](https://img.shields.io/npm/v/@databolsa/advisor-sdk?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-sdk)
[![license](https://img.shields.io/npm/l/@databolsa/advisor-sdk?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

🌐 **[advisor.databolsa.com](https://advisor.databolsa.com)** — o portal do escritório · [documentação](https://docs.databolsa.com/advisor)

SDK TypeScript tipado para a API do **DataBolsa Advisor** — a camada
organizacional para escritórios de assessoria, consultorias e wealth managers:
organizações, membros e papéis, clientes e famílias, carteiras por cliente e
trilha de auditoria.

O contrato do Advisor é **separado** do contrato principal do DataBolsa. Este
pacote é uma casca fina sobre ele: não calcula indicadores no cliente.

## Instalação

```bash
npm install @databolsa/advisor-sdk
```

## Uso rápido

```ts
import { DataBolsaAdvisor, DataBolsaAdvisorError } from "@databolsa/advisor-sdk";

const advisor = new DataBolsaAdvisor({
  apiKey: process.env.DATABOLSA_ADVISOR_API_KEY,
});

const me = await advisor.getMe();
const org = me.organizations[0].org_slug;

const { data: clientes } = await advisor.listClients(org, { status: "active" });
const { data: carteiras } = await advisor.listClientPortfolios(org, clientes[0].id);
const carteira = await advisor.getPortfolio(org, carteiras[0].id);

try {
  await advisor.updateClientProfile(org, clientes[0].id, {
    risk_profile: "moderado",
    restrictions: [{ kind: "concentracao", asset_class: "acoes", max_pct: 40 }],
  });
} catch (err) {
  if (err instanceof DataBolsaAdvisorError && err.problem?.code === "license_required") {
    console.warn("licença vencida — escritas bloqueadas, leituras seguem abertas");
  } else {
    throw err;
  }
}
```

Toda operação, exceto as de conta, recebe o identificador da organização
(`slug` ou `id`) como primeiro argumento. `getMe()` lista em quais organizações
a credencial pode agir.

## Configuração

| Opção | Default | Uso |
| --- | --- | --- |
| `baseUrl` | `https://api.databolsa.com` | Origem da API. Os paths já incluem `/v1/advisor`. |
| `apiKey` | vazio | Chave de organização (`db_org_…`) ou chave pessoal de membro (`db_live_…`). |
| `credentials` | vazio | `"include"` quando a sessão vem por cookie same-origin. |
| `fetch` | `fetch` global | Injeta um fetch próprio (teste, proxy, retry). |

Duas credenciais, dois enquadramentos: a **chave de organização** é a credencial
de serviço do escritório (escopo `full` opera como admin, `read` é só leitura);
a **chave pessoal de membro** segue o papel e a visibilidade de clientes do
assento daquela pessoa.

Mantenha a chave no servidor. Ela abre o escritório inteiro — nunca a exponha em
bundle de browser, variável pública de framework ou log.

## Comportamento que vale em toda rota

- **Escopo é a organização.** Um recurso fora dela — ou fora da sua visibilidade
  de clientes — responde **404**, nunca 403. Não conclua que um registro existe a
  partir do erro.
- **Licença trava escrita, não leitura.** Licença vencida responde **402** com
  `code: license_required` nas escritas; as leituras continuam.
- **Toda escrita é auditada**, na mesma transação da mudança.
- **Posição é derivada.** As posições de uma carteira saem do ledger de
  transações somado à cotação de mercado. Para corrigir uma posição, corrija o
  lançamento.

## Erros

`DataBolsaAdvisorError` carrega o `status` HTTP e o corpo `problem+json`
(RFC 9457) em `problem` — com `title`, `detail` e `code`.

## Tipos

Os tipos de request e response são resolvidos por lookup no schema gerado do
contrato com `openapi-typescript`. O pacote também exporta os paths crus como
`AdvisorPaths`.

## Pacotes relacionados

A CLI e o servidor MCP expõem o mesmo contrato do Advisor em outros formatos:

```bash
npm install -g @databolsa/advisor-cli
npx -y @databolsa/advisor-mcp
```

Para dados de mercado (ações, FIIs, fundos, crédito, macro), use
`@databolsa/sdk`.

## Links

- Documentação: https://docs.databolsa.com/advisor
- Contrato OpenAPI: https://api.databolsa.com/openapi-advisor.json
- Referência navegável: https://docs.databolsa.com/advisor/api

## Licença

Apache-2.0. O DataBolsa é infraestrutura de dados, não recomendação de
investimento. A recomendação a um cliente final continua sendo responsabilidade
do profissional habilitado que usa a ferramenta.
