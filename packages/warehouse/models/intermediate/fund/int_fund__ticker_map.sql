-- Mapa de tickers por (cnpj, classe). Fonte cadastral = FCA (valor mobiliário),
-- com DUAS correções (ver docs/data-quality/2026-06-13-fundamentus-verification.md):
--   1. VALIDAÇÃO de formato: a FCA traz "Codigo_Negociacao" sujo p/ ~34 empresas
--      (ex.: '000000' = BTG, '25585' = CSN Mineração, 'EUFA' = Eurofarma, '4030'
--      = CSN). Aceitamos só o formato B3 (AAAA + 1–2 dígitos); o lixo deixa de
--      poluir o `tickers` do mart e o issuer↔cnpj dos proventos.
--   2. RECUPERAÇÃO via COTAHIST: p/ empresas estruturadas em UNIT a FCA às vezes
--      só registra a unit (as linhas ON/PN vêm com ticker NULL) — ex.: Klabin
--      (KLBN11) e Alupar (ALUP11). Sem o ON/PN o market cap (que soma ON×preço +
--      PN×preço) não calcula. Completamos com os irmãos ON/PN/UNIT que AINDA
--      negociam (int_b3__ticker_class), casados pela raiz de 4 letras.
--      Guarda anti-colisão: só recuperamos raízes que mapeiam p/ 1 único CNPJ.
-- class_group vem do SUFIXO (3=ON, 4..8=PN, 11=UNIT) — canônico (a classe da FCA
-- às vezes vem errada, ex.: MGLU3 marcado 'PNA').

with fca_valid as (
    select
        cnpj, share_class, ticker, segment, company_name,
        trading_start, trading_end, ref_date, version
    from {{ ref('stg_cvm_fca__valor_mobiliario') }}
    where ticker is not null
      and regexp_matches(ticker, '^[A-Z]{4}[0-9]{1,2}$')
    qualify row_number() over (
        partition by cnpj, ticker
        order by ref_date desc, version desc
    ) = 1
),

-- raiz de 4 letras -> cnpj, da FCA + overrides curados (ticker_overrides:
-- empresas cujo Codigo_Negociacao na FCA é 100% lixo, ex.: BTG/CSN/Multilaser).
-- Mantemos só raízes inequívocas (1 CNPJ por raiz) após juntar as duas fontes.
root_candidates as (
    select left(ticker, 4) as root, cnpj from fca_valid group by 1, 2
    union
    select root, cnpj from {{ ref('ticker_overrides') }}
),

root_to_cnpj as (
    select root, any_value(cnpj) as cnpj
    from root_candidates
    group by 1
    having count(distinct cnpj) = 1
),

company as (
    select cnpj, any_value(company_name) as company_name, max(segment) as segment
    from fca_valid
    group by 1
),

-- irmãos ON/PN/UNIT do COTAHIST p/ raízes inequívocas, que ainda negociam
siblings as (
    select
        r.cnpj,
        tc.ticker,
        c.company_name,
        c.segment
    from {{ ref('int_b3__ticker_class') }} as tc
    inner join root_to_cnpj as r on r.root = tc.root
    left join company as c on c.cnpj = r.cnpj
    where tc.class_group in ('ON', 'PN', 'UNIT')
      and tc.last_traded
          >= (select max(last_traded) from {{ ref('int_b3__ticker_class') }})
             - interval 30 day
    qualify row_number() over (
        partition by r.cnpj, tc.ticker order by tc.last_traded desc
    ) = 1
),

-- só os irmãos que a FCA não trouxe (FCA vence p/ datas/segmento)
siblings_new as (
    select s.cnpj, s.ticker, s.company_name, s.segment
    from siblings as s
    where not exists (
        select 1 from fca_valid as f
        where f.cnpj = s.cnpj and f.ticker = s.ticker
    )
),

combined as (
    select
        cnpj, share_class, ticker, segment, company_name,
        trading_start, trading_end,
        trading_end is null as is_active
    from fca_valid
    union all
    select
        cnpj,
        cast(null as varchar) as share_class,
        ticker, segment, company_name,
        cast(null as date) as trading_start,
        cast(null as date) as trading_end,
        true as is_active
    from siblings_new
)

select
    cnpj,
    coalesce(
        share_class,
        case regexp_extract(ticker, '(\d+)$', 1)
            when '3' then 'ON' when '11' then 'UNIT' else 'PN'
        end
    ) as share_class,
    case regexp_extract(ticker, '(\d+)$', 1)
        when '3' then 'ON'
        when '4' then 'PN'
        when '5' then 'PN'
        when '6' then 'PN'
        when '7' then 'PN'
        when '8' then 'PN'
        when '11' then 'UNIT'
        else 'PN'
    end as class_group,
    ticker,
    segment,
    company_name,
    trading_start,
    trading_end,
    is_active
from combined
