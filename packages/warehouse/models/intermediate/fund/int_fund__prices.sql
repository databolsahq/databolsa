-- Preço de fechamento e liquidez por ticker (ações lote padrão + units).
-- CODBDI 02 = lote padrão; units aparecem como 02 também. Inclui volume p/
-- escolher a classe mais líquida no market cap.
select
    ticker,
    date,
    close,
    volume_brl,
    isin
from {{ ref('stg_b3__cotahist') }}
where codbdi = '02'
