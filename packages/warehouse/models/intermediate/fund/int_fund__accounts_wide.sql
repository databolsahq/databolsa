-- Pivot das contas-chave (docs/indicators.md, códigos top-level confiáveis).
-- Fluxos (DRE/DFC/DVA): só linhas YTD (period_start = início do ano fiscal) —
-- a descumulação p/ trimestres é do int_fund__quarters.
-- Estoques (BPA/BPP): posição em ref_date.
with base as (
    select * from {{ ref('int_fund__statements_latest') }}
),

-- Fluxos em DOIS recortes por (cnpj, dataset, ref_date):
-- period_kind='ytd' (início = jan/1º) e 'quarter' (linha do trimestre isolado,
-- início ≤ 100 dias antes de ref_date — bancos não publicam YTD anual no Q3,
-- só o semestre, então o trimestre direto é o caminho confiável).
-- D&A: conta 6.01.01.02 não é padronizada entre empresas → soma por descrição
-- (deprecia/amortiza/exaust) dentro de 6.01.01.*.
-- Instituições financeiras usam plano de contas DESLOCADO na DRE (verificado
-- no ITUB): 3.05 = EBT (não EBIT), 3.06 = IR, 3.09 = lucro do período, 3.11
-- não existe. Por isso EBT/IR/EBIT/lucro são mapeados por DESCRIÇÃO, não só
-- pelo código. Bancos ficam sem EBIT/EBITDA (não existe p/ intermediação).
flows_pivot as (
    select
        cnpj,
        cd_cvm,
        company_name,
        dataset,
        ref_date,
        scope,
        case when period_start = make_date(year(ref_date), 1, 1) then 'ytd'
             else 'quarter' end as period_kind,
        max(case when account_code = '3.01' then value_brl end) as revenue,
        max(case when account_code = '3.03' then value_brl end) as gross_profit,
        max(case when account_code = '3.05'
            and lower(strip_accents(account_name)) like '%antes do resultado financeiro%'
            then value_brl end) as ebit,
        max(case when account_code in ('3.05', '3.07')
            and lower(strip_accents(account_name)) like '%antes dos tributos%'
            then value_brl end) as ebt,
        max(case when account_code in ('3.06', '3.08')
            and lower(strip_accents(account_name)) like '%imposto%'
            then value_brl end) as income_tax,
        max(case when account_code = '3.11.01' then value_brl end) as net_income_controlling,
        max(case when account_code = '3.11' then value_brl end) as net_income_311,
        max(case when account_code = '3.09'
            and lower(strip_accents(account_name)) like '%periodo%'
            then value_brl end) as net_income_309,
        max(case when account_code = '6.01' then value_brl end) as ocf,
        sum(case
            when account_code like '6.01.01.%'
                and regexp_matches(lower(strip_accents(account_name)), 'deprecia|amortiza|exaust')
            then value_brl end) as dna,
        max(case when account_code = '6.02.01' then value_brl end) as capex,
        max(case when account_code = '7.01' then value_brl end) as dva_revenue
    from base
    where statement in ('dre', 'dfc_md', 'dfc_mi', 'dva')
        and (
            period_start = make_date(year(ref_date), 1, 1)
            or period_start >= ref_date - interval 100 days
        )
    group by 1, 2, 3, 4, 5, 6, 7
),

flows as (
    select
        * exclude (net_income_controlling, net_income_311, net_income_309),
        -- Lucro ATRIBUÍDO AOS CONTROLADORES (3.11.01) — convenção IFRS "atribuível aos
        -- sócios da controladora" usada pelas referências p/ LPA/P-L/ROE/margem líquida.
        -- 3.11 (consolidado total) inclui minoritários e inflava holdings (ALUP/ENGI/KLBN);
        -- cai p/ 3.11 e depois 3.09 (bancos) quando não há a linha de controladores.
        -- nullif(...,0): a CVM às vezes preenche 3.11.01 com 0 em vez de deixar nulo
        -- (visto na KLBN 2025-09/12), o que zeraria o TTM — tratamos 0 como ausente.
        coalesce(nullif(net_income_controlling, 0), net_income_311, net_income_309) as net_income
    from flows_pivot
),

-- Balanço com guarda de DESCRIÇÃO: o plano bancário desloca os códigos
-- (no ITUB, 2.03 = "Passivos Financeiros ao Custo Amortizado" e o PL é 2.08).
-- Bancos ficam sem circulante/dívida (conceitos que não se aplicam) e o PL é
-- achado pelo nome em qualquer código de nível ≤ 2.
balance as (
    select
        cnpj,
        dataset,
        ref_date,
        max(case when account_code = '1' then value_brl end) as total_assets,
        max(case when account_code = '1.01'
            and lower(strip_accents(account_name)) like 'ativo circulante%'
            then value_brl end) as current_assets,
        max(case when account_code = '1.01.01'
            and lower(strip_accents(account_name)) like '%caixa%'
            then value_brl end) as cash,
        max(case when account_code = '1.01.02'
            and lower(strip_accents(account_name)) like '%aplicac%'
            then value_brl end) as st_investments,
        max(case when account_code = '2.01'
            and lower(strip_accents(account_name)) like 'passivo circulante%'
            then value_brl end) as current_liabilities,
        max(case when account_code = '2.01.04'
            and lower(strip_accents(account_name)) like '%emprestimo%'
            then value_brl end) as st_debt,
        max(case when account_code = '2.02'
            and lower(strip_accents(account_name)) like 'passivo nao circulante%'
            then value_brl end) as noncurrent_liabilities,
        max(case when account_code = '2.02.01'
            and lower(strip_accents(account_name)) like '%emprestimo%'
            then value_brl end) as lt_debt,
        max(case when length(account_code) <= 4
            and lower(strip_accents(account_name)) like 'patrimonio liquido%'
            then value_brl end) as equity,
        -- Participação dos não controladores no PL (2.03.09 no plano padrão; achada por
        -- nome no plano bancário). Subtraída do PL total p/ obter o PL DOS CONTROLADORES.
        max(case when account_code = '2.03.09'
            or lower(strip_accents(account_name)) like '%nao controladores%'
            then value_brl end) as minority_interest
    from base
    where statement in ('bpa', 'bpp')
    group by 1, 2, 3
)

-- DFP anual: a linha "quarter" não existe (período = ano) → vira kind 'ytd' só
select
    f.*,
    b.total_assets,
    b.current_assets,
    b.cash,
    b.st_investments,
    b.current_liabilities,
    b.st_debt,
    b.noncurrent_liabilities,
    b.lt_debt,
    b.equity,
    b.minority_interest
from flows as f
left join balance as b
    on f.cnpj = b.cnpj and f.dataset = b.dataset and f.ref_date = b.ref_date
