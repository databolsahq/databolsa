-- OHLCV diário B3 (COTAHIST 1998+). CODBDI: 02 lote padrão (ações), 12 FII,
-- 14 ETF, 34/35 BDR. fatcot = fator de cotação (preço por 1 ou por 1000).
select
    data as date,
    codneg as ticker,
    codbdi,
    nomres as trading_name,
    especi as spec,
    codisi as isin,
    preabe as open,
    premax as high,
    premin as low,
    premed as avg_price,
    preult as close,
    totneg as trades,
    quatot as quantity,
    voltot as volume_brl,
    fatcot as quote_factor
from {{ source('raw_b3', 'cotahist') }}
