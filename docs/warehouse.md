# Camada De Transformacao

`packages/warehouse` usa dbt-core + DuckDB para transformar a raw zone Parquet em
marts de serving. A API nao calcula indicadores financeiros diretamente; ela le os
marts carregados no Postgres.

## Fluxo

```text
fontes publicas
  -> packages/ingest
  -> data/raw/*.parquet
  -> packages/warehouse (dbt + DuckDB)
  -> data/marts/*.parquet
  -> scripts/load_postgres.py
  -> Postgres/TimescaleDB
  -> packages/api
```

## Por Que DuckDB E Postgres

| Camada | Papel |
|---|---|
| DuckDB | Motor analitico local para ler Parquet, executar dbt e materializar marts. |
| Postgres/TimescaleDB | Banco de serving para concorrencia, API, paginacao e operacao online. |

DuckDB e usado para transformacao; Postgres e usado para servir consumidores.
Essa separacao mantem a API fina e evita duplicar logica de negocio fora do dbt.

## Comandos

```bash
cd packages/warehouse
uv sync
uv run dbt build
uv run dbt test
uv run dbt docs generate && uv run dbt docs serve
```

Da raiz do repositorio, os scripts equivalentes podem ser chamados via `bun run`
quando configurados no `package.json`.

## Organizacao Dos Modelos

| Camada dbt | Responsabilidade |
|---|---|
| `staging` | Casts, renomes, limpeza mecanica e exposicao fiel da fonte. |
| `intermediate` | Normalizacao de dominio, janelas TTM, pivots, joins e series derivadas. |
| `marts` | Tabelas finais de serving com grao, unidade, datas e linhagem estaveis. |

Convencao de nomes:

```text
stg_<fonte>__<entidade>
int_<dominio>__<descricao>
mart_<dominio>__<entidade>
```

## Marts Publicos Principais

| Mart | Conteudo |
|---|---|
| `mart_fund__company` | Cadastro de companhias, tickers, setor e metadados. |
| `mart_fund__statements` | Demonstrativos normalizados por companhia e periodo. |
| `mart_fund__indicators` | Indicadores fundamentalistas por companhia/data. |
| `mart_fund__paper_indicators` | Indicadores por papel quando o grao por ticker importa. |
| `mart_fii__*` | Indicadores e informacoes de FIIs. |
| `mart_macro__indicators` | Indicadores macro em formato longo. |
| `mart_macro__regime` | Classificacao sintetica de regime macro. |
| `mart_prices__adjusted` | Precos ajustados por eventos, `close_tr` de retorno total e sinalizacao de qualidade. |

## Qualidade E Linhagem

- Testes dbt devem cobrir chaves, unicidade, ranges economicos plausiveis,
  recencia e valores de referencia quando apropriado.
- Marts devem expor data de referencia e, quando aplicavel, `lineage` para a
  fonte ou particao bruta usada.
- Flags de qualidade, como qualidade de ajuste de preco ou de quantidade de
  acoes, devem ser preservadas ate a API.
- Dados ausentes ou semanticamente invalidos devem sair como `null`, nao como
  zeros silenciosos.

## Regras De Dominio

- A raw zone nao deve conter logica de negocio: ela preserva a fonte.
- A warehouse e a fonte de verdade para formulas e convencoes.
- A API, SDK, CLI e MCP sao consumidores finos do contrato e dos marts.
- Mudancas de formula devem ser documentadas em [`docs/indicators.md`](indicators.md).

Veja tambem [`docs/limitations.md`](limitations.md).
