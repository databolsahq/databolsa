-- Benchmarks de "riqueza" base-100 para comparação maçã-com-maçã com o RETORNO
-- TOTAL das ações na tela Comparar (overlay rebaseado a 100). Dois benchmarks:
--
--   cdi_wealth  — R$1 rendendo a Selic-over DIÁRIA (série 11, % a.d., já decimal).
--                 Selic-over ≈ CDI; usamos a série 11 de propósito: é o fator
--                 diário canônico (docs/machine.md) e evita o pitfall de compor a
--                 série 4389 (CDI anualizada base-252) como se fosse diária.
--   ipca_wealth — correção monetária pelo IPCA (variação mensal 433 composta),
--                 reaproveitando int_macro__ipca_index.
--
-- Nível em base-100 na 1ª observação. Entra em mart_macro__series (source
-- 'benchmark') → servido por GET /v1/series/benchmark/{id}. O overlay no front
-- rebaseia ao início do período, então só as razões importam.

with selic_daily as (
    select date, value
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'selic_diaria'
),

cdi as (
    select
        'cdi_wealth' as series_id,
        date,
        100.0 * exp(sum(ln(1.0 + value)) over (order by date)) as value
    from selic_daily
),

ipca as (
    select
        'ipca_wealth' as series_id,
        date,
        100.0 * ipca_index as value
    from {{ ref('int_macro__ipca_index') }}
)

select series_id, date, value from cdi
union all
select series_id, date, value from ipca
