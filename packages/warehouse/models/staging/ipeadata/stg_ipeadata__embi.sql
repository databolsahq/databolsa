-- EMBI+ Brasil em pontos-base. Fonte descontinuada em jul/2024 — histórico
-- 1994–2024; nunca tratar como série viva.
select
    data as date,
    series_name,
    valor as value,
    unit
from {{ source('raw_ipeadata', 'ipeadata') }}
where series_name = 'embi_br' and valor is not null
