-- Encadeamento de tickers por (cnpj, classe) via FCA (Data_Inicio/Fim_Negociacao,
-- 2019+): ELET3→AXIA3 etc. chain_id = cnpj + classe.
-- ⚠️ Período 2010–2018 (sem Codigo_Negociacao no FCA) segue aberto — fazer via
-- CODISI↔CNPJ; tickers fora do FCA ficam fora da cadeia.
with windows as (
    select
        cnpj,
        ticker,
        class_group,
        min(trading_start) as valid_from,
        -- null = ainda negocia; max() com null-vence
        case when bool_or(trading_end is null) then null else max(trading_end) end as valid_to
    from {{ ref('int_fund__ticker_map') }}
    group by 1, 2, 3
)

select
    cnpj || '/' || class_group as chain_id,
    cnpj,
    class_group,
    ticker,
    valid_from,
    valid_to,
    row_number() over (
        partition by cnpj, class_group
        order by coalesce(valid_to, date '9999-12-31')
    ) as seq_in_chain,
    count(*) over (partition by cnpj, class_group) as chain_length
from windows
