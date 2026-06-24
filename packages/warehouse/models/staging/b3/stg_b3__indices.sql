-- Níveis diários de índices B3 (IBOV 1968+, IFIX 2011+), validados contra
-- SGS 7 no overlap (99,1% idênticos em validação histórica).
select
    data as date,
    "index" as index_code,
    close
from {{ source('raw_b3', 'indices') }}
