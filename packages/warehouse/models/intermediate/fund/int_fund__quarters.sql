-- Fluxos TRIMESTRAIS a partir do ITR/DFP (docs/indicators.md):
-- Q1–Q3: linha do trimestre isolado quando publicada (cobre bancos, que não
--        têm YTD anual no Q3); fallback = YTD_q − YTD_{q-1} contíguo.
-- Q4:    DFP anual − YTD_Q3; fallback = anual − (Q1+Q2+Q3 diretos).
-- Balanço é estoque: passa direto da posição em ref_date.
{% set flow_cols = ['revenue', 'gross_profit', 'ebit', 'ebt', 'income_tax',
                    'net_income', 'ocf', 'dna', 'capex', 'dva_revenue'] %}

with wide as (
    select
        *,
        year(ref_date) as fiscal_year,
        quarter(ref_date) as q
    from {{ ref('int_fund__accounts_wide') }}
    where (dataset = 'itr' and quarter(ref_date) <= 3)
        or (dataset = 'dfp' and quarter(ref_date) = 4)
),

pivoted as (
    select
        cnpj,
        any_value(cd_cvm) as cd_cvm,
        any_value(company_name) as company_name,
        any_value(scope) as scope,
        any_value(dataset) as dataset,
        ref_date,
        fiscal_year,
        q
        {% for col in flow_cols %},
        max(case when period_kind = 'ytd' then {{ col }} end) as ytd_{{ col }},
        max(case when period_kind = 'quarter' then {{ col }} end) as qtr_{{ col }}
        {% endfor %}
    from wide
    group by cnpj, ref_date, fiscal_year, q
),

with_lags as (
    select
        *
        {% for col in flow_cols %},
        lag(ytd_{{ col }}) over w as prev_ytd_{{ col }},
        sum(qtr_{{ col }}) over (
            partition by cnpj, fiscal_year order by q
            rows between unbounded preceding and 1 preceding
        ) as prior_qtrs_{{ col }}
        {% endfor %},
        lag(q) over w as prev_q,
        count(qtr_revenue) over (
            partition by cnpj, fiscal_year order by q
            rows between unbounded preceding and 1 preceding
        ) as prior_qtr_rows
    from pivoted
    window w as (partition by cnpj, fiscal_year order by q)
),

flows_quarterly as (
    select
        cnpj,
        cd_cvm,
        company_name,
        ref_date,
        fiscal_year,
        q,
        scope,
        dataset
        {% for col in flow_cols %},
        case
            when q = 1 then coalesce(qtr_{{ col }}, ytd_{{ col }})
            when q <= 3 then coalesce(
                qtr_{{ col }},
                case when prev_q = q - 1 then ytd_{{ col }} - prev_ytd_{{ col }} end
            )
            else coalesce(
                case when prev_q = 3 then ytd_{{ col }} - prev_ytd_{{ col }} end,
                case when prior_qtr_rows = 3 then ytd_{{ col }} - prior_qtrs_{{ col }} end
            )
        end as {{ col }}
        {% endfor %}
    from with_lags
),

balance as (
    select
        cnpj,
        ref_date,
        max(total_assets) as total_assets,
        max(current_assets) as current_assets,
        max(cash) as cash,
        max(st_investments) as st_investments,
        max(current_liabilities) as current_liabilities,
        max(st_debt) as st_debt,
        max(noncurrent_liabilities) as noncurrent_liabilities,
        max(lt_debt) as lt_debt,
        max(equity) as equity,
        max(minority_interest) as minority_interest
    from wide
    group by 1, 2
)

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
from flows_quarterly as f
left join balance as b
    on f.cnpj = b.cnpj and f.ref_date = b.ref_date
