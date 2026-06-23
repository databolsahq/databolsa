-- Spot-checks contra valores publicados (seed golden_values):
-- PETR4 31,08 em 2025-06-02 (brapi.dev), Selic meta pós-Copom
-- dez/2023, IPCA acumulado 2023. Falha se desviar além da tolerância.
with actuals as (
    select 'petr4_close' as check_id, date as ref_date, close as actual
    from {{ ref('stg_b3__cotahist') }}
    where ticker = 'PETR4' and date = date '2025-06-02'

    union all

    select 'selic_meta', date, value
    from {{ ref('stg_bcb_sgs__series') }}
    where series_id = 432 and date = date '2023-12-29'

    union all

    select 'ipca_acum_12m', date, value
    from {{ ref('stg_bcb_sgs__series') }}
    where series_id = 13522 and date = date '2023-12-01'
)

select
    g.check_id,
    g.expected_value,
    a.actual,
    g.note
from {{ ref('golden_values') }} as g
left join actuals as a on g.check_id = a.check_id
where a.actual is null
    or abs(a.actual - g.expected_value) / g.expected_value > g.tolerance_pct / 100.0
