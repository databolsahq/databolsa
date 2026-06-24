-- Expectativas Focus de longo prazo (horizonte t+3 — "anos distantes"):
-- Selic e IPCA p/ juro neutro (Fisher), PIB p/ crescimento esperado (r−g).
with lp as (
    select
        survey_date,
        indicator,
        median / 100.0 as median_decimal
    from {{ ref('stg_bcb_focus__anuais') }}
    where horizon_years = 3 and indicator in ('selic', 'ipca', 'pib_total')
),

pivoted as (
    select
        survey_date,
        max(case when indicator = 'selic' then median_decimal end) as selic_lp,
        max(case when indicator = 'ipca' then median_decimal end) as ipca_lp,
        max(case when indicator = 'pib_total' then median_decimal end) as pib_lp
    from lp
    group by survey_date
)

select
    survey_date,
    selic_lp,
    ipca_lp,
    pib_lp,
    {{ fisher('selic_lp', 'ipca_lp') }} as juro_neutro
from pivoted
