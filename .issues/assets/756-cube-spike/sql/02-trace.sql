-- Ticket 756: every statement and error from cube_reader, from the XE file.
SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;
SELECT x.value('(event/@name)[1]','sysname') ev,
       x.value('(event/@timestamp)[1]','datetime2') at,
       x.value('(event/action[@name="database_name"]/value)[1]','sysname') db,
       LEFT(REPLACE(REPLACE(COALESCE(x.value('(event/data[@name="batch_text"]/value)[1]','nvarchar(max)'),
            x.value('(event/data[@name="statement"]/value)[1]','nvarchar(max)'),
            x.value('(event/data[@name="message"]/value)[1]','nvarchar(max)')), CHAR(10), ' '), CHAR(13), ' '), 400) txt
FROM (SELECT CAST(event_data AS xml) x FROM sys.fn_xe_file_target_read_file('/var/opt/mssql/log/spike_cube_reader*.xel', NULL, NULL, NULL)) t
ORDER BY at;
