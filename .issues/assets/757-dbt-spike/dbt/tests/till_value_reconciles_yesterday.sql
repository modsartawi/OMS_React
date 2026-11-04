{#- 748 nightly check: yesterday's till value in the mart equals a direct RetailTrx sum. -#}
{{ config(tags=['nightly']) }}
with mart as (
    select SUM(gross_till_value_sar - returns_value_sar) as v
    from {{ ref('mart_till_sales_daily') }}
    where sales_date = DATEADD(day, -1, {{ riyadh_today() }})
), src as (
    select CAST(SUM(CASE WHEN TrxType = 100 THEN 1 ELSE -1 END * Amount * CASE WHEN ExchangeRate > 0 THEN ExchangeRate ELSE 1 END) AS decimal(19,2)) as v
    from {{ source('pos', 'RetailTrx') }}
    where TrxStatus = 1 and TrxType in (100, 110)
      and TrxDate >= CAST(DATEADD(day, -1, {{ riyadh_today() }}) AS datetime)
      and TrxDate < CAST({{ riyadh_today() }} AS datetime)
)
select mart.v as mart_value, src.v as source_value from mart cross join src
where COALESCE(mart.v, 0) <> COALESCE(src.v, 0)
