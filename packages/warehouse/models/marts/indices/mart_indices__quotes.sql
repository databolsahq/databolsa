-- Níveis diários de fechamento de índices B3 (IBOV 1968+, IFIX 2011+) — serve
-- GET /v1/indices/{code}/quotes. A composição teórica do índice ainda não tem
-- fonte ingerida (só os níveis), então /composition permanece não servido.
select
    index_code as code,
    date,
    close
from {{ ref('stg_b3__indices') }}
where close is not null
order by code, date
