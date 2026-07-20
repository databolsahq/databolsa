# @databolsa/cli

[![npm version](https://img.shields.io/npm/v/@databolsa/cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/cli)
[![license](https://img.shields.io/npm/l/@databolsa/cli?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

🌐 **[databolsa.com](https://databolsa.com)** — a plataforma ao vivo · [docs da API](https://databolsa.com/docs)

CLI para a Serving API pública do DataBolsa.

A CLI gera um comando por operação OpenAPI no startup. Ela é intencionalmente
fina: resolve parâmetros de path, resolve parâmetros de query, chama a API e
renderiza a resposta. Lógica financeira, unidades, linhagem e cache vivem na
API.

## Instalação

```bash
npm install -g @databolsa/cli
```

Você também pode rodar sem instalar globalmente:

```bash
npx -y @databolsa/cli getHealth
```

## Uso Rápido

```bash
databolsa --list
databolsa getHealth
databolsa getStock PETR4
databolsa screenStocks --sector Bancos --limit 20
databolsa listQuotes PETR4 --from 2024-01-01 --limit 5
databolsa getStock PETR4 --json | jq .ticker
```

Por padrão, objetos saem em formato chave/valor e listas saem como tabelas
compactas. Use `--json` para JSON bruto em `jq`, arquivos ou scripts.

## Configuração

| Variável | Default | Uso |
| --- | --- | --- |
| `DATABOLSA_API_URL` | `https://api.databolsa.com` | Origem da API, com ou sem `/v1`. |
| `DATABOLSA_API_KEY` | vazio | Token Bearer. **Obrigatório na API hospedada** (`api.databolsa.com`). Crie a sua em [databolsa.com/conta](https://databolsa.com/conta). |

Flags globais:

| Flag | Uso |
| --- | --- |
| `--json` | Imprime JSON bruto. |
| `--api-url <url>` | Sobrescreve `DATABOLSA_API_URL`. |
| `--help`, `-h` | Mostra ajuda geral ou de um comando. |
| `--version` | Mostra a versão da CLI. |

A ajuda dos comandos é gerada a partir do contrato da API:

```bash
databolsa getStock --help
databolsa screenStocks --help
```

## Códigos de Saída

| Código | Significado |
| --- | --- |
| 0 | OK. |
| 1 | Erro da API ou erro inesperado. |
| 2 | Erro de uso, como comando, opção ou argumento inválido. |
| 3 | Endpoint ou recurso indisponível na API pública atual. |

## Outra Origem Da API

Para apontar a CLI para outra origem da API DataBolsa (por exemplo, um
ambiente de desenvolvimento):

```bash
DATABOLSA_API_URL=http://localhost:8081 databolsa getHealth
databolsa --api-url http://localhost:8081 getStock PETR4
```

## Pacotes Relacionados

O SDK e o MCP expõem o mesmo contrato da API em formatos diferentes:

```bash
npm install @databolsa/sdk
npx -y @databolsa/mcp
```

## Links

- OpenAPI: https://api.databolsa.com/openapi.json
- Fontes e cobertura: https://github.com/databolsahq/databolsa/blob/main/docs/sources.md
- Metodologia dos indicadores: https://databolsa.com/metodologia
- Limitações conhecidas: https://github.com/databolsahq/databolsa/blob/main/docs/limitations.md

## Licença

Apache-2.0. O DataBolsa é infraestrutura de dados, não recomendação de investimento.
