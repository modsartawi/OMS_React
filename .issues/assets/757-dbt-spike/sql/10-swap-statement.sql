-- Ticket 757 item 2: the statement dbt-sqlserver's delete+insert sends for one mart run (the newest one).
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;
SELECT TOP 1 x.value('(event/@timestamp)[1]','datetime2') at,
       x.value('(event/data[@name="batch_text"]/value)[1]','nvarchar(max)') batch_text
FROM (SELECT CAST(event_data AS xml) x FROM sys.fn_xe_file_target_read_file('/var/opt/mssql/log/spike757*.xel', NULL, NULL, NULL)) t
WHERE x.value('(event/data[@name="batch_text"]/value)[1]','nvarchar(max)') LIKE N'%delete DBT_INTERNAL_DEST%mart_till_sales_daily%'
ORDER BY 1 DESC;
