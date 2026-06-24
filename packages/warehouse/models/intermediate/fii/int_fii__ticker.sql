-- ISIN → ticker para FIIs (COTAHIST codbdi 12). O informe mensal da CVM traz o
-- Codigo_ISIN das cotas; este modelo resolve ao ticker negociado mais recente.
select
    isin,
    ticker,
    max(date) as last_traded
from {{ ref('stg_b3__cotahist') }}
where codbdi = '12' and isin is not null
group by isin, ticker
qualify row_number() over (partition by isin order by max(date) desc) = 1
