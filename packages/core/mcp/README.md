# @databolsa/mcp

[![npm version](https://img.shields.io/npm/v/@databolsa/mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/mcp)
[![license](https://img.shields.io/npm/l/@databolsa/mcp?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Servidor [MCP](https://modelcontextprotocol.io) da API pública do DataBolsa.
As tools, seus schemas e as instruções da sessão são derivados do contrato
OpenAPI carregado no startup.

## Rodar por stdio

```bash
DATABOLSA_API_KEY=db_live_SUACHAVE npx -y @databolsa/mcp
```

Exemplo de configuração de um cliente MCP local:

```json
{
  "mcpServers": {
    "databolsa": {
      "command": "npx",
      "args": ["-y", "@databolsa/mcp"],
      "env": {
        "DATABOLSA_API_KEY": "db_live_SUACHAVE"
      }
    }
  }
}
```

Guarde a chave em uma configuração local não versionada. Para clientes com
OAuth, prefira o conector remoto documentado em
[docs.databolsa.com/mcp](https://docs.databolsa.com/mcp).

## Descobrir as tools

Use o catálogo de tools e os schemas mostrados pelo próprio cliente MCP. Eles
refletem a sessão e o contrato atuais; não replique uma lista de tools em prompts
ou configurações. Para inspecionar o contrato diretamente, consulte
[api.databolsa.com/openapi.json](https://api.databolsa.com/openapi.json).

O contrato pode declarar perfis em `x-profiles`. Sem configuração, o servidor
usa o perfil `default`; `DATABOLSA_MCP_PROFILE=full` expõe a superfície completa
para diagnóstico. Perfis reduzem contexto, não substituem autenticação nem
autorização.

## Configuração

| Variável | Uso |
| --- | --- |
| `DATABOLSA_API_URL` | Origem da API; padrão `https://api.databolsa.com`. |
| `DATABOLSA_API_KEY` | Chave Bearer da API hospedada. |
| `DATABOLSA_MCP_PROFILE` | Perfil declarado pelo contrato, como `default` ou `full`. |
| `MCP_TRANSPORT` | `stdio` por padrão; use `http` para Streamable HTTP. |
| `MCP_HTTP_PORT` | Porta HTTP; padrão `3333`. |

Para transporte HTTP:

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3333 npx -y @databolsa/mcp
```

O endpoint é `/mcp`. Se o expuser na rede, adicione sua própria camada de
autenticação, sessão e rate limit.

A Wallet e as extensões organizacionais usam contratos e servidores próprios.
Consulte o README da extensão correspondente para instalá-los no mesmo cliente.

Apache-2.0. O DataBolsa fornece informação e contexto, não recomendação de investimento.
