-- Carteira teórica vigente por índice (carteira mais recente quando há mais de um
-- snapshot). Serve GET /v1/indices/{code}/composition.
-- code, effective_date, ticker, asset_name, weight (%), theoretical_quantity.
with latest as (
    select index_code, max(effective_date) as effective_date
    from {{ ref('stg_b3__index_composition') }}
    group by index_code
)

select
    c.index_code as code,
    c.effective_date,
    c.ticker,
    c.asset_name,
    c.asset_type,
    c.weight,
    c.theoretical_qty as theoretical_quantity
from {{ ref('stg_b3__index_composition') }} as c
inner join latest as l
    on c.index_code = l.index_code and c.effective_date = l.effective_date
order by c.index_code, c.weight desc
