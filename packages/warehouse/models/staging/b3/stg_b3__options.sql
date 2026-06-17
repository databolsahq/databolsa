-- Opções sobre ações da B3 (COTAHIST: tpmerc 070=call/080=put, codbdi 78/82).
-- O connector já decodificou strike (preexe/100), vencimento (datven), tipo e a
-- raiz de 4 letras do subjacente. Aqui só tipamos/renomeamos para o grão de série.
select
    codneg as option_ticker,
    underlying_root,
    option_type,                              -- call | put
    strike,
    datven as expiry,
    data as date,
    preabe as open,
    premax as high,
    premin as low,
    preult as last,
    voltot as volume_brl,
    totneg as trades,
    quatot as quantity,
    codisi as isin
from {{ source('raw_b3', 'cotahist_options') }}
where strike > 0 and expiry is not null
