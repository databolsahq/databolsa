# Maquina Economica Brasileira

O DataBolsa organiza indicadores macro em uma leitura de regime economico:
crescimento, inflacao, juros, credito, fiscal, setor externo e condicoes globais.
A ideia e tornar a analise reproduzivel e rastreavel, nao produzir uma previsao
caixa-preta.

## Blocos De Indicadores

| Bloco | Exemplos | Fontes principais |
|---|---|---|
| Politica monetaria | Selic meta, Selic efetiva, CDI, ciclo Copom | BCB SGS |
| Juro real | Selic real ex-ante, Selic real ex-post, curva real | BCB SGS, Focus, Tesouro Direto |
| Inflacao | IPCA, IGP-M, INPC, expectativas e surpresa inflacionaria | BCB SGS, Focus, IBGE SIDRA |
| Atividade | IBC-Br, PIB trimestral, producao industrial, comercio, servicos | BCB SGS, IBGE SIDRA |
| Mercado de trabalho | Desemprego e tendencia | IBGE SIDRA |
| Credito | Credito/PIB, inadimplencia, spreads, endividamento das familias | BCB SGS |
| Fiscal | Divida bruta/PIB, divida liquida/PIB, custo real de rolagem | BCB SGS, Tesouro Direto |
| Setor externo | Conta corrente, IDP, reservas, cambio, balanca comercial | BCB SGS |
| Global | Fed Funds, Treasuries, commodities, dolar global, VIX | FRED |
| Cross-asset | DY vs Selic, premio de risco, curva real vs prefixada | B3, CVM, Tesouro, BCB |

## Regime Crescimento X Inflacao

O endpoint de regime macro classifica o ambiente em quadrantes de crescimento e
inflacao. Cada sinal deve carregar valor, direcao, data de referencia, unidade e
linhagem para a fonte que o sustenta.

| Crescimento | Inflacao | Leitura comum |
|---|---|---|
| Acelerando | Subindo | Expansao com pressao inflacionaria |
| Acelerando | Caindo | Expansao desinflacionaria |
| Desacelerando | Subindo | Estagflacao ou aperto de condicoes |
| Desacelerando | Caindo | Desaceleracao desinflacionaria |

A classificacao e uma sintese dos dados disponiveis. Ela nao recomenda carteira,
nao substitui analise propria e pode mudar quando novas leituras ou revisoes forem
publicadas.

## Principios De Implementacao

- Cada indicador macro deve ser derivado de series documentadas e auditaveis.
- Taxas devem ter unidade explicita; misturar percentual anual, mensal, diario e
  pontos-base sem conversao e erro de modelagem.
- Expectativa e realizado devem preservar suas datas de conhecimento para evitar
  vies de look-ahead.
- Quando uma fonte deixa de atualizar, a serie historica pode continuar util, mas
  o nivel corrente deve ser marcado como limitado ou substituido por outra fonte.

## Disponibilidade

Nem todos os blocos precisam estar completos para a API servir dados uteis. O
consumidor deve tratar ausencias como parte normal da analise macro: series podem
ter periodicidades diferentes, revisoes, atrasos de publicacao e lacunas.

Veja [`docs/sources.md`](sources.md) para fontes e [`docs/indicators.md`](indicators.md)
para convencoes de formula.
