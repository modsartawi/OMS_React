-- Ticket 757 item 3: the XE capture summarised. Which databases did svc_analytics_dbt touch, with what
-- kind of statement, and which objects were created/altered/dropped where.
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;
WITH ev AS (
  SELECT x.value('(event/@name)[1]','sysname') ev,
         x.value('(event/action[@name="database_name"]/value)[1]','sysname') db,
         x.value('(event/action[@name="server_principal_name"]/value)[1]','sysname') login,
         x.value('(event/data[@name="object_name"]/value)[1]','sysname') object_name,
         DB_NAME(x.value('(event/data[@name="database_id"]/value)[1]','int')) object_db,
         x.value('(event/data[@name="object_type"]/text)[1]','sysname') object_type,
         x.value('(event/data[@name="ddl_phase"]/text)[1]','sysname') ddl_phase,
         LTRIM(COALESCE(x.value('(event/data[@name="batch_text"]/value)[1]','nvarchar(max)'),
                        x.value('(event/data[@name="statement"]/value)[1]','nvarchar(max)'), '')) txt
  FROM (SELECT CAST(event_data AS xml) x FROM sys.fn_xe_file_target_read_file('/var/opt/mssql/log/spike757*.xel', NULL, NULL, NULL)) t)
SELECT 'statements' kind, ev, db, login,
       -- names_pos only says the text mentions POS; 07-trace-pos-statements.sql classifies HOW (read or write).
       CASE WHEN txt LIKE '%"POS".%' OR txt LIKE '%POS.dbo.%' OR txt LIKE '%[[]POS].%' THEN 'names POS' ELSE '-' END names_pos,
       COUNT(*) n
FROM ev WHERE ev IN ('sql_batch_completed','rpc_completed','error_reported')
GROUP BY ev, db, login,
  CASE WHEN txt LIKE '%"POS".%' OR txt LIKE '%POS.dbo.%' OR txt LIKE '%[[]POS].%' THEN 'names POS' ELSE '-' END
UNION ALL
SELECT 'objects', ev + ':' + ISNULL(ddl_phase, ''), COALESCE(object_db, db), login,
       CASE WHEN object_name LIKE '[_]WA[_]Sys[_]%' THEN '(auto-created statistics _WA_Sys_*)' ELSE ISNULL(object_type, '') + ' ' + object_name END,
       COUNT(*)
FROM ev WHERE ev LIKE 'object_%'
GROUP BY ev + ':' + ISNULL(ddl_phase, ''), COALESCE(object_db, db), login,
       CASE WHEN object_name LIKE '[_]WA[_]Sys[_]%' THEN '(auto-created statistics _WA_Sys_*)' ELSE ISNULL(object_type, '') + ' ' + object_name END
ORDER BY 1, 3, 2;
