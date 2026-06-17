-- Eventos societários (supplement B3) com fator NORMALIZADO para razão de
-- quantidade (shares_after/shares_before) — semântica normalizada no intermediate
-- verificada contra eventos conhecidos (PETR 1:2 2008 = '100'%; MGLU
-- grupamento 10:1 2024 = 0.1; bonificações em %):
--   DESDOBRAMENTO: % → 1 + f/100  | GRUPAMENTO: já é razão | BONIFICACAO: % → 1 + f/100
-- Demais labels (INCORPORACAO, CIS RED CAP, RESG...) não são eventos simples de
-- quantidade → share_ratio null (excluídos do ajuste v1).
-- Dedupe por ISIN (a fonte duplica linhas).
with raw_events as (
    select
        issuer,
        "isinCode" as isin,
        "label" as event_type,
        factor_parsed,
        cast(strptime(nullif("lastDatePrior", ''), '%d/%m/%Y') as date) as last_cum_date,
        cast(strptime(nullif("approvedOn", ''), '%d/%m/%Y') as date) as approval_date
    from {{ source('raw_b3', 'ca_supplement_events') }}
    where factor_parsed is not null and nullif("lastDatePrior", '') is not null
),

deduped as (
    select * from raw_events
    qualify row_number() over (
        partition by isin, event_type, last_cum_date, factor_parsed
        order by approval_date
    ) = 1
)

select
    issuer,
    isin,
    -- classe pelo ISIN (BR + emissor + ACNOR/ACNPR/ACNPA/ACNPB)
    case
        when substr(isin, 7, 5) like '%OR%' then 'ON'
        when substr(isin, 7, 5) like '%PA%' then 'PNA'
        when substr(isin, 7, 5) like '%PB%' then 'PNB'
        else 'PN'
    end as share_class,
    event_type,
    factor_parsed as factor_raw,
    case event_type
        when 'DESDOBRAMENTO' then 1.0 + factor_parsed / 100.0
        when 'BONIFICACAO' then 1.0 + factor_parsed / 100.0
        when 'GRUPAMENTO' then factor_parsed
    end as share_ratio,
    last_cum_date,
    approval_date
from deduped
where year(last_cum_date) < 9000
