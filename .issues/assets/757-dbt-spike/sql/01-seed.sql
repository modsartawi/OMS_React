-- Ticket 757. Local spike data only. Synthetic, never the replica.
--   POS           stands in for the replica subscription DB: RetailTrx, SdDocumentHeader, SdDocumentLog.
--   POS_Analytics the 748 sibling DB the dbt project builds into.
-- Business times are Riyadh local (the POS servers write DateTime.Now in AST), relative to today.
SET NOCOUNT ON;
IF DB_ID('POS') IS NULL CREATE DATABASE POS;
IF DB_ID('POS_Analytics') IS NULL CREATE DATABASE POS_Analytics;
GO
USE POS;
DROP TABLE IF EXISTS dbo.SdDocumentLog, dbo.SdDocumentHeader, dbo.RetailTrx, dbo.Store;
CREATE TABLE dbo.Store (StoreCode varchar(10) PRIMARY KEY, StoreName nvarchar(100), City nvarchar(50), Country char(3));
CREATE TABLE dbo.RetailTrx (
  TrxId bigint IDENTITY PRIMARY KEY, StoreCode varchar(10) NOT NULL, TrxDate datetime NOT NULL,
  TrxType int NOT NULL, TrxStatus int NOT NULL, Amount decimal(18,2) NOT NULL, ExchangeRate decimal(9,4) NOT NULL,
  LoyaltyCustomerID varchar(20) NULL, OrderNo varchar(20) NULL, NphiesEligibilityId varchar(40) NULL);
CREATE TABLE dbo.SdDocumentHeader (
  DocumentNo varchar(20) PRIMARY KEY, DocumentCategory char(1) NOT NULL,   -- O = order, D = delivery
  DocumentType varchar(4) NOT NULL, ParentDocumentNo varchar(20) NULL,      -- a delivery's order
  StoreCode varchar(10) NOT NULL, DocumentSource varchar(10) NOT NULL, DocumentCurrency char(3) NOT NULL,
  EntryTime datetime NOT NULL);
CREATE TABLE dbo.SdDocumentLog (
  LogNo varchar(20) PRIMARY KEY, DocumentNo varchar(20) NOT NULL, EntryTime datetime NOT NULL,
  ActionType varchar(4) NOT NULL, StoreCode varchar(10) NULL);
CREATE INDEX ix_log_time ON dbo.SdDocumentLog (EntryTime) INCLUDE (DocumentNo, ActionType);
CREATE INDEX ix_log_doc ON dbo.SdDocumentLog (DocumentNo, ActionType, EntryTime);
CREATE INDEX ix_trx_date ON dbo.RetailTrx (TrxDate);
CREATE INDEX ix_hdr_time ON dbo.SdDocumentHeader (EntryTime) INCLUDE (DocumentCategory, StoreCode);
GO
DECLARE @now datetime = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS datetime);
DECLARE @today date = CAST(@now AS date);
DECLARE @days int = 120;

;WITH n AS (SELECT TOP 100 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) i FROM sys.all_objects)
INSERT dbo.Store SELECT 'P' + RIGHT('000' + CAST(i AS varchar), 3), N'صيدلية الدواء ' + CAST(i AS nvarchar),
  CASE WHEN i > 95 THEN N'Manama' ELSE CHOOSE(i % 4 + 1, N'Riyadh', N'Jeddah', N'Dammam', N'Makkah') END,
  CASE WHEN i > 95 THEN 'BHR' ELSE 'KSA' END FROM n;

-- Numbers 0..999,999
DROP TABLE IF EXISTS #num;
SELECT TOP 1000000 ROW_NUMBER() OVER (ORDER BY (SELECT 1)) - 1 k INTO #num
FROM sys.all_objects a CROSS JOIN sys.all_objects b CROSS JOIN sys.all_objects c;

-- RetailTrx: 300,000 headers over 120 days (sales 100, returns 110, some 700 finance-only, some status 0).
INSERT dbo.RetailTrx (StoreCode, TrxDate, TrxType, TrxStatus, Amount, ExchangeRate, LoyaltyCustomerID, OrderNo, NphiesEligibilityId)
SELECT s.StoreCode, t.TrxDate,
  CASE WHEN k % 50 = 0 THEN 700 WHEN k % 17 = 0 THEN 110 ELSE 100 END,
  CASE WHEN k % 97 = 0 THEN 0 ELSE 1 END,
  CAST(10 + ABS(CHECKSUM(k, 1)) % 900 AS decimal(18,2)),
  CASE WHEN s.Country = 'BHR' THEN 10 ELSE CASE WHEN k % 3 = 0 THEN 0 ELSE 1 END END,
  CASE WHEN k % 4 = 0 THEN '' WHEN k % 9 = 0 THEN '3795407' ELSE CAST(100000 + k % 50000 AS varchar) END,
  CASE WHEN k % 11 = 0 THEN 'O' + CAST(k AS varchar) END,
  CASE WHEN k % 13 = 0 THEN 'NPH-' + CAST(k AS varchar) END
FROM #num
CROSS APPLY (SELECT 'P' + RIGHT('000' + CAST(1 + k % 100 AS varchar), 3) sc,
                    DATEADD(second, ABS(CHECKSUM(k, 2)) % 86400, CAST(DATEADD(day, -(k % @days), @today) AS datetime)) TrxDate) t
JOIN dbo.Store s ON s.StoreCode = t.sc
WHERE k < 300000 AND t.TrxDate <= @now;

-- Deliveries: 235,000 over 120 days, each with an order header and a delivery header.
DROP TABLE IF EXISTS #d;
SELECT k,
  'O' + RIGHT('000000000' + CAST(k AS varchar), 9) OrderNo,
  'D' + RIGHT('000000000' + CAST(k AS varchar), 9) DeliveryNo,
  -- NEWID, not CHECKSUM(k, n): CHECKSUM over small ints hit only every 4th store and correlated r1 with r2
  'P' + RIGHT('000' + CAST(1 + ABS(CHECKSUM(NEWID())) % 100 AS varchar), 3) StoreCode,
  ABS(CHECKSUM(NEWID())) % 5 src_r,   -- materialised first: CHOOSE is a CASE that re-evaluates NEWID per branch
  DATEADD(second, ABS(CHECKSUM(NEWID())) % 86400, CAST(DATEADD(day, -(k % @days), @today) AS datetime)) OrderTime,
  ABS(CHECKSUM(NEWID())) % 100 r1, ABS(CHECKSUM(NEWID())) % 100 r2
INTO #d FROM #num WHERE k < 235000;
DELETE #d WHERE OrderTime > @now;

INSERT dbo.SdDocumentHeader
SELECT OrderNo, 'O', 'ZORD', NULL, StoreCode, CHOOSE(1 + src_r, 'APP', 'WEB', 'HS', 'TAWN', 'CC'), CASE WHEN StoreCode > 'P095' THEN 'BHD' ELSE 'SAR' END, OrderTime FROM #d
UNION ALL
SELECT DeliveryNo, 'D', 'ZDLV', OrderNo, StoreCode, CHOOSE(1 + src_r, 'APP', 'WEB', 'HS', 'TAWN', 'CC'), CASE WHEN StoreCode > 'P095' THEN 'BHD' ELSE 'SAR' END,
       DATEADD(minute, 1 + r1 % 9, OrderTime) FROM #d;

-- Events: ~7% never log DCRT (2638); 90% delivered; 30% get a second DOFD (re-attempt),
-- 15% a second DDLR (re-post); DRSC is noise outside the four delivery-speed codes.
DROP TABLE IF EXISTS #e;
SELECT d.DeliveryNo, d.StoreCode, v.ActionType, v.At
INTO #e
FROM #d d
CROSS APPLY (VALUES
  ('DCRT', CASE WHEN d.r1 >= 7 THEN DATEADD(minute, 1 + d.r1 % 9, d.OrderTime) END),
  ('DRDY', DATEADD(minute, 10 + d.r2 % 50, d.OrderTime)),
  ('DOFD', DATEADD(minute, 30 + (d.r1 * 7) % 90, d.OrderTime)),
  ('DDLR', CASE WHEN d.r2 < 90 THEN DATEADD(minute, 60 + (d.r1 * 13 + d.r2) % 240, d.OrderTime) END),
  ('DOFD', CASE WHEN d.r1 % 10 < 3 THEN DATEADD(minute, 400 + d.r2 * 3, d.OrderTime) END),
  ('DDLR', CASE WHEN d.r2 < 90 AND d.r1 % 20 < 3 THEN DATEADD(minute, 700 + d.r1 * 5, d.OrderTime) END),
  ('DRSC', CASE WHEN d.r2 % 25 = 0 THEN DATEADD(minute, 20, d.OrderTime) END)
) v(ActionType, At)
WHERE v.At IS NOT NULL AND v.At <= @now;

INSERT dbo.SdDocumentLog (LogNo, DocumentNo, EntryTime, ActionType, StoreCode)
SELECT 'L' + RIGHT('0000000000' + CAST(ROW_NUMBER() OVER (ORDER BY At, DeliveryNo, ActionType) AS varchar), 10),
       DeliveryNo, At, ActionType, StoreCode FROM #e;

SELECT (SELECT COUNT(*) FROM dbo.RetailTrx) retail_trx, (SELECT COUNT(*) FROM dbo.SdDocumentHeader) headers,
       (SELECT COUNT(*) FROM dbo.SdDocumentLog) log_events, (SELECT MAX(EntryTime) FROM dbo.SdDocumentLog) newest_event;
GO
-- Logins (748's provisional names). dbt: db_owner on POS_Analytics, db_datareader ONLY on POS.
-- cube: what Cube would be, db_datareader on POS_Analytics only (used for the mid-swap reads).
USE master;
IF SUSER_ID('svc_analytics_dbt') IS NULL CREATE LOGIN svc_analytics_dbt WITH PASSWORD = 'Spike757!Dbt', DEFAULT_DATABASE = POS_Analytics, CHECK_POLICY = OFF;
IF SUSER_ID('svc_analytics_cube') IS NULL CREATE LOGIN svc_analytics_cube WITH PASSWORD = 'Spike757!Cube', DEFAULT_DATABASE = POS_Analytics, CHECK_POLICY = OFF;
GO
USE POS;
IF USER_ID('svc_analytics_dbt') IS NULL CREATE USER svc_analytics_dbt FOR LOGIN svc_analytics_dbt;
ALTER ROLE db_datareader ADD MEMBER svc_analytics_dbt;
GO
USE POS_Analytics;
IF USER_ID('svc_analytics_dbt') IS NULL CREATE USER svc_analytics_dbt FOR LOGIN svc_analytics_dbt;
ALTER ROLE db_owner ADD MEMBER svc_analytics_dbt;
IF USER_ID('svc_analytics_cube') IS NULL CREATE USER svc_analytics_cube FOR LOGIN svc_analytics_cube;
ALTER ROLE db_datareader ADD MEMBER svc_analytics_cube;
GO
