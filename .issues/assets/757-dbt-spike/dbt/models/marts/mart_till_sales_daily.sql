{#- Area 1 (748): date x store x country x NPHIES-linked flag; additive counts and SAR sums only.
    Incremental by business day: the run stages the lookback days into a temp table, then
    delete+insert (unique_key sales_date) swaps every row of those days in ONE transaction. -#}
{{ config(
    unique_key='sales_date',
    tags=['intraday', 'nightly'],
    post_hook=["{{ log_load() }}"] + spike_pause_hooks()
) }}

with trx as (
    select t.TrxDate, t.TrxType, t.StoreCode, t.Amount,
           case when t.ExchangeRate > 0 then t.ExchangeRate else 1 end as rate,
           t.LoyaltyCustomerID, t.OrderNo, t.NphiesEligibilityId
    from {{ source('pos', 'RetailTrx') }} t
    where t.TrxStatus = 1
      and t.TrxType in (100, 110)
      and t.TrxDate < DATEADD(day, 1, CAST({{ riyadh_today() }} AS datetime))   -- dates capped at today (745)
    {% if is_incremental() %}
      and t.TrxDate >= {{ lookback_start() }}
    {% else %}
      and t.TrxDate >= {{ history_start() }}
    {% endif %}
)
select
    CAST(trx.TrxDate AS date) as sales_date,
    CAST(trx.StoreCode AS varchar(10)) as store_code,
    CAST(COALESCE(s.Country, 'KSA') AS char(3)) as country,
    CAST(CASE WHEN COALESCE(trx.NphiesEligibilityId, '') <> '' THEN 1 ELSE 0 END AS bit) as nphies_linked,
    COUNT_BIG(CASE WHEN trx.TrxType = 100 THEN 1 END) as till_sales,
    COUNT_BIG(CASE WHEN trx.TrxType = 110 THEN 1 END) as till_returns,
    CAST(SUM(CASE WHEN trx.TrxType = 100 THEN trx.Amount * trx.rate ELSE 0 END) AS decimal(19,2)) as gross_till_value_sar,
    CAST(SUM(CASE WHEN trx.TrxType = 110 THEN trx.Amount * trx.rate ELSE 0 END) AS decimal(19,2)) as returns_value_sar,
    COUNT_BIG(CASE WHEN trx.TrxType = 100 AND COALESCE(trx.LoyaltyCustomerID, '') NOT IN ('', '3795407', '3378', '1000000004') THEN 1 END) as loyalty_identified_sales,
    COUNT_BIG(CASE WHEN trx.TrxType = 100 AND COALESCE(trx.OrderNo, '') <> '' THEN 1 END) as order_linked_sales,
    CAST(MAX(trx.TrxDate) AS datetime2(0)) as _source_newest_at,
    {{ riyadh_now() }} as _loaded_at
from trx
left join {{ source('pos', 'Store') }} s on s.StoreCode = trx.StoreCode
group by CAST(trx.TrxDate AS date), trx.StoreCode, s.Country,
         CASE WHEN COALESCE(trx.NphiesEligibilityId, '') <> '' THEN 1 ELSE 0 END
