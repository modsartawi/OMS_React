{#- Area 3 (748): one row per delivery, holding its FIRST-EVER DCRT / DRDY / DOFD / DDLR times
    (BackOffice ADR 0081), the order's EntryTime, its store and its channel group.
    Incremental by delivery, not by day: a run re-derives every delivery that logged a
    delivery-speed event, or was created, since the lookback start, taking MIN over ALL of that
    delivery's events (not only the window's), so a late re-post never moves a first time.
    delete+insert on delivery_no swaps those rows in one transaction. -#}
{{ config(
    unique_key='delivery_no',
    tags=['intraday', 'nightly'],
    post_hook=["{{ log_load() }}"] + spike_pause_hooks()
) }}

{% set codes = "('DCRT', 'DRDY', 'DOFD', 'DDLR')" %}
{% set since = lookback_start() if is_incremental() else history_start() %}

with touched as (
    select l.DocumentNo as delivery_no
    from {{ source('pos', 'SdDocumentLog') }} l
    where l.EntryTime >= {{ since }} and l.ActionType in {{ codes }}
    union
    select h.DocumentNo
    from {{ source('pos', 'SdDocumentHeader') }} h
    where h.EntryTime >= {{ since }} and h.DocumentCategory = 'D'
),
firsts as (
    select l.DocumentNo as delivery_no,
           MIN(CASE WHEN l.ActionType = 'DCRT' THEN l.EntryTime END) as first_dcrt_at,
           MIN(CASE WHEN l.ActionType = 'DRDY' THEN l.EntryTime END) as first_drdy_at,
           MIN(CASE WHEN l.ActionType = 'DOFD' THEN l.EntryTime END) as first_dofd_at,
           MIN(CASE WHEN l.ActionType = 'DDLR' THEN l.EntryTime END) as first_ddlr_at,
           MAX(l.EntryTime) as newest_event_at
    from {{ source('pos', 'SdDocumentLog') }} l
    join touched t on t.delivery_no = l.DocumentNo
    where l.ActionType in {{ codes }}
    group by l.DocumentNo
),
deliveries as (
    select d.DocumentNo as delivery_no, d.ParentDocumentNo as order_no, d.StoreCode, d.DocumentSource,
           d.EntryTime as delivery_entry_at,
           CASE WHEN o.EntryTime >= '19000101' THEN o.EntryTime END as order_at   -- 0001-01-01 is the unset sentinel (745); this test works for datetime and datetime2
    from {{ source('pos', 'SdDocumentHeader') }} d
    join touched t on t.delivery_no = d.DocumentNo
    left join {{ source('pos', 'SdDocumentHeader') }} o on o.DocumentNo = d.ParentDocumentNo
    where d.DocumentCategory = 'D'
)
select
    CAST(d.delivery_no AS varchar(20)) as delivery_no,
    CAST(d.order_no AS varchar(20)) as order_no,
    CAST(d.StoreCode AS varchar(10)) as store_code,
    CAST(COALESCE(c.channel_group, 'other') AS varchar(20)) as channel_group,
    -- ~7% never log DCRT (2638): fall back to the delivery header's EntryTime
    CAST(CAST(COALESCE(f.first_dcrt_at, d.delivery_entry_at) AS date) AS date) as created_date,
    CAST(COALESCE(f.first_dcrt_at, d.delivery_entry_at) AS datetime2(0)) as created_at,
    CAST(d.order_at AS datetime2(0)) as order_at,
    CAST(f.first_drdy_at AS datetime2(0)) as first_drdy_at,
    CAST(f.first_dofd_at AS datetime2(0)) as first_dofd_at,
    CAST(f.first_ddlr_at AS datetime2(0)) as first_ddlr_at,
    CAST(DATEDIFF(second, d.order_at, f.first_ddlr_at) / 60.0 AS decimal(12,4)) as order_to_delivered_min,
    CAST(DATEDIFF(second, f.first_drdy_at, f.first_ddlr_at) / 60.0 AS decimal(12,4)) as ready_to_delivered_min,
    CAST(CASE WHEN f.first_ddlr_at IS NOT NULL AND CAST(f.first_ddlr_at AS date) = CAST(d.order_at AS date) THEN 1 ELSE 0 END AS bit) as same_day,
    CAST(COALESCE(f.newest_event_at, d.delivery_entry_at) AS datetime2(0)) as _source_newest_at,
    {{ riyadh_now() }} as _loaded_at
from deliveries d
left join firsts f on f.delivery_no = d.delivery_no
left join {{ ref('channel_map') }} c on c.document_source = d.DocumentSource
