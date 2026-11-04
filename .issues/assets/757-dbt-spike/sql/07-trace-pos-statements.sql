-- Ticket 757 item 3: every svc_analytics_dbt statement whose text names the source DB POS,
-- classified by its leading verb, so a write into POS would stand out.
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;
WITH ev AS (
  SELECT x.value('(event/@name)[1]','sysname') ev,
         x.value('(event/action[@name="database_name"]/value)[1]','sysname') db,
         COALESCE(x.value('(event/data[@name="batch_text"]/value)[1]','nvarchar(max)'),
                  x.value('(event/data[@name="statement"]/value)[1]','nvarchar(max)'), N'') txt
  FROM (SELECT CAST(event_data AS xml) x FROM sys.fn_xe_file_target_read_file('/var/opt/mssql/log/spike757*.xel', NULL, NULL, NULL)) t
  WHERE x.value('(event/action[@name="server_principal_name"]/value)[1]','sysname') = N'svc_analytics_dbt'),
named AS (
  SELECT ev, db, txt,
         -- the text right before the first mention of POS: what the statement does with it
         LOWER(LTRIM(RIGHT(REPLACE(REPLACE(LEFT(txt, CHARINDEX(N'"POS".', txt)), CHAR(10), ' '), CHAR(13), ' '), 40))) lead_in
  FROM ev WHERE CHARINDEX(N'"POS".', txt) > 0)
SELECT ev, db,
       CASE WHEN lead_in LIKE '%from "' OR lead_in LIKE '%join "' THEN 'reads POS (FROM/JOIN)'
            ELSE 'OTHER: ' + lead_in END usage,
       COUNT(*) statements
FROM named GROUP BY ev, db,
       CASE WHEN lead_in LIKE '%from "' OR lead_in LIKE '%join "' THEN 'reads POS (FROM/JOIN)' ELSE 'OTHER: ' + lead_in END;
-- every mention, not only the first: any "POS". preceded by into/update/table/view/delete/merge
WITH ev AS (
  SELECT x.value('(event/@name)[1]','sysname') ev,
         x.value('(event/action[@name="database_name"]/value)[1]','sysname') db,
         COALESCE(x.value('(event/data[@name="batch_text"]/value)[1]','nvarchar(max)'),
                  x.value('(event/data[@name="statement"]/value)[1]','nvarchar(max)'), N'') txt
  FROM (SELECT CAST(event_data AS xml) x FROM sys.fn_xe_file_target_read_file('/var/opt/mssql/log/spike757*.xel', NULL, NULL, NULL)) t
  WHERE x.value('(event/action[@name="server_principal_name"]/value)[1]','sysname') = N'svc_analytics_dbt')
SELECT COUNT(*) statements_naming_pos,
       SUM(CASE WHEN txt LIKE N'%into "POS".%' OR txt LIKE N'%update "POS".%' OR txt LIKE N'%table "POS".%'
                  OR txt LIKE N'%view "POS".%' OR txt LIKE N'%delete from "POS".%' OR txt LIKE N'%merge "POS".%'
                  OR txt LIKE N'%merge into "POS".%' OR txt LIKE N'%use [[]POS]%' OR txt LIKE N'%use "POS"%' OR txt LIKE N'%use POS;%'
                THEN 1 ELSE 0 END) write_shaped
FROM ev WHERE CHARINDEX(N'"POS".', txt) > 0 OR txt LIKE N'%use [[]POS]%' OR txt LIKE N'%use POS;%';
