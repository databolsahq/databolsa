-- Selic acumulada 12 meses: composição da série DIÁRIA 11 (% a.d.), nunca a
-- taxa corrente anualizada 1178 (docs/machine.md). Produto de (1+i_d) na janela
-- móvel de 12 meses, via soma de logs.
with daily as (
    select date, value
    from {{ ref('int_macro__series_decimal') }}
    where series_name = 'selic_diaria'
)

select
    date,
    exp(
        sum(ln(1.0 + value)) over (
            order by date
            range between interval 12 months preceding and current row
        )
    ) - 1.0 as selic_acum_12m
from daily
qualify date >= min(date) over () + interval 12 months
