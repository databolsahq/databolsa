-- Sanidade econômica dos marts macro: ranges plausíveis p/ o Brasil moderno.
-- Pega erro dimensional (decimal × % × bps) na hora — classe de bug que a
-- revisão técnica achou no catálogo macro original.
with checks as (
    select 'juro_real_ex_ante fora de (-5%, 25%)' as violation, date, value
    from {{ ref('mart_macro__juro_real') }}
    where indicator_id = 'juro_real_ex_ante' and value not between -0.05 and 0.25

    union all

    select 'breakeven_5y fora de (-2%, 20%)', date, value
    from {{ ref('mart_macro__inflacao') }}
    where indicator_id = 'breakeven_5y' and value not between -0.02 and 0.20

    union all

    select 'desemprego fora de (3%, 25%)', date, value
    from {{ ref('mart_macro__emprego') }}
    where indicator_id = 'desemprego_pnad' and value not between 0.03 and 0.25

    union all

    select 'credito_pib fora de (10%, 100%)', date, value
    from {{ ref('mart_macro__credito') }}
    where indicator_id = 'credito_pib' and value not between 0.10 and 1.00

    union all

    select 'divida_bruta_pib fora de (30%, 120%)', date, value
    from {{ ref('mart_macro__fiscal') }}
    where indicator_id = 'divida_bruta_pib' and value not between 0.30 and 1.20
)

select * from checks
