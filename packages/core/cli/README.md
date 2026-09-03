# @databolsa/cli

[![npm version](https://img.shields.io/npm/v/@databolsa/cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/cli)
[![license](https://img.shields.io/npm/l/@databolsa/cli?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

CLI da API pública do DataBolsa. Cada operação do contrato OpenAPI vira um
comando; a CLI apenas traduz argumentos, chama a API e apresenta a resposta.

## Uso

```bash
npm install -g @databolsa/cli

databolsa --list
databolsa listQuotes --help
databolsa resolveObject --q PETR4
databolsa listQuotes PETR4 --from 2025-01-01 --limit 5 --json
```

Sem instalação global, substitua `databolsa` por `npx -y @databolsa/cli`.
Objetos e listas têm saída legível por padrão; use `--json` para scripts e `jq`.

## Descoberta

Não mantenha uma lista de comandos fora da ferramenta:

1. `databolsa --list` mostra as operações do contrato carregado.
2. `databolsa <operação> --help` mostra argumentos, opções, enums e defaults.
3. O [OpenAPI vivo](https://api.databolsa.com/openapi.json) é a fonte de verdade
   para schemas de entrada e saída.

A CLI principal mantém um atalho de conveniência para o contrato da Wallet:

```bash
databolsa wallet --list
databolsa wallet listPortfolios
```

O atalho apenas seleciona `/openapi-wallet.json`; ele não indica que a extensão
esteja instalada. `--list` e `--help` podem funcionar mesmo quando o workspace
não tem acesso. As operações reais passam pelos gates da Wallet: ausência ou
desinstalação responde `404 wallet_not_installed`, enquanto suspensão mantém
leituras e recusa escritas com `403 wallet_suspended`.

Para integrações e scripts duradouros, prefira o cliente próprio
`@databolsa/wallet-cli`. Não presuma que outras extensões aparecerão como
subcomandos da CLI principal.

## Configuração

| Variável | Uso |
| --- | --- |
| `DATABOLSA_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_API_KEY` | Chave Bearer da API hospedada. |
| `DATABOLSA_WORKSPACE` | Workspace usado pelas operações da Wallet. |

As flags globais são `--json`, `--api-url`, `--help`, `--version` e `--list`.

Crie uma chave em [databolsa.com/conta](https://databolsa.com/conta) e mantenha-a
fora do histórico do shell e do código-fonte.

## Outras interfaces

```bash
npm install @databolsa/sdk
npx -y @databolsa/mcp
```

Documentação, fontes, metodologia e limitações: [docs.databolsa.com](https://docs.databolsa.com).

Apache-2.0. O DataBolsa fornece informação e contexto, não recomendação de investimento.
