-- Dimensão de ticker a partir do COTAHIST (codbdi 02 = ações lote padrão): para
-- cada ticker, sua raiz de 4 caracteres (= `issuer` das corporate actions B3,
-- ex.: PETR; quase sempre 4 letras, mas pode ter dígito: B3SA), a classe
-- (ON/PN/UNIT) e o ISIN. As CAs chegam por (issuer, classe) ou
-- por ISIN — cada consumidor resolve para o ticker mais recente (last_traded).
--   sufixo 3 = ON | 4..8 = PN | 11 = UNIT.
with quotes as (
    select
        ticker,
        isin,
        -- raiz = ticker sem o sufixo de classe (1–2 dígitos finais). Robusto a
        -- tickers com DÍGITO na raiz, ex.: B3SA3 -> B3SA. O antigo '^[A-Z]{4}'
        -- excluía a B3 inteira porque "B3SA" não são 4 letras (tem o '3'). Para
        -- tickers normais (AAAA+N) o resultado é idêntico: PETR4 -> PETR.
        regexp_replace(ticker, '[0-9]{1,2}$', '') as root,
        regexp_extract(ticker, '([0-9]+)$', 1) as suffix,
        date
    from {{ ref('stg_b3__cotahist') }}
    where codbdi = '02'
      and regexp_matches(ticker, '^[A-Z][A-Z0-9]{3}[0-9]{1,2}$')
)

select
    ticker,
    isin,
    root,
    case
        when suffix = '3' then 'ON'
        when suffix in ('4', '5', '6', '7', '8') then 'PN'
        when suffix = '11' then 'UNIT'
    end as class_group,
    max(date) as last_traded
from quotes
where suffix in ('3', '4', '5', '6', '7', '8', '11')
group by 1, 2, 3, 4
