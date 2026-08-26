# @databolsa/advisor-mcp

[![npm version](https://img.shields.io/npm/v/@databolsa/advisor-mcp?color=cb3837&logo=npm)](https://www.npmjs.com/package/@databolsa/advisor-mcp)
[![license](https://img.shields.io/npm/l/@databolsa/advisor-mcp?color=2ea44f)](https://github.com/databolsahq/databolsa/blob/main/LICENSE)

🌐 **[advisor.databolsa.com](https://advisor.databolsa.com)** — o portal do escritório · [documentação](https://docs.databolsa.com/advisor)

Servidor [MCP](https://modelcontextprotocol.io) para a API do **DataBolsa
Advisor** — a camada organizacional para escritórios de assessoria,
consultorias e wealth managers.

Expõe as operações do contrato do Advisor como tools MCP (`advisor*`), para um
agente consultar e manter o escritório de forma determinística: organização,
membros e papéis, clientes e famílias, carteiras por cliente, ledger e trilha de
auditoria. As tools são geradas no startup a partir do contrato vivo e declaram
schemas de entrada e saída.

## Rodando

```bash
DATABOLSA_ADVISOR_API_KEY=db_org_SUACHAVE npx -y @databolsa/advisor-mcp
```

O transporte é `stdio`, esperado por clientes MCP locais como Claude Desktop e
Claude Code.

## Claude Desktop

```json
{
  "mcpServers": {
    "databolsa-advisor": {
      "command": "npx",
      "args": ["-y", "@databolsa/advisor-mcp"],
      "env": {
        "DATABOLSA_ADVISOR_API_KEY": "db_org_SUACHAVE"
      }
    }
  }
}
```

## Claude Code

```bash
claude mcp add databolsa-advisor \
  --env DATABOLSA_ADVISOR_API_KEY=db_org_SUACHAVE \
  -- npx -y @databolsa/advisor-mcp
```

Use `--scope local` para manter a chave fora de uma configuração committada.

## Configuração

| Variável | Default | Uso |
| --- | --- | --- |
| `DATABOLSA_ADVISOR_API_URL` | `https://api.databolsa.com` | Origem da API. |
| `DATABOLSA_ADVISOR_API_KEY` | vazio | Chave de organização (`db_org_…`) ou chave pessoal de membro (`db_live_…`). **Obrigatória.** |

Duas credenciais, dois enquadramentos: a **chave de organização** é a credencial
de serviço do escritório (escopo `full` opera como admin, `read` é só leitura);
a **chave pessoal de membro** segue o papel e a visibilidade de clientes do
assento daquela pessoa.

## Escopo das tools

Este servidor expõe **somente** as tools do Advisor. Para dados de mercado no
mesmo agente, adicione também o servidor `@databolsa/mcp`. O endpoint MCP
hospedado do escritório já traz as duas famílias num conector só —
veja a [documentação](https://docs.databolsa.com/advisor/mcp).

## Exemplo de prompt

```text
Liste os clientes ativos do escritório e me diga quais estão com mais de 40% em
renda variável. Não altere nada sem me perguntar antes.
```

## Segurança

- **Escopo é a organização.** Um recurso fora dela — ou fora da sua visibilidade
  de clientes — responde **404**, nunca 403. Um agente não deve inferir que um
  registro existe a partir do erro.
- **Licença trava escrita, não leitura.** Licença vencida responde **402** com
  `code: license_required` nas escritas; as leituras continuam.
- **Toda escrita é auditada**, com autor e origem. Confirme com o usuário antes
  de criar, alterar ou excluir.
- **Dados de cliente são dados pessoais** sob responsabilidade do escritório. Não
  copie nome, documento ou perfil para além do que a tarefa pede.

Consultas são somente leitura. O servidor não executa ordens nem movimenta
dinheiro.

## Pacotes relacionados

O SDK e a CLI expõem o mesmo contrato do Advisor em outros formatos:

```bash
npm install @databolsa/advisor-sdk
npm install -g @databolsa/advisor-cli
```

## Links

- Documentação: https://docs.databolsa.com/advisor
- Contrato OpenAPI: https://api.databolsa.com/openapi-advisor.json
- Referência navegável: https://docs.databolsa.com/advisor/api

## Licença

Apache-2.0. O DataBolsa é infraestrutura de dados, não recomendação de
investimento. A recomendação a um cliente final continua sendo responsabilidade
do profissional habilitado que usa a ferramenta.
