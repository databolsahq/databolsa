-- Cadastro consolidado: CNPJ ↔ tickers ↔ setor ↔ segmento de listagem.
with tickers as (
    select
        cnpj,
        string_agg(ticker, ',' order by ticker) as tickers,
        max(segment) as listing_segment,
        bool_or(is_active) as has_active_ticker
    from {{ ref('int_fund__ticker_map') }}
    group by 1
),

free_float as (
    select
        "CNPJ_Companhia" as cnpj,
        "Percentual_Total_Acoes_Circulacao" as free_float_pct
    from {{ source('raw_cvm', 'fre_distribuicao_capital') }}
    qualify row_number() over (
        partition by "CNPJ_Companhia"
        order by "Data_Referencia" desc, "Versao" desc
    ) = 1
),

-- nº de ações vigente (FRE capital): registro mais recente por CNPJ
shares as (
    select cnpj, on_shares, pn_shares, total_shares
    from {{ ref('int_fund__shares') }}
    qualify row_number() over (partition by cnpj order by approval_date desc) = 1
)

select
    c.cnpj,
    c.cd_cvm,
    c.company_name,
    c.sector,
    c.status,
    c.issuer_status,
    c.ownership_control,
    t.tickers,
    t.listing_segment,
    t.has_active_ticker,
    f.free_float_pct,
    s.on_shares,
    s.pn_shares,
    s.total_shares
from {{ ref('stg_cvm__cadastro') }} as c
left join tickers as t on c.cnpj = t.cnpj
left join free_float as f on c.cnpj = f.cnpj
left join shares as s on c.cnpj = s.cnpj
