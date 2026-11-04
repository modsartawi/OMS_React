SET NOCOUNT ON; SET QUOTED_IDENTIFIER ON;
SELECT x.value('(event/@timestamp)[1]','datetime2') at,
       x.value('(event/data[@name="duration"]/value)[1]','bigint')/1000000.0 secs,
       x.value('(event/data[@name="result"]/text)[1]','varchar(20)') result,
       LEFT(x.value('(event/data[@name="statement"]/value)[1]','nvarchar(max)'),90) stmt
FROM (SELECT CAST(event_data AS xml) x FROM sys.fn_xe_file_target_read_file('/var/opt/mssql/log/spike_cube_reader*.xel',NULL,NULL,NULL)) t
WHERE x.value('(event/data[@name="statement"]/value)[1]','nvarchar(max)') LIKE '%CHECKSUM(a.object_id%';
