-- Proventos em dinheiro: UNIÃO de duas fontes B3 (campos string na origem):
-- 1. cash_dividends_deep (GetListedCashDividends por tradingName): histórico
--    completo, 746 emissores INCL. delistadas (sem survivorship) — mas alguns
--    emissores têm gaps após troca de razão social (ex.: ABEV para em 2013);
-- 2. supplement/cash_dividends: janela rolante ~12m da B3 (cobre o presente).
-- Dedupe por (issuer, classe, data-com, tipo, valor) — deep vence no overlap.
-- value_per_share = valor ÷ base de cotação (1 ou 1000 ações).
with deep as (
    select
        issuer,
        -- canonicaliza o nome da unit p/ 'UNIT' (deep usa 'UNT'); ON/PN/PNA/PNB
        -- ficam como estão (mart_prices__adjusted depende de PNA→5/PNB→6).
        case when "typeStock" = 'UNT' then 'UNIT' else "typeStock" end as share_class,
        case "corporateAction"
            when 'JRS CAP PROPRIO' then 'JCP'
            else "corporateAction"   -- DIVIDENDO | RENDIMENTO
        end as dividend_type,
        cast(strptime("dateApproval", '%d/%m/%Y') as date) as approval_date,
        cast(strptime(nullif("lastDatePriorEx", ''), '%d/%m/%Y') as date) as last_cum_date,
        -- o crawl deep não traz data de pagamento (só aprovação/data-com)
        cast(null as date) as payment_date,
        value_cash_parsed
            / nullif(cast(nullif("quotedPerShares", '') as double), 0) as value_per_share,
        try_cast(replace(nullif("closingPricePriorExDate", ''), ',', '.') as double) as close_before_ex,
        'deep' as source_dataset
    from {{ source('raw_b3', 'ca_cash_dividends_deep') }}
    where value_cash_parsed is not null
),

-- classe a partir do ISIN (BR + emissor(4) + tipo): ACNOR=ON, ACNPR=PN,
-- CDA(M) = Certificado de Depósito de Ações = UNIT. Sem o ramo CDA o dividendo
-- da unit caía em PN e inflava o DY do PN (ex.: SAPR4 ~10x). Ver
-- docs/data-quality/2026-06-13-fundamentus-verification.md.
supplement as (
    select
        issuer,
        case
            when substr("isinCode", 7, 3) = 'CDA' then 'UNIT'
            when substr("isinCode", 7, 5) like '%OR%' then 'ON'
            else 'PN'
        end as share_class,
        case "label"
            when 'JRS CAP PROPRIO' then 'JCP'
            else "label"
        end as dividend_type,
        cast(strptime(nullif("approvedOn", ''), '%d/%m/%Y') as date) as approval_date,
        cast(strptime(nullif("lastDatePrior", ''), '%d/%m/%Y') as date) as last_cum_date,
        cast(strptime(nullif("paymentDate", ''), '%d/%m/%Y') as date) as payment_date,
        rate_parsed as value_per_share,
        cast(null as double) as close_before_ex,
        'supplement' as source_dataset
    from {{ source('raw_b3', 'ca_supplement_cash') }}
    where rate_parsed is not null
        and "label" in ('DIVIDENDO', 'JRS CAP PROPRIO', 'RENDIMENTO')
),

unioned as (
    select * from deep
    union all
    select * from supplement
)

select
    issuer,
    share_class,
    dividend_type,
    approval_date,
    last_cum_date,
    -- deep wins the dedupe but carries no payment_date; pull it from the matching
    -- supplement row within the same dedup group so the date isn't lost.
    coalesce(payment_date, max(payment_date) over (
        partition by issuer, share_class, dividend_type, last_cum_date, round(value_per_share, 6)
    )) as payment_date,
    value_per_share,
    close_before_ex,
    source_dataset
from unioned
where last_cum_date is null or year(last_cum_date) < 9000  -- 9999 = anunciado sem data-com
qualify row_number() over (
    partition by issuer, share_class, dividend_type, last_cum_date, round(value_per_share, 6)
    order by case source_dataset when 'deep' then 0 else 1 end
) = 1
