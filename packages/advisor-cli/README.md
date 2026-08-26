# @databolsa/advisor-cli

[![npm version](https://img.shields.io/npm/v/@databolsa/advisor-cli?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-cli)
[![license](https://img.shields.io/npm/l/@databolsa/advisor-cli?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

🌐 **[advisor.databolsa.com](https://advisor.databolsa.com)** — o portal do escritório · [documentação](https://docs.databolsa.com/advisor)

CLI para a API do **DataBolsa Advisor** — a camada organizacional para
escritórios de assessoria, consultorias e wealth managers: organizações, membros
e papéis, clientes e famílias, carteiras por cliente e trilha de auditoria.

A CLI gera um comando por operação do contrato no startup. Ela é
intencionalmente fina: resolve parâmetros, chama a API e renderiza a resposta.

## Instalação

```bash
npm install -g @databolsa/advisor-cli
```

Ou sem instalar globalmente:

```bash
npx -y @databolsa/advisor-cli advisorGetMe
```

## Uso rápido

```bash
export DATABOLSA_ADVISOR_API_KEY=db_org_SUACHAVE

databolsa-advisor --list                                # todos os comandos
databolsa-advisor advisorGetMe                          # quem sou e onde posso agir
databolsa-advisor advisorGetOverview meu-escritorio     # panorama do escritório
databolsa-advisor advisorListClients meu-escritorio
databolsa-advisor advisorGetClientPortfolio meu-escritorio <portfolioId> --json | jq .totals
databolsa-advisor advisorListAuditLog meu-escritorio --limit 50
```

Toda operação, exceto as de conta, recebe o identificador da organização
(`slug` ou `id`) como primeiro argumento. `advisorGetMe` lista em quais
organizações a credencial pode agir.

Escritas viram comandos do mesmo jeito — e mexem no dado **real** do escritório:

```bash
databolsa-advisor advisorCreateClient meu-escritorio --name "Maria Souza" --email maria@example.com
databolsa-advisor advisorCreateInvitation meu-escritorio --email novo@escritorio.com --role advisor
databolsa-advisor advisorImportClientPortfolioFile meu-escritorio <portfolioId> --file negociacao.xlsx
```

Em uploads, `--file <caminho>` lê o arquivo local e preenche `content_base64` e
`filename` por você.

Por padrão, objetos saem em formato chave/valor e listas como tabelas compactas.
Use `--json` para JSON bruto em `jq`, arquivos ou scripts.

## Configuração

| Variável | Default | Uso |
| --- | --- | --- |
| `DATABOLSA_ADVISOR_API_URL` | `https://api.databolsa.com` | Origem da API. |
| `DATABOLSA_ADVISOR_API_KEY` | vazio | Chave de organização (`db_org_…`) ou chave pessoal de membro (`db_live_…`). **Obrigatória.** |

Flags globais:

| Flag | Uso |
| --- | --- |
| `--json` | Imprime JSON bruto. |
| `--api-url <url>` | Sobrescreve `DATABOLSA_ADVISOR_API_URL`. |
| `--list` | Lista as operações do contrato vivo. |
| `--help`, `-h` | Ajuda geral ou de um comando. |
| `--version` | Versão da CLI. |

A ajuda dos comandos é gerada a partir do contrato:

```bash
databolsa-advisor advisorCreateClient --help
```

## Códigos de saída

| Código | Significado |
| --- | --- |
| 0 | OK. |
| 1 | Erro da API ou erro inesperado. |
| 2 | Erro de uso, como comando, opção ou argumento inválido. |
| 3 | Endpoint ou recurso indisponível. |

## Comportamento que vale em todo comando

- **Escopo é a organização.** Um recurso fora dela — ou fora da sua visibilidade
  de clientes — responde **404**, nunca 403. Não conclua que um registro existe a
  partir do erro.
- **Licença trava escrita, não leitura.** Licença vencida responde **402** com
  `code: license_required` nas escritas; as leituras continuam.
- **Toda escrita é auditada**, com autor e origem.
- **Posição é derivada.** As posições de uma carteira saem do ledger de
  transações somado à cotação de mercado. Para corrigir uma posição, corrija o
  lançamento.

## Agent Skill

Instale a skill pública para que agentes descubram e usem a CLI com segurança —
consultando o contrato atual e confirmando antes de escrever:

```bash
npx skills add databolsahq/databolsa --skill databolsa-advisor-cli
```

A skill requer Node.js 18+, rede e `DATABOLSA_ADVISOR_API_KEY` no ambiente.

## Pacotes relacionados

O SDK e o servidor MCP expõem o mesmo contrato do Advisor em outros formatos:

```bash
npm install @databolsa/advisor-sdk
npx -y @databolsa/advisor-mcp
```

Para dados de mercado (ações, FIIs, fundos, crédito, macro), use
`@databolsa/cli`.

## Links

- Documentação: https://docs.databolsa.com/advisor
- Contrato OpenAPI: https://api.databolsa.com/openapi-advisor.json
- Referência navegável: https://docs.databolsa.com/advisor/api

## Licença

Apache-2.0. O DataBolsa é infraestrutura de dados, não recomendação de
investimento. A CLI não executa ordens nem movimenta dinheiro; a recomendação a
um cliente final continua sendo responsabilidade do profissional habilitado que
usa a ferramenta.
