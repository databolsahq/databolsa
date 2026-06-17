# @databolsa/mcp

[![npm version](https://img.shields.io/npm/v/@databolsa/mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/mcp)
[![license](https://img.shields.io/npm/l/@databolsa/mcp?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

Servidor [MCP](https://modelcontextprotocol.io) read-only para a Serving API
pública do DataBolsa.

Ele expõe operações da API DataBolsa como tools MCP para agentes consultarem
dados do mercado brasileiro de forma determinística: ações, FIIs, índices, renda
fixa, regime macro, screeners, BDRs, opções, cripto e busca. As tools são
geradas no startup a partir do contrato OpenAPI vivo.

## Rodando

```bash
npx -y @databolsa/mcp
```

O transporte padrão é `stdio`, esperado por clientes MCP locais como Claude
Desktop e Claude Code.

## Claude Desktop

Adicione o servidor ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "databolsa": {
      "command": "npx",
      "args": ["-y", "@databolsa/mcp"],
      "env": {
        "DATABOLSA_API_URL": "https://api.databolsa.com"
      }
    }
  }
}
```

## Claude Code

```bash
claude mcp add databolsa -- npx -y @databolsa/mcp
```

## Transporte HTTP

O servidor também suporta Streamable HTTP:

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=3333 npx -y @databolsa/mcp
```

Endpoint: `http://localhost:3333/mcp`.

Se você expuser o transporte HTTP na rede, coloque o processo atrás da sua
própria camada de autenticação, sessão e rate-limit. O MCP em si é apenas um
adaptador read-only fino.

## Configuração

| Variável | Default | Uso |
| --- | --- | --- |
| `DATABOLSA_API_URL` | `https://api.databolsa.com` | Origem da API, com ou sem `/v1`. |
| `DATABOLSA_API_KEY` | vazio | Token Bearer opcional. |
| `MCP_TRANSPORT` | `stdio` | Use `http` para Streamable HTTP. |
| `MCP_HTTP_PORT` | `3333` | Porta do transporte HTTP. |

## Exemplo de Prompt

```text
Analise esta carteira: PETR4 100, VALE3 50, HGLG11 30.
Use as tools do DataBolsa para consultar fundamentos, proventos, preços recentes e regime macro.
```

O agente mantém a carteira informada por você e usa as tools do DataBolsa como
lookups read-only. O DataBolsa não armazena carteiras, não executa ordens e não
toma decisões de investimento.

## API Local

Para apontar o MCP para uma API DataBolsa self-hosted:

```bash
DATABOLSA_API_URL=http://localhost:8081 npx -y @databolsa/mcp
```

## Pacotes Relacionados

O SDK e a CLI expõem o mesmo contrato da API em formatos diferentes:

```bash
npm install @databolsa/sdk
npm install -g @databolsa/cli
```

## Links

- OpenAPI: https://api.databolsa.com/openapi.json
- Fontes e cobertura: https://github.com/databolsahq/databolsa/blob/main/docs/sources.md
- Metodologia dos indicadores: https://github.com/databolsahq/databolsa/blob/main/docs/indicators.md
- Limitações conhecidas: https://github.com/databolsahq/databolsa/blob/main/docs/limitations.md

## Licença

Apache-2.0. O DataBolsa é infraestrutura de dados, não recomendação de investimento.
