-- Curvas do Tesouro Direto interpoladas em tenores fixos (2, 5 e 10 anos):
-- real (Tesouro IPCA+) e prefixada (nominal). Taxa = média compra/venda, em
-- decimal a.a. Interpolação linear entre os vencimentos adjacentes; se só há
-- um lado, usa o mais próximo desde que diste ≤ 2 anos do tenor.
with rates as (
    select
        base_date,
        case
            when bond_type in ('Tesouro IPCA+', 'Tesouro IPCA+ com Juros Semestrais') then 'real'
            when bond_type in ('Tesouro Prefixado', 'Tesouro Prefixado com Juros Semestrais') then 'nominal'
        end as curve_type,
        maturity_years,
        (coalesce(buy_rate, sell_rate) + coalesce(sell_rate, buy_rate)) / 2.0 / 100.0 as rate
    from {{ ref('stg_tesouro__titulos') }}
    where bond_type in (
        'Tesouro IPCA+', 'Tesouro IPCA+ com Juros Semestrais',
        'Tesouro Prefixado', 'Tesouro Prefixado com Juros Semestrais'
    )
    and coalesce(buy_rate, sell_rate) is not null
    and maturity_years > 0.1
),

tenors as (
    select unnest([2.0, 5.0, 10.0]) as tenor
),

below as (
    select r.base_date, r.curve_type, t.tenor, r.maturity_years, r.rate
    from rates as r
    cross join tenors as t
    where r.maturity_years <= t.tenor
    qualify row_number() over (
        partition by r.base_date, r.curve_type, t.tenor
        order by r.maturity_years desc
    ) = 1
),

above as (
    select r.base_date, r.curve_type, t.tenor, r.maturity_years, r.rate
    from rates as r
    cross join tenors as t
    where r.maturity_years > t.tenor
    qualify row_number() over (
        partition by r.base_date, r.curve_type, t.tenor
        order by r.maturity_years asc
    ) = 1
),

interpolated as (
    select
        coalesce(b.base_date, a.base_date) as base_date,
        coalesce(b.curve_type, a.curve_type) as curve_type,
        coalesce(b.tenor, a.tenor) as tenor,
        case
            when b.rate is not null and a.rate is not null then
                b.rate + (a.rate - b.rate)
                * (coalesce(b.tenor, a.tenor) - b.maturity_years)
                / nullif(a.maturity_years - b.maturity_years, 0)
            when b.rate is not null and abs(b.maturity_years - b.tenor) <= 2.0 then b.rate
            when a.rate is not null and abs(a.maturity_years - a.tenor) <= 2.0 then a.rate
        end as rate
    from below as b
    full outer join above as a
        on b.base_date = a.base_date and b.curve_type = a.curve_type and b.tenor = a.tenor
)

select * from interpolated
where rate is not null
