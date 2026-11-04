-- Ticket 756. Local spike data only. Two databases on one local SQL Server 2022:
--   POS_Spike     — stands in for the replica's raw tables; Cube is given NO access to it.
--   POS_Analytics — the 748 sibling DB; holds a mart_till_sales_daily-shaped table Cube reads.
-- Dates are relative to today so Cube's relative date ranges ("last 7 days") hit data.
SET NOCOUNT ON;
IF DB_ID('POS_Spike') IS NULL CREATE DATABASE POS_Spike;
IF DB_ID('POS_Analytics') IS NULL CREATE DATABASE POS_Analytics;
GO
USE POS_Spike;
IF OBJECT_ID('dbo.RetailTrx') IS NULL
  CREATE TABLE dbo.RetailTrx (
    TrxId bigint IDENTITY PRIMARY KEY, StoreCode varchar(10), TrxDate datetime2,
    TrxType int, TrxStatus int, Amount decimal(18,2), ExchangeRate decimal(9,4),
    LoyaltyCustomerID varchar(20), CustomerMobile varchar(20));
GO
USE POS_Analytics;
IF OBJECT_ID('dbo.dim_store') IS NOT NULL DROP TABLE dbo.dim_store;
IF OBJECT_ID('dbo.mart_till_sales_daily') IS NOT NULL DROP TABLE dbo.mart_till_sales_daily;
CREATE TABLE dbo.dim_store (
  store_code varchar(10) NOT NULL PRIMARY KEY,
  store_name nvarchar(100) NOT NULL,
  city nvarchar(50) NOT NULL,
  country char(3) NOT NULL);
CREATE TABLE dbo.mart_till_sales_daily (
  sales_date date NOT NULL,
  store_code varchar(10) NOT NULL,
  till_sales int NOT NULL,
  till_returns int NOT NULL,
  gross_value_sar decimal(18,2) NOT NULL,
  returns_value_sar decimal(18,2) NOT NULL,
  loyalty_identified int NOT NULL,
  top_customer_mobile varchar(20) NULL,   -- PII-shaped: deliberately NOT declared in the model
  CONSTRAINT pk_mart PRIMARY KEY (sales_date, store_code));

-- 100 stores (P001..P100); 5 cities; P096..P100 are Bahrain.
;WITH n AS (SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) i FROM sys.all_objects)
INSERT dbo.dim_store
SELECT 'P' + RIGHT('000' + CAST(i AS varchar), 3),
       N'صيدلية الدواء ' + CAST(i AS nvarchar),
       CASE WHEN i > 95 THEN N'Manama' ELSE CHOOSE(i % 4 + 1, N'Riyadh', N'Jeddah', N'Dammam', N'Makkah') END,
       CASE WHEN i > 95 THEN 'BHR' ELSE 'KSA' END
FROM n;

-- 150 days x 100 stores = 15,000 rows (more than the 10,000-row cap, on purpose).
;WITH d AS (SELECT TOP 150 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) - 1 k FROM sys.all_objects)
INSERT dbo.mart_till_sales_daily
SELECT DATEADD(day, -d.k, CAST(GETDATE() AS date)), s.store_code,
       100 + ABS(CHECKSUM(d.k, s.store_code)) % 400,
       ABS(CHECKSUM(s.store_code, d.k)) % 20,
       CAST(5000 + ABS(CHECKSUM(d.k * 7, s.store_code)) % 45000 AS decimal(18,2)),
       CAST(ABS(CHECKSUM(s.store_code, d.k * 3)) % 1500 AS decimal(18,2)),
       ABS(CHECKSUM(d.k * 11, s.store_code)) % 100,
       '9665' + RIGHT('00000000' + CAST(ABS(CHECKSUM(d.k, s.store_code, 1)) % 100000000 AS varchar), 8)
FROM d CROSS JOIN dbo.dim_store s;
GO
-- The DDL log: any CREATE/ALTER/DROP in POS_Analytics lands here (item 5's "nothing written").
USE POS_Analytics;
IF OBJECT_ID('dbo.spike_ddl_log') IS NULL
  CREATE TABLE dbo.spike_ddl_log (at datetime2 DEFAULT SYSUTCDATETIME(), login sysname, event xml);
GO
IF EXISTS (SELECT 1 FROM sys.triggers WHERE name = 'spike_ddl_audit') DROP TRIGGER spike_ddl_audit ON DATABASE;
GO
CREATE TRIGGER spike_ddl_audit ON DATABASE FOR DDL_DATABASE_LEVEL_EVENTS AS
  INSERT dbo.spike_ddl_log (login, event) VALUES (ORIGINAL_LOGIN(), EVENTDATA());
GO
-- Cube's login: reader on POS_Analytics only, nothing on POS_Spike.
USE master;
IF SUSER_ID('cube_reader') IS NULL
  CREATE LOGIN cube_reader WITH PASSWORD = 'Spike756!Reader', CHECK_POLICY = OFF, DEFAULT_DATABASE = POS_Analytics;
GO
USE POS_Analytics;
IF USER_ID('cube_reader') IS NULL CREATE USER cube_reader FOR LOGIN cube_reader;
ALTER ROLE db_datareader ADD MEMBER cube_reader;
GO
-- Every statement cube_reader sends, and every error it gets, to a file (item 1 + item 5).
USE master;
IF EXISTS (SELECT 1 FROM sys.server_event_sessions WHERE name = 'spike_cube_reader')
  DROP EVENT SESSION spike_cube_reader ON SERVER;
CREATE EVENT SESSION spike_cube_reader ON SERVER
  ADD EVENT sqlserver.sql_batch_completed (ACTION (sqlserver.database_name, sqlserver.username)
      WHERE sqlserver.username = N'cube_reader'),
  ADD EVENT sqlserver.rpc_completed (ACTION (sqlserver.database_name, sqlserver.username)
      WHERE sqlserver.username = N'cube_reader'),
  ADD EVENT sqlserver.error_reported (ACTION (sqlserver.database_name, sqlserver.username, sqlserver.sql_text)
      WHERE sqlserver.username = N'cube_reader' AND severity > 10)
  ADD TARGET package0.event_file (SET filename = N'/var/opt/mssql/log/spike_cube_reader.xel');
ALTER EVENT SESSION spike_cube_reader ON SERVER STATE = START;
GO
SELECT (SELECT COUNT(*) FROM POS_Analytics.dbo.mart_till_sales_daily) mart_rows,
       (SELECT COUNT(*) FROM POS_Analytics.dbo.dim_store) stores;
