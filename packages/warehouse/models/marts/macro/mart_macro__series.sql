-- Observações brutas das séries SGS/BCB por (source, series_id) — serve
-- GET /v1/series/{source}/{series_id}. Hoje só bcb_sgs (a UI consome SGS); as
-- demais fontes entram quando catalogadas. series_id em texto (chave de contrato).
-- Acrescenta os benchmarks de riqueza base-100 (source 'benchmark') p/ o overlay
-- da tela Comparar comparar ações vs CDI/IPCA na mesma régua.
select
    'bcb_sgs' as source,
    cast(series_id as varchar) as series_id,
    date,
    value
from {{ ref('stg_bcb_sgs__series') }}
where value is not null

union all

select
    'benchmark' as source,
    series_id,
    date,
    value
from {{ ref('mart_macro__wealth_indices') }}

order by source, series_id, date
