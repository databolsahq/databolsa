-- Todas as séries macro (SGS + FRED + Ipeadata) em formato longo, com valores
-- convertidos para DECIMAL (a.a./a.m. conforme a série) segundo o seed
-- macro_series_catalog: % → /100, bps → /10000, níveis inalterados.
-- Convenção do docs/machine.md: a camada derivada NUNCA mistura % com decimal.
with catalog as (
    select * from {{ ref('macro_series_catalog') }}
),

unioned as (
    select
        date,
        'bcb_sgs' as source,
        cast(series_id as varchar) as series_key,
        value
    from {{ ref('stg_bcb_sgs__series') }}
    where value is not null

    union all

    select date, 'fred' as source, series_id as series_key, value
    from {{ ref('stg_fred__series') }}

    union all

    select date, 'ipeadata' as source, 'embi_br' as series_key, value
    from {{ ref('stg_ipeadata__embi') }}
)

select
    u.date,
    u.source,
    u.series_key,
    c.series_name,
    u.value as value_raw,
    case c.conversion
        when 'pct' then u.value / 100.0
        when 'bps' then u.value / 10000.0
        when 'mil' then u.value / 1000.0  -- R$ mil → R$ milhões (agregados M1–M4)
        else u.value
    end as value,
    c.unit_raw,
    c.frequency,
    c.revisable
from unioned as u
inner join catalog as c
    on u.source = c.source and u.series_key = c.series_key
