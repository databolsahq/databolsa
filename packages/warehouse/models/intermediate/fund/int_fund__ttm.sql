-- TTM = soma dos 4 últimos trimestres (exige os 4 presentes e contíguos);
-- balanço = posição do trimestre corrente. Deriva EBITDA, NOPAT, FCF, dívidas
-- (docs/indicators.md).
{% set flow_cols = ['revenue', 'gross_profit', 'ebit', 'ebt', 'income_tax',
                    'net_income', 'ocf', 'dna', 'capex', 'dva_revenue'] %}

with quarters as (
    select * from {{ ref('int_fund__quarters') }}
),

ttm as (
    select
        cnpj,
        cd_cvm,
        company_name,
        ref_date,
        scope,
        count(*) over w4 as quarters_available,
        (ref_date = max(ref_date) over (partition by cnpj)) as is_latest
        {% for col in flow_cols %},
        case when count({{ col }}) over w4 = 4
            then sum({{ col }}) over w4 end as {{ col }}_ttm
        {% endfor %},
        total_assets,
        current_assets,
        cash,
        st_investments,
        current_liabilities,
        st_debt,
        noncurrent_liabilities,
        lt_debt,
        equity,
        minority_interest
    from quarters
    window w4 as (partition by cnpj order by ref_date rows between 3 preceding and current row)
)

select
    -- `equity` exposto = PL DOS CONTROLADORES (total − minoritários), base de VPA, P/VP,
    -- ROE, dívida/PL. `invested_capital` (abaixo) usa o PL TOTAL de propósito: forma par
    -- com NOPAT (derivado do EBIT total, antes de minoritários) no ROIC.
    * exclude (equity, minority_interest),
    equity - coalesce(minority_interest, 0) as equity,
    ebit_ttm + coalesce(dna_ttm, 0) as ebitda_ttm,
    ocf_ttm - abs(coalesce(capex_ttm, 0)) as fcf_ttm,
    coalesce(st_debt, 0) + coalesce(lt_debt, 0) as gross_debt,
    coalesce(st_debt, 0) + coalesce(lt_debt, 0)
        - coalesce(cash, 0) - coalesce(st_investments, 0) as net_debt,
    current_assets - current_liabilities as working_capital,
    current_assets - (coalesce(current_liabilities, 0) + coalesce(noncurrent_liabilities, 0)) as net_current_assets,
    -- NOPAT: alíquota efetiva quando sã (EBT>0, 0≤rate≤1), senão 34% padrão BR
    ebit_ttm * (1.0 - case
        when ebt_ttm > 0 and income_tax_ttm <= 0
            and -income_tax_ttm / ebt_ttm between 0 and 1
            then -income_tax_ttm / ebt_ttm
        else 0.34
    end) as nopat_ttm,
    equity + coalesce(st_debt, 0) + coalesce(lt_debt, 0)
        - coalesce(cash, 0) - coalesce(st_investments, 0) as invested_capital
from ttm
where quarters_available > 0
