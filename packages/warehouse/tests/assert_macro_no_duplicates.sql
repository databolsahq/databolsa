-- (date, indicator_id) deve ser único no mart de serving.
select date, indicator_id, count(*) as n
from {{ ref('mart_macro__indicators') }}
group by 1, 2
having count(*) > 1
