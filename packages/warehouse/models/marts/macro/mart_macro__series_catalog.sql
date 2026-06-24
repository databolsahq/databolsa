-- Catálogo de séries (SeriesMeta) — uma linha por (source, series_id) com rótulo,
-- unidade, frequência e cobertura temporal derivada das próprias observações.
select
    'bcb_sgs' as source,
    cast(series_id as varchar) as series_id,
    any_value(series_name) as name,
    any_value(series_name) as label,
    any_value(unit) as unit,
    case
        when lower(any_value(frequency)) like 'd%' then 'daily'
        when lower(any_value(frequency)) like 'w%' or lower(any_value(frequency)) like 's%' then 'weekly'
        when lower(any_value(frequency)) like 'm%' then 'monthly'
        when lower(any_value(frequency)) like 'q%' or lower(any_value(frequency)) like 't%' then 'quarterly'
        when lower(any_value(frequency)) like 'a%' or lower(any_value(frequency)) like 'y%' then 'annual'
        else 'daily'
    end as frequency,
    min(date) as first_date,
    max(date) as last_date
from {{ ref('stg_bcb_sgs__series') }}
group by series_id

union all

-- benchmarks de riqueza base-100 (overlay da tela Comparar)
select
    'benchmark' as source,
    series_id,
    case series_id when 'cdi_wealth' then 'cdi_selic_riqueza' else 'ipca_riqueza' end as name,
    case series_id when 'cdi_wealth' then 'CDI / Selic (pós-fixado)' else 'IPCA (correção monetária)' end as label,
    'índice base-100' as unit,
    case series_id when 'cdi_wealth' then 'daily' else 'monthly' end as frequency,
    min(date) as first_date,
    max(date) as last_date
from {{ ref('mart_macro__wealth_indices') }}
group by series_id
