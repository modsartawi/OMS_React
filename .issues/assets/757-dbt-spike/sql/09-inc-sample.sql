-- Ticket 757 item 4: PERCENTILE_CONT vs PERCENTILE.INC on hand-checkable samples.
-- Part 1 prints SQL Server's answers; part 2 prints the raw "group|value" lines the C# check reads.
SET NOCOUNT ON;
-- Part 1a: the BackOffice unit-test samples and two hand-worked ones.
--   {4,1,3,2}:      p50 h=1.5 -> 2+0.5*(3-2)=2.5        p90 h=2.7 -> 3+0.7*(4-3)=3.7
--   {7}:            7, 7
--   {10,20,30,40,50}: p50 = 30                          p90 h=3.6 -> 40+0.6*10=46
--   {3,5,8,10,20,29}: p50 h=2.5 -> 8+0.5*2=9            p90 h=4.5 -> 20+0.5*9=24.5
WITH s(g, v) AS (
  SELECT 'a', v FROM (VALUES (4.0),(1.0),(3.0),(2.0)) x(v) UNION ALL
  SELECT 'b', 7.0 UNION ALL
  SELECT 'c', v FROM (VALUES (10.0),(20.0),(30.0),(40.0),(50.0)) x(v) UNION ALL
  SELECT 'd', v FROM (VALUES (3.0),(5.0),(8.0),(10.0),(20.0),(29.0)) x(v))
SELECT DISTINCT 'sql' src, g,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY v) OVER (PARTITION BY g) p50,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY v) OVER (PARTITION BY g) p90
FROM s ORDER BY g;
-- Part 1b: real fct_delivery rows, three stores on one day (yesterday), order_to_delivered_min.
DECLARE @d date = DATEADD(day, -1, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date));
SELECT DISTINCT 'sql' src, store_code g, COUNT(*) OVER (PARTITION BY store_code) n,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY order_to_delivered_min) OVER (PARTITION BY store_code) p50,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY order_to_delivered_min) OVER (PARTITION BY store_code) p90
FROM dbo.fct_delivery
WHERE created_date = @d AND store_code IN ('P001', 'P002', 'P050') AND first_ddlr_at IS NOT NULL
ORDER BY g;
-- Part 2: the raw values for the C# check.
SELECT 'P' + store_code + '|' + CONVERT(varchar(30), CAST(order_to_delivered_min AS float), 3)
FROM dbo.fct_delivery
WHERE created_date = @d AND store_code IN ('P001', 'P002', 'P050') AND first_ddlr_at IS NOT NULL
ORDER BY store_code, order_to_delivered_min;
