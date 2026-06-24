-- Indicadores de FII por ticker (GET /v1/fiis/{ticker}/indicators), linha larga
-- que a API expande em IndicatorValue[]. Combina o último informe mensal (PL, VP,
-- cotistas, DY mês), o preço de mercado (COTAHIST codbdi 12) e o DY 12m (soma das
-- 12 últimas distribuições ÷ preço). Vacância/cap rate ficam fora do v1 (exigem
-- agregação do informe trimestral por imóvel).
with latest_report as (
    select
        t.ticker,
        s.reference_date,
        s.net_asset_value as patrimonio_liquido,
        s.value_per_share as vp_cota,
        s.shareholders as cotistas,
        s.dividend_yield_mes,
        s.shares_issued
    from {{ ref('stg_cvm__fii_mensal') }} s
    join {{ ref('int_fii__ticker') }} t on t.isin = s.isin
    where s.net_asset_value is not null
    qualify row_number() over (partition by t.ticker order by s.reference_date desc) = 1
),

price as (
    select ticker, close as preco
    from {{ ref('stg_b3__cotahist') }}
    where codbdi = '12' and close is not null
    qualify row_number() over (partition by ticker order by date desc) = 1
),

-- DY 12m = Σ distribuições dos ÚLTIMOS 12 MESES ÷ preço. value_per_share vem agora do
-- Informe de Rendimentos da B3 FNET (provento PAGO por cota, via mart_fii__distributions)
-- — não mais do saldo "Rendimentos_Distribuir" do informe CVM, que zerava em pagadores
-- de ~100%/mês e os derrubava p/ ~2% (CPTS11 real ≈ 14%). Janela de 12 meses a PARTIR
-- do último pagamento de CADA fundo, com teto de 3% da cota por mês: rendimento mensal
-- de FII gira em ~1%; >3% é cota fóssil ilíquida ou provento extraordinário não-recorrente.
-- O teto também zera fundos que pararam de pagar há muito (distribuição antiga > 3% da
-- cota atual).
dist_12m as (
    select d.ticker, sum(d.value_per_share) as dist_12m
    from {{ ref('mart_fii__distributions') }} d
    join price p on p.ticker = d.ticker
    join (select ticker, max(ex_date) as last_ex from {{ ref('mart_fii__distributions') }} group by 1) lx
        on lx.ticker = d.ticker
    where d.ex_date > lx.last_ex - interval 12 month
        and d.value_per_share <= p.preco * 0.03
    group by d.ticker
),

-- FFO (Funds From Operations) = resultado distribuível do período. Para FIIs, o
-- "Rendimentos_Distribuir" do informe MENSAL é a medida-padrão (cobertura mensal;
-- o DRE trimestral é esparso/subtotalizado). FFO 12m = soma dos últimos 12 meses.
ffo_12m as (
    -- shares_max = nº de cotas mais robusto da janela (o mensal tem meses com
    -- cota mal-reportada que estoura o valor de mercado; o máx é estável).
    select t.ticker, sum(s.rendimentos_distribuir) as ffo_12m, max(s.shares_issued) as shares_max
    from (
        select isin, rendimentos_distribuir, shares_issued,
            row_number() over (partition by isin order by reference_date desc) as rn
        from {{ ref('stg_cvm__fii_mensal') }}
        where rendimentos_distribuir is not null
    ) s
    join {{ ref('int_fii__ticker') }} t on t.isin = s.isin
    where s.rn <= 12
    group by t.ticker
)

select
    lr.ticker,
    lr.reference_date,
    p.preco,
    lr.vp_cota,
    lr.patrimonio_liquido,
    lr.cotistas,
    lr.dividend_yield_mes,
    d.dist_12m,
    case when p.preco > 0 and d.dist_12m is not null then round(d.dist_12m / p.preco * 100, 4) end as dy_12m,
    case when lr.vp_cota > 0 and p.preco is not null then round(p.preco / lr.vp_cota, 4) end as pvp,
    -- FFO Yield = FFO 12m ÷ valor de mercado (preço × cotas emitidas), em %. FFO =
    -- Rendimentos_Distribuir 12m (resultado distribuível). Difere do DY quando o fundo
    -- retém ou distribui reservas. Fallback p/ o DY 12m quando o saldo CVM não cobre o
    -- fundo (pagadores de ~100%/mês zeram Rendimentos_Distribuir): aí FFO ≈ distribuído.
    coalesce(
        case when p.preco > 0 and ffo.shares_max > 0 and ffo.ffo_12m > 0
            then round(ffo.ffo_12m / (p.preco * ffo.shares_max) * 100, 4) end,
        case when p.preco > 0 and d.dist_12m is not null then round(d.dist_12m / p.preco * 100, 4) end
    ) as ffo_yield,
    tr.vacancia_fisica,
    tr.cap_rate,
    -- Métricas imobiliárias só p/ fundos de tijolo. Guarda dupla: not is_paper E
    -- ABL >= 1000 m² — fundos de papel (alguns mal-classificados, ex.: MXRF) têm
    -- área residual minúscula que estoura o preço/m².
    case when not coalesce(prof.is_paper, false) and tr.area_m2 >= 1000 then tr.qtd_imoveis end as qtd_imoveis,
    case when not coalesce(prof.is_paper, false) and tr.area_m2 >= 1000 then tr.area_m2 end as area_m2,
    case when not coalesce(prof.is_paper, false) and tr.area_m2 >= 1000 then tr.preco_m2 end as preco_m2,
    case when not coalesce(prof.is_paper, false) and tr.area_m2 >= 1000 then tr.aluguel_m2 end as aluguel_m2,
    coalesce(prof.is_paper, false) as is_paper
from latest_report lr
left join price p on p.ticker = lr.ticker
left join dist_12m d on d.ticker = lr.ticker
left join ffo_12m ffo on ffo.ticker = lr.ticker
left join {{ ref('mart_fii__trimestral') }} tr on tr.ticker = lr.ticker
left join {{ ref('mart_fii__profile') }} prof on prof.ticker = lr.ticker
-- Guarda: o serving mart é 1 linha por ticker mesmo que um join acima fan-out.
qualify row_number() over (partition by lr.ticker order by lr.reference_date desc) = 1
