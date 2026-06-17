-- Carteira teórica vigente dos índices B3 (constituintes + peso % + qtde teórica),
-- via indexProxy/GetPortfolioDay. Um snapshot por índice; effective_date = data
-- da carteira no header da B3.
select
    index_code,
    effective_date,
    ticker,
    asset_name,
    type as asset_type,
    weight,
    theoretical_qty
from {{ source('raw_b3', 'index_composition') }}
where ticker is not null
