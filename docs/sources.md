# Fontes De Dados

O DataBolsa prioriza fontes primarias, formatos reproduziveis e rastreabilidade.
A ingestao preserva a semantica original de cada fonte na raw zone; normalizacao,
calculos e decisoes de dominio ficam na camada dbt em `packages/warehouse`.

## Cobertura

| Dominio | Fonte | Conteudo | Observacoes |
|---|---|---|---|
| Macro Brasil | Banco Central SGS | Selic, CDI, IPCA, cambio, credito, divida, setor externo e series auxiliares | Series revisaveis podem ser versionadas como snapshots locais. |
| Expectativas | Banco Central Focus | Medianas, medias, dispersao e respondentes para IPCA, Selic, PIB e cambio | Usado para expectativa vs realizado e juro real ex-ante. |
| Atividade e inflacao | IBGE SIDRA | IPCA detalhado, PNAD, PIB trimestral, industria, comercio e servicos | Consultas respeitam limites da API SIDRA. |
| Renda fixa publica | Tesouro Direto | Precos, taxas e vencimentos de titulos publicos | Usado para curva nominal, curva real e breakeven de inflacao. |
| Companhias abertas | CVM DFP/ITR, cadastro, FCA, FRE, IPE | Demonstracoes financeiras, dados cadastrais, tickers, acoes emitidas e documentos corporativos | Indicadores usam demonstracoes consolidadas e versao mais recente por padrao. |
| FIIs | CVM FII | Cadastro, informes mensais e informacoes patrimoniais publicadas | Cobertura depende da publicacao dos informes pela CVM. |
| Mercado B3 | COTAHIST e dados publicos B3 | Cotacoes historicas, instrumentos, proventos e eventos disponiveis | Dados B3 devem ser tratados como fetch-your-own no modo self-hosted; redistribuicao depende dos termos aplicaveis. |
| Indices e intraday | Dados publicos B3 | Historico de indices e barras intraday quando disponiveis | Intraday e dados correntes sao mais sensiveis a disponibilidade da fonte. |
| Risco soberano | IPEADATA | EMBI+ Brasil historico | Serie historica util, mas pode nao representar nivel corrente quando a fonte deixa de atualizar. |
| Global | FRED | Fed Funds, Treasuries, commodities, DXY, VIX e benchmarks globais | Opcional; requer `FRED_API_KEY`. |
| Cripto | Binance | Pares BRL e USDT relevantes para comparacoes 24/7 | Fonte nao oficial brasileira; use conforme termos do provedor. |

## Como Os Dados Sao Gravados

- `packages/ingest` grava Parquet em `data/raw/<fonte>/...`.
- Cada dataset tem manifesto com URL de origem, timestamp, contagem de linhas,
  checksum e resultado de validacao.
- Reexecucoes sao idempotentes: a mesma particao e sobrescrita de forma
  deterministica, nao duplicada.
- Datasets historicos imutaveis podem ser pulados em execucoes seguintes;
  datasets vivos seguem regras de frescor por conector.

## Convencoes De Fonte

- CVM e B3 frequentemente usam CSV, arquivos compactados, colunas com nomes de
  origem e encodings legados; a raw zone preserva esses detalhes.
- Banco Central, IBGE, Tesouro e FRED geralmente expõem APIs ou CSVs mais
  estruturados, mas ainda exigem normalizacao de datas, unidades e ausencias.
- Comparacoes com sites como Fundamentus, StatusInvest ou Investidor10 sao usadas
  apenas como diagnostico. A fonte de verdade para fundamentos e a CVM; para
  precos e eventos, B3/COTAHIST e documentos oficiais.

## Limites Importantes

- Historico point-in-time so existe a partir do momento em que snapshots locais
  passam a ser coletados.
- Precos ajustados dependem da qualidade da cadeia de eventos societarios.
- Dados correntes e intraday podem ser perdidos se a ingestao diaria nao rodar.
- Redistribuicao de dados de terceiros nao e concedida por este repositorio; veja
  os termos de cada fonte.

Veja tambem [`docs/limitations.md`](limitations.md).
