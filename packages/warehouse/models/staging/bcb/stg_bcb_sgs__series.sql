-- Visão "corrente" de todas as séries SGS: estáticas + última vintage das revisáveis.
with static_series as (
    select
        data as date,
        series_id,
        series_name,
        valor as value,
        unit,
        frequency,
        false as revisable
    from {{ source('raw_bcb', 'sgs_static') }}
),

latest_vintage as (
    select
        date,
        series_id,
        series_name,
        value,
        unit,
        frequency,
        true as revisable
    from {{ ref('stg_bcb_sgs__vintages') }}
    qualify snapshot_date = max(snapshot_date) over (partition by series_id)
)

select * from static_series
union all
select * from latest_vintage
