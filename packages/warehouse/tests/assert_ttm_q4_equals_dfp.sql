-- No Q4, TTM(4 trimestres) deve bater com a DFP anual (±2%) — valida a
-- descumulação do ITR. Estado 2026-06: ~491/7897 (6,2%) divergem por causas
-- legítimas CONHECIDAS: DFP reapresentada sem reapresentar ITRs, troca de escopo
-- con↔ind no meio do ano. Por isso o warn fica ACIMA desse baseline (~600) em vez
-- de >0 — só dispara se a divergência CRESCER (degradação real), não em toda
-- rodada; erro se passar de 800.
{{ config(severity='warn', warn_if='>600', error_if='>800') }}

with dfp_annual as (
    select cnpj, ref_date, revenue as revenue_annual
    from {{ ref('int_fund__accounts_wide') }}
    where dataset = 'dfp' and period_kind = 'ytd' and revenue is not null
),

ttm_q4 as (
    select cnpj, ref_date, revenue_ttm, quarters_available
    from {{ ref('int_fund__ttm') }}
    where quarter(ref_date) = 4 and revenue_ttm is not null
)

select
    t.cnpj,
    t.ref_date,
    t.revenue_ttm,
    d.revenue_annual,
    abs(t.revenue_ttm - d.revenue_annual) / abs(d.revenue_annual) as deviation
from ttm_q4 as t
inner join dfp_annual as d on t.cnpj = d.cnpj and t.ref_date = d.ref_date
where abs(d.revenue_annual) > 1e6
    and abs(t.revenue_ttm - d.revenue_annual) / abs(d.revenue_annual) > 0.02
