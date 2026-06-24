-- Volatilidade implícita + Greeks (Black-Scholes EUROPEU) por (option_ticker, date).
-- Insumos: preço da opção = `last`; spot = close_raw do subjacente; r = Selic
-- anualizada 252 (bcb_sgs 1178) contínua, asof por data; q = dy_12m do papel
-- (contínuo). IV por Newton-Raphson em vega, 8 iterações desenroladas (validado:
-- recupera σ=0,20 de um preço sintético). CAVEAT: opções da B3 são AMERICANAS;
-- BS europeu é APROXIMAÇÃO (ok p/ delta/exposição; vies em puts/pagadores de
-- dividendo por exercício antecipado). Só calculamos onde há valor no tempo e
-- moneyness/prazo sãos — fora disso IV/Greeks ficam null.
{% set n_iter = 8 %}

with rf as (
    select date, ln(1 + value / 100.0) as r
    from {{ ref('mart_macro__series') }}
    where source = 'bcb_sgs' and series_id = '1178'
),

dy as (
    select ticker, dy_12m
    from {{ ref('mart_fund__paper_indicators') }}
    qualify row_number() over (partition by ticker order by eval_date desc) = 1
),

opt as (
    select * from {{ ref('int_options__enriched') }}
    where volume_brl > 0 and last > 0 and underlying_spot > 0 and strike > 0 and days_to_expiry >= 1
),

base as (
    -- TUDO em DOUBLE: days_to_expiry/365.0 seria DECIMAL (int/decimal) e
    -- contaminaria d1 → power(decimal,5) estoura a escala 38 e vira NULL.
    select
        o.option_ticker,
        o.date,
        o.option_type as otype,
        o.underlying_spot::double as s,
        o.strike::double as k,
        o.days_to_expiry::double / 365.0 as t,
        coalesce(rf.r, ln(1.10))::double as r,                       -- fallback ~10% a.a.
        coalesce(ln(1 + greatest(dy.dy_12m, 0)), 0)::double as q,    -- div yield contínuo
        o.last::double as mkt,
        o.intrinsic::double as intrinsic,
        -- elegível p/ IV: valor no tempo real, prazo e moneyness sãos
        (o.last > o.intrinsic + 0.005
            and o.days_to_expiry between 1 and 1000
            and o.moneyness between 0.2 and 5.0) as iv_ok,
        -- chute inicial Brenner-Subrahmanyam, limitado
        greatest(0.05, least(3.0,
            sqrt(2 * pi() / (o.days_to_expiry::double / 365.0)) * (o.last::double / o.underlying_spot::double)
        ))::double as sig
    from opt as o
    asof left join rf on o.date >= rf.date
    left join dy on dy.ticker = o.underlying_ticker
),

{% for i in range(1, n_iter + 1) %}
-- Projeta SÓ carry+sig: se carregasse d1/d2/model_px/vega, a próxima iteração
-- pegaria o d1 ANTIGO do FROM (colisão com o alias lateral novo) e corromperia o Newton.
iter_{{ i }} as (
    select option_ticker, date, otype, s, k, t, r, q, mkt, intrinsic, iv_ok, sig_next as sig
    from (
        select *,
            {{ bs_d1('s', 'k', 't', 'r', 'q', 'sig') }} as d1,
            d1 - sig * sqrt(t) as d2,
            {{ bs_norm_pdf('d1') }} as nd1,
            (case when otype = 'call'
                then s * exp(-q * t) * {{ bs_norm_cdf('d1') }} - k * exp(-r * t) * {{ bs_norm_cdf('d2') }}
                else k * exp(-r * t) * {{ bs_norm_cdf('(-d2)') }} - s * exp(-q * t) * {{ bs_norm_cdf('(-d1)') }}
            end) as model_px,
            (s * exp(-q * t) * nd1 * sqrt(t)) as vega,
            greatest(0.001, least(5.0, sig - (model_px - mkt) / nullif(vega, 1e-9))) as sig_next
        from {{ 'base' if i == 1 else 'iter_' ~ (i - 1) }}
    )
),
{% endfor %}

solved as (
    select
        option_ticker, date, otype, s, k, t, r, q, mkt, intrinsic, iv_ok, sig,
        {{ bs_d1('s', 'k', 't', 'r', 'q', 'sig') }} as d1,
        d1 - sig * sqrt(t) as d2,
        {{ bs_norm_pdf('d1') }} as nd1,
        {{ bs_norm_cdf('d1') }} as nd1cdf,
        {{ bs_norm_cdf('d2') }} as nd2cdf,
        {{ bs_norm_cdf('(-d1)') }} as nmd1cdf,
        {{ bs_norm_cdf('(-d2)') }} as nmd2cdf,
        (case when otype = 'call'
            then s * exp(-q * t) * nd1cdf - k * exp(-r * t) * nd2cdf
            else k * exp(-r * t) * nmd2cdf - s * exp(-q * t) * nmd1cdf
        end) as model_px
    from iter_{{ n_iter }}
)

select
    option_ticker,
    date,
    r,                       -- juro livre contínuo usado (p/ o pricer americano da chain)
    q,                       -- div yield contínuo usado
    -- aceita a IV só se convergiu (resíduo pequeno) e está em faixa sã
    (iv_ok and abs(model_px - mkt) <= 0.02 * mkt + 0.01 and sig between 0.02 and 4.0) as valid,
    case when valid then sig end as iv,
    case when valid then
        (case when otype = 'call' then exp(-q * t) * nd1cdf else -exp(-q * t) * nmd1cdf end)
    end as delta,
    case when valid then exp(-q * t) * nd1 / nullif(s * sig * sqrt(t), 0) end as gamma,
    case when valid then s * exp(-q * t) * nd1 * sqrt(t) / 100.0 end as vega,  -- por 1% de vol
    case when valid then
        (case when otype = 'call'
            then (-(s * nd1 * sig * exp(-q * t)) / (2 * sqrt(t)) - r * k * exp(-r * t) * nd2cdf + q * s * exp(-q * t) * nd1cdf)
            else (-(s * nd1 * sig * exp(-q * t)) / (2 * sqrt(t)) + r * k * exp(-r * t) * nmd2cdf - q * s * exp(-q * t) * nmd1cdf)
        end) / 365.0                                                          -- por dia corrido
    end as theta
from solved
