# databolsa-warehouse

Camada de transformação do DataBolsa: dbt-core + DuckDB lendo o lake Parquet
(`data/raw/`) e materializando marts de serving em `data/marts/`.

```bash
uv sync
uv run dbt build          # tudo: staging, intermediate, marts, seeds, testes
uv run dbt test
uv run dbt docs generate && uv run dbt docs serve
```

Arquitetura pública: [docs/warehouse.md](../../docs/warehouse.md). Fórmulas:
[docs/machine.md](../../docs/machine.md) (macro) e
[docs/indicators.md](../../docs/indicators.md) (fundamentos). Cuidados de uso:
[docs/limitations.md](../../docs/limitations.md).

O que sai daqui (`data/marts/`):

| Mart | Conteúdo |
|---|---|
| `mart_macro__indicators` | ~70 indicadores macro derivados (formato longo, com `lineage`) — serving de `GET /v1/macro/*` |
| `mart_macro__regime` | quadrantes crescimento × inflação (Dalio) |
| `mart_fund__indicators` | 49 indicadores fundamentalistas por empresa/trimestre (screener) |
| `mart_fund__statements` | TTM + balanço limpos por (cnpj, trimestre) |
| `mart_fund__company` | cadastro: CNPJ ↔ tickers ↔ setor ↔ segmento ↔ free float |
| `mart_prices__adjusted` | OHLCV ajustado por eventos — **preparação**, usar só `adjust_quality='full'` |
