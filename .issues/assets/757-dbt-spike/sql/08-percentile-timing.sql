-- Ticket 757 item 4: the 92-day exact percentile by store, as Cube's login would run it.
-- sqlcmd -v tbl=fct_delivery extra=" "   (tbl: or fct_delivery_x8, the 8x scale copy; extra: e.g. "OPTION (MAXDOP 2)")
SET NOCOUNT ON;
DECLARE @today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date);
DECLARE @from date = DATEADD(day, -91, @today);   -- 92 days, today included
DECLARE @t0 datetime2 = SYSUTCDATETIME();
SELECT COUNT_BIG(*) rows_in_window, COUNT_BIG(first_ddlr_at) delivered_in_window
FROM dbo.$(tbl) WHERE created_date BETWEEN @from AND @today;
SET STATISTICS TIME ON;
SELECT DISTINCT store_code,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_to_delivered_min) OVER (PARTITION BY store_code) AS order_to_delivered_p50,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY order_to_delivered_min) OVER (PARTITION BY store_code) AS order_to_delivered_p90,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ready_to_delivered_min) OVER (PARTITION BY store_code) AS ready_to_delivered_p50,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ready_to_delivered_min) OVER (PARTITION BY store_code) AS ready_to_delivered_p90
INTO #r
FROM dbo.$(tbl)
WHERE created_date BETWEEN @from AND @today AND first_ddlr_at IS NOT NULL $(extra);
SET STATISTICS TIME OFF;
SELECT COUNT(*) stores, DATEDIFF(millisecond, @t0, SYSUTCDATETIME()) wall_ms_incl_count FROM #r;
SELECT TOP 3 * FROM #r ORDER BY store_code;
