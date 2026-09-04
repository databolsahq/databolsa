# @databolsa/advisor-mcp

[![npm version](https://img.shields.io/npm/v/@databolsa/advisor-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-mcp)
[![license](https://img.shields.io/npm/l/@databolsa/advisor-mcp?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Servidor MCP do DataBolsa Advisor. Ele transforma as operações do contrato do
escritório em tools com schemas de entrada e saída.

## Rodar

```bash
DATABOLSA_ADVISOR_API_KEY=db_live_SUACHAVE \
npx -y @databolsa/advisor-mcp
```

O transporte é `stdio`. Guarde a chave em configuração local não versionada.

## Descobrir as tools

Use o catálogo e os schemas exibidos pelo próprio cliente MCP. Eles são gerados
do [OpenAPI do Advisor](https://api.databolsa.com/openapi-advisor.json) e são a
fonte atual para nomes, argumentos e respostas. Para mercado no mesmo agente,
adicione também `@databolsa/mcp`.

| Variável | Uso |
| --- | --- |
| `DATABOLSA_ADVISOR_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_ADVISOR_API_KEY` | Chave pessoal do membro. |

Recursos fora do escopo respondem 404. Licença vencida bloqueia escritas com
402, mas mantém leituras. Toda escrita é auditada: o agente deve confirmar alvo
e efeito antes de criar, alterar ou excluir. Dados de clientes não devem sair do
escopo da tarefa.

SDK, CLI e documentação: `@databolsa/advisor-sdk`,
`@databolsa/advisor-cli` e
[docs.databolsa.com/extensoes/advisor](https://docs.databolsa.com/extensoes/advisor).

Apache-2.0. O servidor não executa ordens nem movimenta dinheiro.
