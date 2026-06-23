-- Expectativas Focus (anuais, baseCalculo=0) por indicador e ano de referência —
-- serve GET /v1/macro/expectations. Uma linha por (indicador, ano, data-pesquisa):
-- a evolução do consenso. `realized` (valor efetivado) fica na camada analítica.
select
    case indicator when 'pib_total' then 'pib' else indicator end as indicator,
    cast(reference_year as varchar) as reference,
    survey_date,
    median,
    mean,
    std_dev,
    respondents,
    0 as base
from {{ ref('stg_bcb_focus__anuais') }}
where indicator in ('ipca', 'selic', 'pib_total', 'cambio')
    and reference_year is not null
order by indicator, reference, survey_date
