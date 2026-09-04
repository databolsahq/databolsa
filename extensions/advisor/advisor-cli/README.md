# @databolsa/advisor-cli

[![npm version](https://img.shields.io/npm/v/@databolsa/advisor-cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-cli)
[![license](https://img.shields.io/npm/l/@databolsa/advisor-cli?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

CLI do DataBolsa Advisor. Cada operação do contrato do escritório vira um
comando; parâmetros e ajuda são gerados do OpenAPI.

## Uso e descoberta

```bash
npm install -g @databolsa/advisor-cli

databolsa-advisor --list
databolsa-advisor advisorGetMe --help
databolsa-advisor advisorGetMe
databolsa-advisor advisorListClients <org> --json
```

Sem instalação global, use `npx -y @databolsa/advisor-cli`. Dentro do checkout
do DataBolsa, onde o npm pode sombrear o pacote publicado com o workspace local,
use `bun run cli:advisor -- <operação>`.

`--list` é o catálogo atual. Antes de executar uma operação nova, consulte
`<operação> --help`; para o schema exato, use o
[OpenAPI do Advisor](https://api.databolsa.com/openapi-advisor.json). Isso evita
duplicar comandos, argumentos e enums no README.

## Configuração

| Variável | Uso |
| --- | --- |
| `DATABOLSA_ADVISOR_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_ADVISOR_API_KEY` | Chave pessoal do membro. |

Use `--json` para scripts. Operações de upload aceitam `--file <caminho>`
quando a ajuda do comando indicar essa opção.

Recursos fora do escopo respondem 404. Licença vencida bloqueia escritas com
402, mas mantém leituras. Toda escrita altera o escritório real e é auditada:
confirme alvo e efeito antes de executá-la e não exponha dados de clientes além
do necessário.

## Agent Skill

```bash
npx skills add databolsahq/databolsa --skill databolsa-advisor-cli
```

SDK, MCP e documentação: `@databolsa/advisor-sdk`,
`@databolsa/advisor-mcp` e
[docs.databolsa.com/extensoes/advisor](https://docs.databolsa.com/extensoes/advisor).

Apache-2.0. A CLI não executa ordens nem movimenta dinheiro.
