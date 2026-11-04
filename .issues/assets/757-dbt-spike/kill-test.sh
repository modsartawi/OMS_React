#!/usr/bin/env bash
# Ticket 757 item 2: kill dbt mid-swap. Usage: ./kill-test.sh <label> <extra-sales-to-add>
# 1. sa adds N sales for today in POS (so the new slice differs from the old)
# 2. a reader loop (svc_analytics_cube) samples today's slice for 75 s, at the DB's default isolation
# 3. dbt rebuilds the mart with the swap transaction held open 40 s (spike_pause_s)
# 4. once dbt's session sits in WAITFOR (after delete+insert, before COMMIT): probes, then docker kill
set -uo pipefail
label=$1; extra=$2; out=evidence/2-kill-$label; mkdir -p $out
SA="-U sa -P Spike757!Sa"; CUBE="-U svc_analytics_cube -P Spike757!Cube -d POS_Analytics"
./sq.sh $SA -d POS_Analytics -Q "SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE name='POS_Analytics'" > $out/0-db-option.txt
./sq.sh $CUBE -Q "SELECT ISNULL(SUM(till_sales),0) today_before FROM mart_till_sales_daily WHERE sales_date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date)" > $out/1-before.txt
./sq.sh $SA -d POS -Q "INSERT RetailTrx (StoreCode, TrxDate, TrxType, TrxStatus, Amount, ExchangeRate, LoyaltyCustomerID) SELECT TOP ($extra) 'P001', CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS datetime), 100, 1, 50, 1, '' FROM sys.all_objects; SELECT COUNT(*) today_source_sales FROM RetailTrx WHERE TrxStatus=1 AND TrxType=100 AND TrxDate >= CAST(CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date) AS datetime)" > $out/2-source-after-insert.txt
( ./sq.sh $CUBE -v secs=75 iso=1 -i sql/05-reader-loop.sql > $out/5-reader-loop-read-committed.txt 2>&1 ) &
loop=$!
sleep 2
DETACH=1 ./run.sh run --select mart_till_sales_daily --vars '{spike_pause_s: 40}'
for i in $(seq 1 60); do
  w=$(./sq.sh $SA -h -1 -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM sys.dm_exec_requests r JOIN sys.dm_exec_sessions s ON s.session_id=r.session_id WHERE s.login_name='svc_analytics_dbt' AND r.wait_type='WAITFOR'")
  [[ ${w// /} == 1 ]] && break; sleep 1
done
date -u +%T > $out/3-mid-swap-at-utc.txt
./sq.sh $SA -Q "SELECT s.session_id, r.command, r.wait_type, r.open_transaction_count, t.transaction_begin_time FROM sys.dm_exec_sessions s JOIN sys.dm_exec_requests r ON r.session_id=s.session_id LEFT JOIN sys.dm_tran_session_transactions st ON st.session_id=s.session_id LEFT JOIN sys.dm_tran_active_transactions t ON t.transaction_id=st.transaction_id WHERE s.login_name='svc_analytics_dbt'; SELECT resource_type, request_mode, COUNT(*) locks FROM sys.dm_tran_locks l JOIN sys.dm_exec_sessions s ON s.session_id=l.request_session_id WHERE s.login_name='svc_analytics_dbt' AND resource_database_id=DB_ID('POS_Analytics') GROUP BY resource_type, request_mode" >> $out/3-mid-swap-at-utc.txt
./sq.sh $CUBE -Q "SET LOCK_TIMEOUT 3000; SELECT ISNULL(SUM(till_sales),0) today_read_committed FROM mart_till_sales_daily WHERE sales_date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date)" > $out/4a-mid-swap-read-committed.txt 2>&1
./sq.sh $CUBE -Q "SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED; SELECT ISNULL(SUM(till_sales),0) today_nolock, COUNT(*) rows_today FROM mart_till_sales_daily WHERE sales_date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date)" > $out/4b-mid-swap-read-uncommitted.txt 2>&1
docker kill spike757-dbt > /dev/null; date -u +%T > $out/6-killed-at-utc.txt
docker logs spike757-dbt > $out/6-dbt-log-until-kill.txt 2>&1; docker rm spike757-dbt >/dev/null
wait $loop
sleep 3
./sq.sh $CUBE -Q "SELECT ISNULL(SUM(till_sales),0) today_after_kill FROM mart_till_sales_daily WHERE sales_date = CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS date)" > $out/7-after-kill.txt
./sq.sh $SA -d POS_Analytics -Q "SELECT name, type, create_date FROM sys.objects WHERE is_ms_shipped=0 AND type IN ('U','V') ORDER BY name; SELECT COUNT(*) open_dbt_sessions FROM sys.dm_exec_sessions WHERE login_name='svc_analytics_dbt'; SELECT TOP 3 load_id, model_name, status, logged_at_utc FROM mart_load_log ORDER BY load_id DESC" > $out/8-leftovers-after-kill.txt
head -50 $out/*.txt
