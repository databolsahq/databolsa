# Fontes De Dados

O DataBolsa prioriza fontes primarias, oficiais e documentadas para o mercado
financeiro brasileiro. Cada resposta da API carrega a fonte e a data de
referencia do dado, para que voce possa auditar a origem de qualquer numero.

## Cobertura

| Dominio | Fonte | Conteudo | Observacoes |
|---|---|---|---|
| Macro Brasil | Banco Central SGS | Selic, CDI, IPCA, cambio, credito, divida, setor externo e series auxiliares | Series revisaveis podem ser versionadas como snapshots historicos. |
| Expectativas | Banco Central Focus | Medianas, medias, dispersao e respondentes para IPCA, Selic, PIB e cambio | Usado para expectativa vs realizado e juro real ex-ante. |
| Atividade e inflacao | IBGE SIDRA | IPCA detalhado, PNAD, PIB trimestral, industria, comercio e servicos | Consultas respeitam limites da API SIDRA. |
| Renda fixa publica | Tesouro Direto | Precos, taxas e vencimentos de titulos publicos | Usado para curva nominal, curva real e breakeven de inflacao. |
| Companhias abertas | CVM DFP/ITR, cadastro, FCA, FRE, IPE | Demonstracoes financeiras, dados cadastrais, tickers, acoes emitidas e documentos corporativos | Indicadores usam demonstracoes consolidadas e versao mais recente por padrao. |
| FIIs | CVM FII | Cadastro, informes mensais e informacoes patrimoniais publicadas | Cobertura depende da publicacao dos informes pela CVM. |
| Mercado B3 | COTAHIST e dados publicos B3 | Cotacoes historicas, instrumentos, proventos e eventos disponiveis | Redistribuicao de dados B3 segue os termos aplicaveis da propria B3. |
| Indices e intraday | Dados publicos B3 | Historico de indices e barras intraday quando disponiveis | Intraday e dados correntes sao mais sensiveis a disponibilidade da fonte. |
| Risco soberano | IPEADATA | EMBI+ Brasil historico | Serie historica util, mas pode nao representar nivel corrente quando a fonte deixa de atualizar. |
| Global | FRED | Fed Funds, curva Treasury completa, inflacao/emprego/atividade dos EUA, commodities, DXY, VIX | Series complementares para comparacoes internacionais. |
| Macro mundial | World Bank Open Data | PIB, inflacao, desemprego, divida e setor externo das principais economias | Licenca CC BY 4.0; series anuais revisaveis versionadas como snapshots. |
| EUA — fundamentos e documentos | SEC EDGAR | Receita, lucro e LPA "as filed" (XBRL) e filings 10-K/10-Q/8-K com link oficial | Fonte oficial do regulador americano; acesso conforme a politica de fair access. |
| EUA — precos | Fontes publicas consolidadas | Fechamento diario em USD de acoes S&P 500/Nasdaq-100 e ETFs, ajustado por desdobramento | Universo pinado e auditavel; sem dados intraday. |
| Cripto | Binance | Pares BRL e USDT das ~100 maiores; velas diarias e snapshot quase-live (~1 min) | Fonte nao oficial brasileira; use conforme termos do provedor. |

## Convencoes De Fonte

- CVM e a fonte de verdade para fundamentos e dados cadastrais; B3/COTAHIST e
  documentos oficiais sao a fonte de verdade para precos e eventos.
- Banco Central, IBGE, Tesouro e FRED expõem series macro, expectativas e renda
  fixa publica.
- Comparacoes com sites como Fundamentus, StatusInvest ou Investidor10 sao
  usadas apenas como diagnostico externo — nao substituem a fonte oficial nem
  definem a metodologia do DataBolsa.

## Limites Importantes

- Historico point-in-time so existe a partir do momento em que passou a ser
  coletado; nao ha reconstrucao retroativa de snapshots passados.
- Precos ajustados dependem da qualidade da cadeia de eventos societarios.
- Dados correntes e intraday podem apresentar lacunas quando a fonte de origem
  atrasa a publicacao ou fica indisponivel.
- Redistribuicao de dados de terceiros nao e concedida por este repositorio;
  veja os termos de cada fonte.

Veja tambem [`docs/limitations.md`](limitations.md).
