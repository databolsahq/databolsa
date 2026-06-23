-- Tesouro Direto: PU e taxas por título/dia. Taxas mantidas em % a.a. (raw);
-- conversão p/ decimal acontece na camada intermediate.
select
    "Data Base" as base_date,
    "Tipo Titulo" as bond_type,
    "Data Vencimento" as maturity_date,
    date_diff('day', "Data Base", "Data Vencimento") / 365.25 as maturity_years,
    "Taxa Compra Manha" as buy_rate,
    "Taxa Venda Manha" as sell_rate,
    "PU Compra Manha" as pu_buy,
    "PU Venda Manha" as pu_sell,
    "PU Base Manha" as pu_base
from {{ source('raw_tesouro', 'tesouro_direto') }}
