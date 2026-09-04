# @databolsa/wallet-mcp

[![npm version](https://img.shields.io/npm/v/@databolsa/wallet-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/wallet-mcp)
[![license](https://img.shields.io/npm/l/@databolsa/wallet-mcp?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Servidor MCP da Wallet do DataBolsa. Ele transforma o contrato de carteiras em
tools com schemas de entrada e saída.

## Rodar

```bash
DATABOLSA_API_KEY=db_live_SUACHAVE \
npx -y @databolsa/wallet-mcp
```

O transporte é `stdio`. O workspace vem da CHAVE, fixado quando ela foi criada: uma chave
criada no pessoal opera as carteiras pessoais; para as de uma organização, crie a chave dentro
dela. Guarde a chave em configuração local não versionada.

## Descobrir as tools

Use o catálogo e os schemas exibidos pelo próprio cliente MCP. Eles são gerados
do [OpenAPI da Wallet](https://api.databolsa.com/openapi-wallet.json) e são a
fonte atual para nomes, argumentos e respostas. Para mercado no mesmo agente,
adicione também `@databolsa/mcp`.

| Variável | Uso |
| --- | --- |
| `DATABOLSA_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_API_KEY` | Chave pessoal. |

Escritas alteram a carteira real. O agente deve confirmar alvo e efeito antes de
criar, importar, reconciliar ou excluir e não deve divulgar posições ou valores
além do necessário.

O mesmo contrato está disponível em `@databolsa/wallet-sdk` e
`@databolsa/wallet-cli`.

Apache-2.0. O servidor não executa ordens nem movimenta dinheiro.
