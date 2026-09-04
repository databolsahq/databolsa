# @databolsa/credit-mcp

[![npm version](https://img.shields.io/npm/v/@databolsa/credit-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/credit-mcp)
[![license](https://img.shields.io/npm/l/@databolsa/credit-mcp?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Servidor MCP da mesa de crédito do DataBolsa. Ele transforma as operações do
contrato da mesa em tools com schemas de entrada e saída.

## Rodar

```bash
DATABOLSA_CREDIT_API_KEY=db_live_SUACHAVE \
npx -y @databolsa/credit-mcp
```

O transporte é `stdio`. Guarde a chave em configuração local não versionada.

## Descobrir as tools

Use o catálogo e os schemas mostrados pelo próprio cliente MCP. Eles são gerados
do [OpenAPI da mesa](https://api.databolsa.com/openapi-credit.json) e substituem
listas manuais de tools. Para dados públicos de crédito e mercado no mesmo
agente, adicione também `@databolsa/mcp`.

| Variável | Uso |
| --- | --- |
| `DATABOLSA_CREDIT_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_CREDIT_API_KEY` | Chave pessoal do membro. |

Recursos fora do escopo respondem 404. Licença vencida bloqueia escritas com
402, mas mantém leituras. Toda escrita é auditada: o agente deve confirmar alvo
e efeito antes de criar, alterar ou excluir. Preserve unidades e valores
ausentes conforme o schema da tool.

O mesmo contrato está disponível em `@databolsa/credit-sdk` e
`@databolsa/credit-cli`.

Apache-2.0. O servidor não executa ordens nem movimenta dinheiro.
