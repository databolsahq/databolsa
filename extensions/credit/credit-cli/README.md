# @databolsa/credit-cli

[![npm version](https://img.shields.io/npm/v/@databolsa/credit-cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/credit-cli)
[![license](https://img.shields.io/npm/l/@databolsa/credit-cli?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

CLI da mesa de crédito do DataBolsa. Cada operação do contrato da mesa vira um
comando; parâmetros e ajuda são gerados do OpenAPI.

## Uso e descoberta

```bash
npm install -g @databolsa/credit-cli

databolsa-credit --list
databolsa-credit deskGetMe --help
databolsa-credit deskGetMe
databolsa-credit deskListWatchlists <org> --json
```

Sem instalação global, use `npx -y @databolsa/credit-cli`.

Use `--list` para ver o catálogo atual e `<operação> --help` para argumentos,
enums e defaults. O
[OpenAPI da mesa](https://api.databolsa.com/openapi-credit.json) descreve os
schemas e unidades exatos.

## Configuração

| Variável | Uso |
| --- | --- |
| `DATABOLSA_CREDIT_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_CREDIT_API_KEY` | Chave pessoal do membro. |
| `DATABOLSA_CREDIT_WORKSPACE` | Mesa usada no header `x-databolsa-workspace`. |

Use `--json` para scripts. Recursos fora do escopo respondem 404. Licença
vencida bloqueia escritas com 402, mas mantém leituras. Toda escrita é auditada:
confirme alvo e efeito antes de executá-la. Preserve unidades e valores ausentes
como descritos pelo contrato.

Para dados públicos de crédito e mercado, use `@databolsa/cli`. O mesmo
contrato da mesa também está em `@databolsa/credit-sdk` e
`@databolsa/credit-mcp`.

## Skill para agentes

```bash
npx skills add databolsahq/databolsa --skill databolsa-credit-cli
```

A skill orienta o agente a descobrir o contrato atual, preservar unidades e
confidencialidade e pedir confirmação antes de qualquer escrita.

Apache-2.0. A CLI não executa ordens nem movimenta dinheiro.
