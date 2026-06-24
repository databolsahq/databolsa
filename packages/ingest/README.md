# databolsa-ingest

Extratores de dados brutos (raw zone) do DataBolsa.

## Uso

```bash
cd packages/ingest
uv sync
uv run databolsa-ingest list                 # fontes disponíveis
uv run databolsa-ingest run bcb_sgs          # extrai uma fonte
uv run databolsa-ingest run all              # extrai todas
uv run databolsa-ingest run all --force      # ignora idempotência e re-extrai
uv run databolsa-ingest validate all         # re-roda validadores nos parquets existentes
uv run pytest                                # testes offline (fixtures, sem rede)
```

Os dados são gravados em `<raiz do repo>/data/raw/<fonte>/<partição>/data.parquet`
(configurável via `DATABOLSA_DATA_ROOT`), com um `_manifest.json` por dataset
contendo URL de origem, timestamp, contagem de linhas, sha256 do payload e o
relatório de validação.

## Princípios de design

- **Raw zone fiel à fonte**: `parse()` só decodifica formato (encoding latin-1,
  fixed-width, vírgula decimal); nomes de colunas e semântica da fonte são
  preservados. Transformação (max VERSAO, preferir consolidado, TTM, preços
  ajustados) pertence à camada dbt (`packages/warehouse`).
- **Idempotente**: re-rodar sobrescreve a mesma partição de forma determinística
  (escrita atômica tmp+rename) — nunca appenda. Datasets imutáveis (ex.: COTAHIST
  de anos passados) nunca são re-baixados; os demais respeitam `max_age`.
- **Dados sempre são escritos**, mesmo com validação reprovada — o relatório fica
  no manifesto para auditoria e o exit code da CLI sinaliza a falha.
- **Sem modelos de domínio aqui**: o pacote usa dataclasses apenas para I/O dos
  conectores. Tipos de contrato e de API ficam fora da raw zone.

## Fontes implementadas

| Fonte | O quê | Partição |
|---|---|---|
| `bcb_sgs` | Séries macro configuradas (Selic, IPCA, câmbio, crédito, fiscal, externo) | `series_id=` |
| `bcb_focus` | Expectativas Focus (IPCA, Selic, PIB, câmbio) via Olinda/OData | `survey=/indicador=` |
| `bcb_copom` | Atas e documentos do Copom | raiz |
| `tesouro_direto` | Preços/taxas históricos dos títulos públicos | raiz |
| `b3_cotahist` | Cotações diárias 1998+ — ações (02), FIIs (12), ETFs (14), BDRs (34/35) | `year=` |
| `b3_indices` | Níveis diários de índices B3 | `index=/year=` |
| `b3_index_composition` | Carteira teórica vigente dos índices B3 | `index=` |
| `cvm_dfp_itr` | DFP (2010+)/ITR (2011+), todas as versões e escopos + cadastro | `dataset=/year=/statement=/scope=` |
| `cvm_fca` | Mapa ticker ↔ CNPJ ↔ segmento de listagem | `year=/table=` |
| `cvm_fre` | Capital social (nº de ações) e free float | `year=/table=` |
| `cvm_ipe` | Índice de documentos corporativos + PDFs de amostra (pilar LLM) | `year=` e `docs=sample` |
| `cvm_fii` | Registro de FIIs + informes mensais (PL, VP/cota, DY) | `dataset=/year=/table=` |
| `cvm_vlmo` | Movimentações de administradores/controladores | `year=/table=` |
| `b3_corporate_actions` | Proventos, desdobramentos/grupamentos, nº de ações | `dataset=/issuer=/table=` |
| `b3_intraday` | Minuto a minuto do pregão corrente (delay 15min), watchlist configurável | `ticker=/date=` |
| `crypto` | BTC/ETH/SOL em BRL via Binance — diário (histórico) e horário | `symbol=/interval=` |
| `ipeadata` | EMBI+ Brasil (risco-país, diário desde 1994) | `series=` |
| `ibge_sidra` | Desemprego PNAD, PIB trimestral, PIM-PF indústria | `table=` |
| `fred` | Fed Funds, Treasuries, commodities, DXY, VIX — **requer `FRED_API_KEY`** (gratuita; sem ela é pulado) | `series_id=` |

Ordem: rode `cvm_fca` antes de `b3_corporate_actions` (a lista de emissores deriva do FCA).
Fontes e cobertura: [docs/sources.md](../../docs/sources.md). Limitações públicas:
[docs/limitations.md](../../docs/limitations.md). Indicadores macro que esses dados
habilitam: [docs/machine.md](../../docs/machine.md).
