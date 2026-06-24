-- Rendimentos pagos por cota de FII (B3 FNET). Uma linha por (ticker, data-com)
-- após deduplicar re-emissões: mantém o documento ENTREGUE por último (re-filing
-- corrige valor/data sem apagar o anterior na origem). Só `rendimento` — amortização
-- (devolução de principal) não é yield e fica de fora do DY/distribuições.
with parsed as (
    select
        ticker,
        isin,
        cnpj,
        cast(ex_date as date) as ex_date,
        try_cast(payment_date as date) as payment_date,
        value_per_share,
        coalesce(tax_free, true) as tax_free,
        periodo_referencia,
        -- data_entrega vem 'DD/MM/YYYY HH:MM' — parse p/ ordenar re-emissões no tempo
        -- (sort lexical do texto trocaria meses); versao desempata no mesmo instante.
        try_strptime(data_entrega, '%d/%m/%Y %H:%M') as delivered_at,
        coalesce(versao, 0) as versao
    from {{ source('raw_fnet', 'fii_rendimentos') }}
    where kind = 'rendimento'
        and ticker is not null
        and ex_date is not null
        and value_per_share is not null
        and value_per_share > 0
)

select
    ticker,
    isin,
    cnpj,
    ex_date,
    payment_date,
    value_per_share,
    tax_free,
    periodo_referencia
from parsed
qualify row_number() over (
    partition by ticker, ex_date
    order by delivered_at desc nulls last, versao desc
) = 1
