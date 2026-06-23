-- Índice acumulado do IPCA (base: primeiro mês da série = 1.0), a partir da
-- variação mensal (série 433). Usado p/ deflacionar (câmbio real proxy etc.).
with monthly as (
    select date, value as ipca_mensal
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'ipca'
)

select
    date,
    ipca_mensal,
    exp(sum(ln(1.0 + ipca_mensal)) over (order by date)) as ipca_index
from monthly
