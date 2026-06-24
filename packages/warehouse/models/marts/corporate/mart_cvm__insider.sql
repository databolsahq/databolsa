-- Fluxo mensal de insiders por CNPJ (contrato: GET /v1/stocks/{ticker}/insider,
-- resolvido ticker→cnpj na API). Saldo líquido de compras (Crédito) menos vendas
-- (Débito) em ações, agregado pelo mês de referência VLMO. net_shares em nº de
-- ações; valores em R$. É nível-companhia (a CVM não desce a ticker/classe).
select
    cnpj,
    strftime(date_trunc('month', reference_date), '%Y-%m') as reference_month,
    sum(case when operation = 'Crédito' then quantity else -quantity end) as net_shares,
    sum(case when operation = 'Crédito' then volume_brl else 0 end)
        - sum(case when operation = 'Débito' then volume_brl else 0 end) as net_value_brl,
    sum(case when operation = 'Crédito' then volume_brl else 0 end) as buy_value_brl,
    sum(case when operation = 'Débito' then volume_brl else 0 end) as sell_value_brl
from {{ ref('stg_cvm__vlmo') }}
group by 1, 2
having count(*) > 0
order by cnpj, reference_month desc
