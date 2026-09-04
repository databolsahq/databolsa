# @databolsa/wallet-cli

[![npm version](https://img.shields.io/npm/v/@databolsa/wallet-cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/wallet-cli)
[![license](https://img.shields.io/npm/l/@databolsa/wallet-cli?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

CLI da Wallet do DataBolsa. Cada operação do contrato de carteiras vira um
comando.

## Uso e descoberta

```bash
npx -y @databolsa/wallet-cli --list
npx -y @databolsa/wallet-cli listPortfolios --help
npx -y @databolsa/wallet-cli listPortfolios --json
```

Esta é a entrada canônica da extensão. A CLI principal oferece
`databolsa wallet` como atalho de conveniência para o mesmo contrato; o atalho
não comprova que a Wallet esteja instalada e não deve ser usado como padrão
para descobrir outras extensões.

Use `--list` para o catálogo atual, `<operação> --help` para a sintaxe e o
[OpenAPI da Wallet](https://api.databolsa.com/openapi-wallet.json) para schemas
de entrada e saída. Operações de upload aceitam `--file <caminho>` quando a
ajuda indicar essa opção.

O catálogo e a ajuda podem ser lidos sem acesso à extensão. Uma operação real
em workspace sem Wallet responde `404 wallet_not_installed`; se ela estiver
suspensa, leituras continuam e escritas respondem `403 wallet_suspended`.

| Variável | Uso |
| --- | --- |
| `DATABOLSA_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_API_KEY` | Chave pessoal. |
| `DATABOLSA_WORKSPACE` | Organização; sem ela, usa o workspace pessoal. |

Use `--json` para scripts. Escritas alteram a carteira real: confirme alvo e
efeito antes de criar, importar, reconciliar ou excluir. Não exponha posições e
valores além do necessário.

SDK e MCP: `@databolsa/wallet-sdk` e `@databolsa/wallet-mcp`.

## Skill para agentes

```bash
npx skills add databolsahq/databolsa --skill databolsa-wallet-cli
```

A skill orienta o agente a descobrir o contrato atual, proteger dados da
carteira e pedir confirmação antes de qualquer escrita.

Apache-2.0. A CLI não executa ordens nem movimenta dinheiro.
