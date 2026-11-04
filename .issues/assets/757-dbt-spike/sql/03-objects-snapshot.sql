-- Ticket 757 item 3 (c): POS objects with their modify dates, and the DDL log.
SET NOCOUNT ON;
USE POS;
SELECT o.type, SCHEMA_NAME(o.schema_id) + '.' + o.name obj, CONVERT(varchar(23), o.create_date, 121) created,
       CONVERT(varchar(23), o.modify_date, 121) modified
FROM sys.objects o WHERE o.is_ms_shipped = 0 ORDER BY o.type, obj;
SELECT COUNT(*) ddl_log_rows, MAX(at) last_ddl_utc,
       SUM(CASE WHEN login = 'svc_analytics_dbt' THEN 1 ELSE 0 END) ddl_by_dbt FROM dbo.spike_ddl_log;
