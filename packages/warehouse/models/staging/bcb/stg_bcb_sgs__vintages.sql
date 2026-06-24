-- Todas as vintages das séries SGS revisáveis (point-in-time).
-- snapshot_date só existe no path (a coluna series_id já vem no arquivo).
select
    data as date,
    data_fim as period_end_date,
    series_id,
    series_name,
    valor as value,
    unit,
    frequency,
    cast(regexp_extract(filename, 'snapshot_date=(\d{4}-\d{2}-\d{2})', 1) as date) as snapshot_date
from {{ source('raw_bcb', 'sgs_vintages') }}
