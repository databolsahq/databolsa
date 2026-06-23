# Indicadores E Metodologia

Este documento resume as convencoes publicas dos indicadores do DataBolsa. A
implementacao fica nos modelos dbt de `packages/warehouse`; a API apenas serve os
marts materializados.

## Convencoes Gerais

- Demonstracoes de resultado e fluxo de caixa usam TTM quando aplicavel.
- Balanco patrimonial usa o periodo mais recente disponivel para a data de
  avaliacao.
- Para exibicao, o DataBolsa usa a versao mais recente da CVM e demonstracoes
  consolidadas quando existem.
- Endpoints ou modelos point-in-time/as-of devem ser tratados separadamente; nao
  assuma que uma serie de exibicao e propria para backtest historico.
- Campos monetarios seguem a moeda informada na fonte. Percentuais e taxas devem
  ser interpretados pelo campo `unit` ou pela documentacao do endpoint.
- Valores impossiveis ou sem base confiavel devem ser `null`, nao zero.

## Contas CVM Mais Usadas

| Item | Conta CVM padrao | Uso |
|---|---|---|
| Receita liquida | `3.01` | Margens, PSR, crescimento |
| Lucro bruto | `3.03` | Margem bruta |
| EBIT as-filed | `3.05` | Margem EBIT, EV/EBIT, ROIC |
| Lucro liquido | `3.11` | P/L, LPA, ROE |
| Caixa operacional | `6.01` | Fluxo de caixa operacional |
| Investimentos / CAPEX | `6.02` e contas relacionadas | FCF |
| Patrimonio liquido | `2.03` ou mapeamento por descricao | P/VP, VPA, ROE |
| Divida bruta | contas de emprestimos e financiamentos | Alavancagem |
| Caixa e equivalentes | `1.01.01` e aplicacoes financeiras | Divida liquida |

Bancos e instituicoes financeiras podem usar planos de contas diferentes. Nesses
casos, a camada de transformacao prioriza descricao e semantica da conta, nao
apenas codigo numerico.

## Formulas Principais

| Indicador | Formula resumida |
|---|---|
| Valor de mercado | `preco * numero_de_acoes` |
| Divida bruta | `divida_curto_prazo + divida_longo_prazo` |
| Divida liquida | `divida_bruta - caixa - aplicacoes_financeiras` |
| Enterprise value | `valor_de_mercado + divida_liquida` |
| EBITDA | `EBIT + depreciacao_e_amortizacao` |
| FCF | `caixa_operacional - CAPEX` |
| P/L | `valor_de_mercado / lucro_liquido_ttm` |
| P/VP | `valor_de_mercado / patrimonio_liquido` |
| EV/EBITDA | `enterprise_value / ebitda_ttm` |
| Margem bruta | `lucro_bruto_ttm / receita_liquida_ttm` |
| Margem EBIT | `ebit_ttm / receita_liquida_ttm` |
| Margem liquida | `lucro_liquido_ttm / receita_liquida_ttm` |
| ROE | `lucro_liquido_ttm / patrimonio_liquido` |
| ROIC | `NOPAT / capital_investido` |
| Liquidez corrente | `ativo_circulante / passivo_circulante` |
| Dividend yield | `proventos_12m_por_acao / preco` |
| Payout | `proventos_12m / lucro_liquido_ttm` |

## Decisoes Metodologicas

### EBIT

O EBIT padrao e a conta CVM `3.05`, isto e, o resultado antes do resultado
financeiro e dos tributos conforme reportado. Essa escolha privilegia
rastreabilidade ao demonstrativo oficial.

Sites brasileiros podem calcular um EBIT ajustado, excluindo partes de outras
receitas/despesas operacionais. Divergencias em `P/EBIT`, `EV/EBIT`,
`EV/EBITDA`, `Margem EBIT` e `ROIC` podem ser definicionais, nao necessariamente
erros de dados.

### Dividendos E JCP

Dividend yield soma dividendos e juros sobre capital proprio no periodo definido
pelo modelo. A interpretacao de bruto/liquido, data-com, ex-date e data de
pagamento deve ser explicita no endpoint ou mart usado.

### FIIs

Indicadores de FIIs dependem dos informes mensais e trimestrais publicados. A
cobertura de fundos recentes pode aparecer com defasagem ate que os informes
estejam disponiveis.

### Macro

Juros reais usam a forma de Fisher quando possivel:

```text
juro_real = (1 + taxa_nominal) / (1 + inflacao) - 1
```

Subtracao simples entre taxa nominal e inflacao deve ser tratada apenas como
aproximacao.

## Uso Em Analises

- Indicadores de exibicao sao bons para screener, comparacao e pesquisa.
- Backtests exigem cuidado com revisoes de demonstrativos, eventos societarios,
  disponibilidade historica e datas de conhecimento.
- Sempre confira `lineage`, data de referencia, unidade e qualidade do dado antes
  de automatizar decisoes.

Veja tambem [`docs/limitations.md`](limitations.md).
