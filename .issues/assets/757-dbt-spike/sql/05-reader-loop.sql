-- Ticket 757 item 2: what a reader (Cube's login) sees of today's slice while dbt swaps it.
-- sqlcmd -v secs=70 iso=1   (1 = READ COMMITTED, the default; 0 = READ UNCOMMITTED). Samples SUM(till_sales) for today.
SET NOCOUNT ON; SET LOCK_TIMEOUT -1;
IF $(iso) = 1 SET TRANSACTION ISOLATION LEVEL READ COMMITTED ELSE SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
DECLARE @r TABLE (at datetime2(3), n bigint, ms int);
DECLARE @end datetime2 = DATEADD(second, $(secs), SYSUTCDATETIME()), @t datetime2, @n bigint;
DECLARE @today date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date);
WHILE SYSUTCDATETIME() < @end
BEGIN
  SET @t = SYSUTCDATETIME();
  SELECT @n = ISNULL(SUM(till_sales), 0) FROM dbo.mart_till_sales_daily WHERE sales_date = @today;
  INSERT @r VALUES (@t, @n, DATEDIFF(millisecond, @t, SYSUTCDATETIME()));
END
SELECT n AS today_till_sales, COUNT(*) samples, MIN(at) first_utc, MAX(at) last_utc, MAX(ms) longest_read_ms
FROM @r GROUP BY n ORDER BY MIN(at);
