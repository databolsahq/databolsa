# Limitacoes Conhecidas

O DataBolsa busca dados auditaveis e metodologia aberta, mas algumas limitacoes
sao inerentes as fontes publicas e ao modo self-hosted.

## Licencas E Redistribuicao

Este repositorio distribui codigo e metodologia. Ele nao concede permissao para
redistribuir dados de terceiros. Quem opera o pipeline deve respeitar os termos de
uso de CVM, B3, Banco Central, IBGE, Tesouro, FRED, Binance e demais provedores.

## Precos Ajustados

Precos ajustados dependem de uma cadeia completa e correta de eventos societarios.
Quando a fonte de eventos e incompleta, o historico ajustado pode ficar incorreto
para backtests, retorno total, beta, volatilidade e graficos rebased.

Use campos de qualidade, como `adjust_quality`, antes de confiar em series
ajustadas. Historicos sem cadeia confiavel devem ser tratados como preparatorios
ou apenas informativos.

## Point-In-Time E Reapresentacoes

Indicadores de exibicao normalmente usam a versao mais recente das demonstracoes
CVM. Isso e adequado para ver o melhor dado conhecido hoje, mas pode introduzir
look-ahead bias em estudos historicos.

Snapshots point-in-time so existem a partir do momento em que a ingestao diaria
comeca a rodar no ambiente do operador. Dias sem execucao podem gerar buracos em
series revisaveis e dados efemeros.

## Frescor

Fontes tem calendarios e atrasos diferentes. FIIs recentes, documentos
corporativos, informes mensais, dados intraday e series revisaveis podem aparecer
com defasagem ou lacunas. A API deve expor datas de referencia para que o
consumidor julgue frescor.

## Metodologia De Terceiros

Sites de referencia sao uteis para diagnostico, mas nao sao fonte de verdade.
Divergencias podem vir de janelas diferentes, ajustes proprietarios, tratamento de
JCP/dividendos, uso de demonstrativos anuais vs TTM, ou definicoes distintas de
EBIT, FFO, cap rate e ROIC.

## Cobertura Parcial

Nem todo endpoint planejado precisa estar servido em uma instalacao local. Nem
todo ativo tera todos os indicadores, especialmente quando faltam informes,
liquidez, quantidade de acoes confiavel, eventos societarios ou demonstracoes
comparaveis.

## Nao E Recomendacao

Os dados e indicadores sao ferramentas de pesquisa. Eles nao constituem
recomendacao de investimento, consultoria financeira, promessa de retorno ou
substituto para verificacao independente.
