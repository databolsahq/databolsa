-- Séries SIDRA (última vintage): desemprego PNAD (trimestre móvel), PIB trimestral
-- e produção industrial (mensal). period_code: YYYYMM (mensal/trim. móvel = mês
-- final) ou YYYYQQ (PIB trimestral, QQ ∈ 01..04 → mês final do trimestre).
with snapshots as (
    select
        *,
        cast(regexp_extract(filename, 'snapshot_date=(\d{4}-\d{2}-\d{2})', 1) as date) as snapshot_date
    from {{ source('raw_ibge', 'sidra') }}
),

latest as (
    select * from snapshots
    qualify snapshot_date = max(snapshot_date) over (partition by series_name)
)

select
    series_name,
    "table" as sidra_table,
    case
        when series_name = 'pib_var_trimestral'
            then make_date(cast(period_code[1:4] as integer), cast(period_code[5:6] as integer) * 3, 1)
        else make_date(cast(period_code[1:4] as integer), cast(period_code[5:6] as integer), 1)
    end as period_month,
    period_name,
    valor as value,
    unit
from latest
where valor is not null
