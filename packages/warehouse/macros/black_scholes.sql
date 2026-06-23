{# Black-Scholes em SQL puro (DuckDB não tem erf). Snippets de expressão para
   compor d1/d2, densidade e CDF normal. IMPORTANTE: passe SEMPRE um nome de
   coluna (ex.: 'd1'), nunca a expressão crua de d1 — a CDF repete o argumento
   ~11x e duplicaria a expressão inteira. Calcule d1/d2 como colunas (aliases
   laterais do DuckDB) e então chame estes macros sobre elas. #}

{% macro bs_norm_pdf(x) -%}
(exp(-0.5*({{ x }})*({{ x }}))/sqrt(2*pi()))
{%- endmacro %}

{# Zelen & Severo (Abramowitz-Stegun 26.2.17): erro < 7.5e-8. Validado:
   N(1.96)=0.97500, N(0)=0.5, N(-1)=0.15866. #}
{% macro bs_norm_cdf(x) -%}
(case when ({{ x }}) >= 0
  then 1 - {{ bs_norm_pdf(x) }} * (
      (1/(1+0.2316419*({{ x }})))*0.319381530
    + power(1/(1+0.2316419*({{ x }})),2)*(-0.356563782)
    + power(1/(1+0.2316419*({{ x }})),3)*1.781477937
    + power(1/(1+0.2316419*({{ x }})),4)*(-1.821255978)
    + power(1/(1+0.2316419*({{ x }})),5)*1.330274429)
  else {{ bs_norm_pdf(x) }} * (
      (1/(1-0.2316419*({{ x }})))*0.319381530
    + power(1/(1-0.2316419*({{ x }})),2)*(-0.356563782)
    + power(1/(1-0.2316419*({{ x }})),3)*1.781477937
    + power(1/(1-0.2316419*({{ x }})),4)*(-1.821255978)
    + power(1/(1-0.2316419*({{ x }})),5)*1.330274429)
  end)
{%- endmacro %}

{% macro bs_d1(s, k, t, r, q, sig) -%}
((ln(({{ s }})/({{ k }})) + (({{ r }}) - ({{ q }}) + 0.5*({{ sig }})*({{ sig }}))*({{ t }})) / (({{ sig }})*sqrt({{ t }})))
{%- endmacro %}
