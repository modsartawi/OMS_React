/* ============================================================================================
   741 / ticket 742 — replica headroom probe. READ-ONLY.

   Target : 172.23.27.47 / POS (DWPOSREPL03), the `read` login (db_datareader, CREATE TABLE = 0).
   Writes : none. No #temp, no table variables over data, no indexes. Every data read is date-bounded.
   Run    : on the corporate network, in SSMS, or with the sanctioned sqlcmd shape plus `-i` and `-o`:
              $b = New-Object System.Data.SqlClient.SqlConnectionStringBuilder `
                   ([Environment]::GetEnvironmentVariable('POS_REPLICA_READONLY','User'))
              sqlcmd -S $b.DataSource -d $b.InitialCatalog -U $b.UserID -P $b.Password -C -l 20 `
                     -t 1800 -W -s "|" -i docs\research\741-replica-probe.sql `
                     -o docs\research\741-replica-probe.out.txt
           Run it TWICE: once at a busy hour (about 13:00 or 21:00 local) and once off-hours. Rename
           the second output to *.offhours.txt. Paste both back, or leave them beside this file
           (they hold aggregates only, no personal data).
   Time   : P6 dominates. Expect 5–20 minutes in total. Every section prints its own elapsed ms.
   ============================================================================================ */
SET NOCOUNT ON;
SET ANSI_WARNINGS OFF;   -- suppresses "Null value is eliminated" noise in the output
DECLARE @t0 DATETIME2, @label VARCHAR(80);

/* P1 — identity, edition, database flags ------------------------------------------------------ */
SELECT  [Server]        = @@SERVERNAME,
        [Edition]       = SERVERPROPERTY('Edition'),
        [EngineEdition] = SERVERPROPERTY('EngineEdition'),   -- 3 = Enterprise/Developer, 2 = Standard
        [Version]       = SERVERPROPERTY('ProductVersion'),
        [Now]           = SYSDATETIME();

SELECT  name, compatibility_level, recovery_model_desc, is_subscribed, is_published,
        is_read_committed_snapshot_on, snapshot_isolation_state_desc,
        is_query_store_on, create_date
FROM    sys.databases
WHERE   database_id > 4;                                        -- every user DB: shows any sibling

/* P2 — the in-scope tables: present?, rows, every index ---------------------------------------- */
SELECT  t.TableName,
        Present = CASE WHEN OBJECT_ID('dbo.' + t.TableName, 'U') IS NULL THEN 'MISSING' ELSE 'yes' END
FROM (VALUES ('RetailTrx'),('RetailTrxDetail'),('RetailTrxPayment'),
             ('SdDocumentHeader'),('SdDocumentLine'),('SdDocumentLog'),('SdDocumentSource'),
             ('DocumentSource'),('SdDocumentActionType'),('SdDocumentHeaderStatus'),
             ('SdDocumentDeliveryType'),('SdDocumentType'),
             ('Callout'),('CalloutBid'),('CalloutEvent'),('DispatchBoardRelease'),
             ('Store'),('StoreGroup'),('Staff'),('Material'),
             ('LoyCustomerFirstPurchase'),('MSreplication_subscriptions')) AS t(TableName)
ORDER BY Present, t.TableName;

SELECT  TableName  = o.name,
        IndexName  = ISNULL(i.name, '(heap)'),
        IndexType  = i.type_desc,                               -- look for NONCLUSTERED COLUMNSTORE
        i.is_primary_key, i.has_filter,
        [Rows]     = SUM(CASE WHEN i.index_id IN (0,1) OR i.type IN (5,6) THEN p.rows ELSE 0 END),
        Partitions = COUNT(*)
FROM    sys.objects o
JOIN    sys.indexes i    ON i.object_id = o.object_id
JOIN    sys.partitions p ON p.object_id = i.object_id AND p.index_id = i.index_id
WHERE   o.type = 'U'
  AND   o.name IN ('RetailTrx','RetailTrxDetail','RetailTrxPayment','SdDocumentHeader','SdDocumentLine',
                   'SdDocumentLog','SdDocumentSource','DocumentSource','Callout','CalloutBid',
                   'CalloutEvent','DispatchBoardRelease','Store','Material')
GROUP BY o.name, i.name, i.type_desc, i.is_primary_key, i.has_filter, i.index_id
ORDER BY o.name, i.index_id;

-- Key columns of every index on the four big tables (does any rowstore index lead on a date?)
SELECT  TableName = OBJECT_NAME(ic.object_id), IndexName = i.name, ic.key_ordinal,
        ColumnName = c.name, ic.is_included_column
FROM    sys.index_columns ic
JOIN    sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
JOIN    sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE   OBJECT_NAME(ic.object_id) IN ('RetailTrx','RetailTrxDetail','SdDocumentHeader','SdDocumentLog')
  AND   i.type <> 6                                             -- NCCI lists every column: skip
ORDER BY TableName, IndexName, ic.is_included_column, ic.key_ordinal;

-- Who else lives in POS: user views / procs / schema-bound views (reinit hazards)
SELECT  o.type_desc, Cnt = COUNT(*),
        SchemaBound = SUM(CASE WHEN OBJECTPROPERTY(o.object_id, 'IsSchemaBound') = 1 THEN 1 ELSE 0 END)
FROM    sys.objects o WHERE o.type IN ('V','P','FN','IF','TF') AND o.is_ms_shipped = 0
GROUP BY o.type_desc;

/* P3 — replication state and lag proxies -------------------------------------------------------- */
IF OBJECT_ID('dbo.MSreplication_subscriptions') IS NOT NULL
    EXEC('SELECT publisher, publisher_db, publication, subscription_type, [time] AS LastAgentWrite,
                 DATEDIFF(SECOND, [time], GETDATE()) AS SecondsSinceAgentWrite
          FROM dbo.MSreplication_subscriptions');
ELSE SELECT 'no MSreplication_subscriptions visible to this login' AS ReplicationState;

-- Freshness of the data itself: newest row vs. now (a crude end-to-end lag figure)
SELECT  Src = 'RetailTrx',        Newest = MAX(TrxDate),   LagMin = DATEDIFF(MINUTE, MAX(TrxDate), GETDATE())
FROM    RetailTrx        WHERE TrxDate >= DATEADD(DAY, -2, GETDATE()) AND TrxDate <= GETDATE()
UNION ALL
SELECT  'SdDocumentLog',          MAX(EntryTime),          DATEDIFF(MINUTE, MAX(EntryTime), GETDATE())
FROM    SdDocumentLog    WHERE EntryTime >= DATEADD(DAY, -2, GETDATE()) AND EntryTime <= GETDATE()
UNION ALL
SELECT  'SdDocumentHeader',       MAX(EntryTime),          DATEDIFF(MINUTE, MAX(EntryTime), GETDATE())
FROM    SdDocumentHeader WHERE EntryTime >= DATEADD(DAY, -2, GETDATE()) AND EntryTime <= GETDATE();

/* P4 — what this login may see about load (decides which P5 rows come back) ---------------------- */
SELECT  ViewServerState   = HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE'),
        ViewDatabaseState = HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'VIEW DATABASE STATE'),
        ShowPlan          = HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'SHOWPLAN');

/* P5 — hardware and other traffic (only if VIEW SERVER STATE; otherwise a DBA question) ---------- */
IF HAS_PERMS_BY_NAME(NULL, NULL, 'VIEW SERVER STATE') = 1
BEGIN
    EXEC('SELECT cpu_count, hyperthread_ratio, physical_memory_kb / 1024 AS MemoryMB,
                 committed_target_kb / 1024 AS BufferTargetMB, sqlserver_start_time
          FROM sys.dm_os_sys_info');
    EXEC('SELECT login_name, program_name, Sessions = COUNT(*),
                 CpuMs = SUM(cpu_time), Reads = SUM(logical_reads)
          FROM sys.dm_exec_sessions WHERE is_user_process = 1
          GROUP BY login_name, program_name ORDER BY CpuMs DESC');
    EXEC('SELECT TOP 10 wait_type, wait_time_ms, waiting_tasks_count FROM sys.dm_os_wait_stats
          WHERE wait_type NOT LIKE ''SLEEP%'' AND wait_type NOT LIKE ''%QUEUE%''
            AND wait_type NOT IN (''BROKER_TASK_STOP'',''CHECKPOINT_QUEUE'',''XE_TIMER_EVENT'',
                                  ''DIRTY_PAGE_POLL'',''HADR_FILESTREAM_IOMGR_IOCOMPLETION'',''SOS_WORK_DISPATCHER'')
          ORDER BY wait_time_ms DESC');
END
ELSE SELECT 'VIEW SERVER STATE denied: hardware + other-traffic rows go to the DBA checklist' AS P5;

/* P6 — representative aggregates, timed. Anchor = yesterday (a whole day). ---------------------- */
DECLARE @d1 DATETIME = CAST(CAST(GETDATE() AS DATE) AS DATETIME);  -- today 00:00 (exclusive end)
DECLARE @w1 DATETIME = DATEADD(DAY, -1,  @d1),
        @w7 DATETIME = DATEADD(DAY, -7,  @d1),
        @w92 DATETIME = DATEADD(DAY, -92, @d1);
DECLARE @r TABLE (Label VARCHAR(80), Ms INT, ResultRows INT);
DECLARE @n INT;

-- Till sales, header, by store
SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, Trx = COUNT(*), Amt = SUM(Amount) FROM RetailTrx
    WHERE TrxDate >= @w1 AND TrxDate < @d1 AND TrxStatus = 1 GROUP BY StoreCode) x;
INSERT @r VALUES ('RetailTrx 1d by store', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, Trx = COUNT(*), Amt = SUM(Amount) FROM RetailTrx
    WHERE TrxDate >= @w7 AND TrxDate < @d1 AND TrxStatus = 1 GROUP BY StoreCode) x;
INSERT @r VALUES ('RetailTrx 7d by store', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, Trx = COUNT(*), Amt = SUM(Amount) FROM RetailTrx
    WHERE TrxDate >= @w92 AND TrxDate < @d1 AND TrxStatus = 1 GROUP BY StoreCode) x;
INSERT @r VALUES ('RetailTrx 92d by store', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

-- Till sales by city (join to the store master) and by channel (DocumentType), 92 days
SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT s.City, Trx = COUNT(*), Amt = SUM(t.Amount)
    FROM RetailTrx t JOIN Store s ON s.StoreCode = t.StoreCode
    WHERE t.TrxDate >= @w92 AND t.TrxDate < @d1 AND t.TrxStatus = 1 GROUP BY s.City) x;
INSERT @r VALUES ('RetailTrx 92d by city', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT DocumentType, d = CAST(TrxDate AS DATE), Trx = COUNT(*), Amt = SUM(Amount)
    FROM RetailTrx WHERE TrxDate >= @w92 AND TrxDate < @d1 AND TrxStatus = 1
    GROUP BY DocumentType, CAST(TrxDate AS DATE)) x;
INSERT @r VALUES ('RetailTrx 92d by channel x day', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

-- Till lines (1.0B rows): 7d and 92d by store
SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, Lines = COUNT(*), Qty = SUM(Quantity), Amt = SUM(Amount)
    FROM RetailTrxDetail WHERE TrxDate >= @w7 AND TrxDate < @d1 GROUP BY StoreCode) x;
INSERT @r VALUES ('RetailTrxDetail 7d by store', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, Lines = COUNT(*), Qty = SUM(Quantity), Amt = SUM(Amount)
    FROM RetailTrxDetail WHERE TrxDate >= @w92 AND TrxDate < @d1 GROUP BY StoreCode) x;
INSERT @r VALUES ('RetailTrxDetail 92d by store', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

-- Orders (no columnstore expected): 1d, 7d, 92d by store and source
SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, DocumentSource, Docs = COUNT(*), Net = SUM(NetTotal)
    FROM SdDocumentHeader WHERE EntryTime >= @w1 AND EntryTime < @d1 GROUP BY StoreCode, DocumentSource) x;
INSERT @r VALUES ('SdDocumentHeader 1d by store x source', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, DocumentSource, Docs = COUNT(*), Net = SUM(NetTotal)
    FROM SdDocumentHeader WHERE EntryTime >= @w7 AND EntryTime < @d1 GROUP BY StoreCode, DocumentSource) x;
INSERT @r VALUES ('SdDocumentHeader 7d by store x source', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, DocumentSource, Docs = COUNT(*), Net = SUM(NetTotal)
    FROM SdDocumentHeader WHERE EntryTime >= @w92 AND EntryTime < @d1 GROUP BY StoreCode, DocumentSource) x;
INSERT @r VALUES ('SdDocumentHeader 92d by store x source', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT s.City, h.DocumentType, Docs = COUNT(*), Net = SUM(h.NetTotal)
    FROM SdDocumentHeader h JOIN Store s ON s.StoreCode = h.StoreCode
    WHERE h.EntryTime >= @w92 AND h.EntryTime < @d1 GROUP BY s.City, h.DocumentType) x;
INSERT @r VALUES ('SdDocumentHeader 92d by city x type', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

-- Delivery action log: 7d and 92d by store x action
SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, ActionType, Events = COUNT(*)
    FROM SdDocumentLog WHERE EntryTime >= @w7 AND EntryTime < @d1 GROUP BY StoreCode, ActionType) x;
INSERT @r VALUES ('SdDocumentLog 7d by store x action', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

SET @t0 = SYSDATETIME();
SELECT @n = COUNT(*) FROM (SELECT StoreCode, ActionType, Events = COUNT(*)
    FROM SdDocumentLog WHERE EntryTime >= @w92 AND EntryTime < @d1 GROUP BY StoreCode, ActionType) x;
INSERT @r VALUES ('SdDocumentLog 92d by store x action', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);

-- Callouts, only if replicated
IF OBJECT_ID('dbo.Callout', 'U') IS NOT NULL
BEGIN
    SET @t0 = SYSDATETIME();
    EXEC sp_executesql N'SELECT @n = COUNT(*) FROM (SELECT Status, AwardedParty, Cnt = COUNT(*) FROM Callout
        WHERE OpenedAt >= @f AND OpenedAt < @t GROUP BY Status, AwardedParty) x',
        N'@n INT OUTPUT, @f DATETIME, @t DATETIME', @n OUTPUT, @w92, @d1;
    INSERT @r VALUES ('Callout 92d by status x party', DATEDIFF(MILLISECOND, @t0, SYSDATETIME()), @n);
END

SELECT * FROM @r;
