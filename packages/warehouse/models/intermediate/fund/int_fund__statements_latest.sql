-- Seleção canônica das demonstrações (ver docs/indicators.md):
-- 1. max(VERSAO) por (cnpj, ref_date, dataset, statement, scope) — usa sempre
--    a última reapresentação;
-- 2. preferência CONSOLIDADO, com fallback p/ individual quando a empresa
--    não consolida (decidido por (cnpj, ref_date, dataset) p/ não misturar
--    escopos entre DRE e DFC do mesmo período).
with latest_version as (
    select *
    from {{ ref('stg_cvm__dfp_itr') }}
    qualify version = max(version) over (
        partition by cnpj, ref_date, dataset, statement, scope
    )
),

scope_choice as (
    select
        cnpj,
        ref_date,
        dataset,
        bool_or(scope = 'con') as has_consolidated
    from latest_version
    group by 1, 2, 3
)

select
    l.*,
    s.has_consolidated
from latest_version as l
inner join scope_choice as s
    on l.cnpj = s.cnpj and l.ref_date = s.ref_date and l.dataset = s.dataset
where (s.has_consolidated and l.scope = 'con')
    or (not s.has_consolidated and l.scope = 'ind')
