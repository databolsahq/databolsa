-- União de todos os indicadores macro em formato longo — tabela de serving
-- do futuro GET /v1/macro/* (api/openapi.yaml).
{% set marts = [
    'mart_macro__juro_real',
    'mart_macro__inflacao',
    'mart_macro__crescimento',
    'mart_macro__emprego',
    'mart_macro__credito',
    'mart_macro__fiscal',
    'mart_macro__externo',
    'mart_macro__risco',
    'mart_macro__global',
    'mart_macro__moeda',
    'mart_macro__regime',
] %}

{% for mart in marts %}
select
    date,
    indicator_id,
    value,
    unit,
    label,
    lineage,
    '{{ mart | replace("mart_macro__", "") }}' as section
from {{ ref(mart) }}
{% if not loop.last %}union all{% endif %}
{% endfor %}
