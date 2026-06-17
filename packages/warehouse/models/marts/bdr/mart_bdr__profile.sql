-- Perfil de BDR (Brazilian Depositary Receipt) a partir do COTAHIST.
-- BDR = recibo de ação estrangeira negociado na B3. codbdi 34 = não-patrocinado
-- (DRN), 35 = patrocinado (DR1/DR2/DR3). Não há fonte cadastral aberta (emissor
-- estrangeiro, fora da CVM): nome e ISIN vêm do próprio COTAHIST; subjacente,
-- razão (ratio) e moeda ficam de fora (sem fonte gratuita confiável).
-- Preços do BDR são servidos pela tabela `prices` (mart_prices__adjusted já
-- inclui codbdi 34/35) — este mart é só o cadastro/catálogo.
with bdr as (
    select ticker, codbdi, trading_name, isin, spec, date
    from {{ ref('stg_b3__cotahist') }}
    where codbdi in ('34', '35')
)

select
    ticker,
    any_value(trading_name) as name,
    any_value(isin) as isin,
    max(case when codbdi = '35' then 'patrocinado' else 'nao_patrocinado' end) as kind,
    any_value(spec) as spec,
    min(date) as first_traded,
    max(date) as last_traded,
    count(*) as sessions
from bdr
group by ticker
