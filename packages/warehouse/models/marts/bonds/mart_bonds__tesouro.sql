-- Tesouro Direto: PU e taxas por título e data-base — serve GET /v1/bonds/tesouro
-- e (derivada) /bonds/tesouro/yield-curve. `type` mapeia o rótulo amigável para o
-- código clássico do papel; taxas em % a.a., PUs em R$. Mantém o histórico completo
-- (o parâmetro `date` na API faz o ponto-no-tempo; default = última base).
-- Renda+ e Educa+ (estrutura NTN-B1, IPCA+) entram como RENDA+/EDUCA+. O IGPM+
-- está descontinuado (não é mais ofertado) e fica de fora da grade.
select
    case bond_type
        when 'Tesouro Prefixado' then 'LTN'
        when 'Tesouro Prefixado com Juros Semestrais' then 'NTN-F'
        when 'Tesouro IPCA+' then 'NTN-B-Principal'
        when 'Tesouro IPCA+ com Juros Semestrais' then 'NTN-B'
        when 'Tesouro Selic' then 'LFT'
        when 'Tesouro Renda+ Aposentadoria Extra' then 'RENDA+'
        when 'Tesouro Educa+' then 'EDUCA+'
        else bond_type
    end as type,
    -- Renda+ e Educa+ são conhecidos pelo ANO DE CONVERSÃO (início do recebimento),
    -- não pelo vencimento (último pagamento): conversão = ano(venc) − (anos de pagamento − 1),
    -- ou seja −19 p/ Renda+ (240 parcelas / 20 anos) e −4 p/ Educa+ (60 parcelas / 5 anos).
    case
        when bond_type = 'Tesouro Renda+ Aposentadoria Extra'
            then 'Tesouro Renda+ ' || (year(maturity_date) - 19)
        when bond_type = 'Tesouro Educa+'
            then 'Tesouro Educa+ ' || (year(maturity_date) - 4)
        else bond_type || ' ' || year(maturity_date)
    end as name,
    maturity_date as maturity,
    base_date as date,
    buy_rate,
    sell_rate,
    pu_buy as buy_price,
    pu_sell as sell_price,
    -- prazo em anos (usado pela curva de juros)
    round(maturity_years, 4) as maturity_years
from {{ ref('stg_tesouro__titulos') }}
where maturity_date is not null
  -- IGPM+ descontinuado: não é mais ofertado pelo Tesouro → fora da grade
  and bond_type not like 'Tesouro IGPM%'
order by date desc, type, maturity
