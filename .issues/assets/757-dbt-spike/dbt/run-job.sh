#!/bin/sh
# Ticket 757 — what the scheduler runs (item 5 + 7):  run-job.sh intraday|nightly [extra dbt args]
# Fail CLOSED: freshness first. `dbt build` does not check source freshness itself, so a stale
# source must stop the job here, before any model swaps a day. The failure is still logged.
set -u
job="$1"; shift
export DBT_JOB="$job"
case "$job" in
  nightly) lookback='{lookback_days: 3}' ;;
  intraday) lookback='{lookback_days: null}' ;;
  *) echo "unknown job $job" >&2; exit 2 ;;
esac

if ! dbt source freshness --select "source:pos"; then
  dbt run-operation log_job_failure --args "{job: $job, status: stale_source, message: 'dbt source freshness failed; no model ran'}" || true
  exit 3
fi
exec dbt build --select "tag:$job" --vars "$lookback" "$@"
