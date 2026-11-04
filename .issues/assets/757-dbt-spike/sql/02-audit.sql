-- Ticket 757 item 3: the write audit. Three independent witnesses that nothing lands in POS.
--  (a) a server-wide XE session: every batch/RPC/error from svc_analytics_dbt (any DB), and every
--      object created/altered/deleted in POS by anyone or anywhere by svc_analytics_dbt;
--  (b) a DDL trigger in POS logging any DDL to a table only dbo can write;
--  (c) a sys.objects snapshot of POS (03-objects-snapshot.sql), before and after.
USE master;
IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = 'spike757') DROP EVENT SESSION spike757 ON SERVER;
CREATE EVENT SESSION spike757 ON SERVER
ADD EVENT sqlserver.sql_batch_completed (ACTION (sqlserver.database_name, sqlserver.server_principal_name, sqlserver.session_id)
  WHERE sqlserver.server_principal_name = N'svc_analytics_dbt'),
ADD EVENT sqlserver.rpc_completed (ACTION (sqlserver.database_name, sqlserver.server_principal_name, sqlserver.session_id)
  WHERE sqlserver.server_principal_name = N'svc_analytics_dbt'),
ADD EVENT sqlserver.error_reported (ACTION (sqlserver.database_name, sqlserver.server_principal_name, sqlserver.session_id)
  WHERE sqlserver.server_principal_name = N'svc_analytics_dbt' AND severity > 10),
ADD EVENT sqlserver.object_created (ACTION (sqlserver.database_name, sqlserver.server_principal_name)
  WHERE sqlserver.database_name = N'POS' OR sqlserver.server_principal_name = N'svc_analytics_dbt'),
ADD EVENT sqlserver.object_altered (ACTION (sqlserver.database_name, sqlserver.server_principal_name)
  WHERE sqlserver.database_name = N'POS' OR sqlserver.server_principal_name = N'svc_analytics_dbt'),
ADD EVENT sqlserver.object_deleted (ACTION (sqlserver.database_name, sqlserver.server_principal_name)
  WHERE sqlserver.database_name = N'POS' OR sqlserver.server_principal_name = N'svc_analytics_dbt')
ADD TARGET package0.event_file (SET filename = N'/var/opt/mssql/log/spike757.xel', max_file_size = 200)
WITH (MAX_DISPATCH_LATENCY = 1 SECONDS);
ALTER EVENT SESSION spike757 ON SERVER STATE = START;
GO
USE POS;
IF OBJECT_ID('dbo.spike_ddl_log') IS NULL
  CREATE TABLE dbo.spike_ddl_log (at datetime2 DEFAULT SYSUTCDATETIME(), login sysname, event xml);
GO
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'spike_ddl' AND parent_class = 0) DROP TRIGGER spike_ddl ON DATABASE;
GO
CREATE TRIGGER spike_ddl ON DATABASE WITH EXECUTE AS 'dbo' FOR DDL_DATABASE_LEVEL_EVENTS AS
  INSERT dbo.spike_ddl_log (login, event) VALUES (ORIGINAL_LOGIN(), EVENTDATA());
GO
