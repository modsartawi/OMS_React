# 757 — dbt-sqlserver spike: assets

Run 2026-11-04 on the dev machine. The Docker daemon is the dev Mac (arm64), reached over tcp.
SQL Server 2022 ran **amd64 under emulation**; the dbt image ran native arm64. Everything is
synthetic and local. Nothing was ever pointed at the replica.

| Piece | Pin |
|---|---|
| `mcr.microsoft.com/mssql/server:2022-latest` | `sha256:cf8f0ab2…1718` = **16.0.4305.5, 2022 RTM-CU27-GDR**, Developer (the 756 pin) |
| `python:3.12-slim-bookworm` | `sha256:e697c818…cdda` (arm64 here) |
| `msodbcsql18` | 18.7.1.1-1 (Microsoft's Debian 12 repo), `unixodbc` 2.3.11 |
| `dbt-core` / `dbt-sqlserver[pyodbc]` / `pyodbc` | **1.12.6 / 1.12.2 / 5.3.0**; every transitive pin in [`requirements.txt`](requirements.txt) (frozen: [`requirements.lock.txt`](requirements.lock.txt)) |
| Anonymous usage stats | off: `DBT_SEND_ANONYMOUS_USAGE_STATS=false` in the image and `flags.send_anonymous_usage_stats: false` in the project |

## Files

- [`Dockerfile`](Dockerfile) — the scheduled container (item 7). There is no official dbt-labs image
  for dbt-sqlserver, a community adapter.
- [`dbt/`](dbt/) — the project:
  - [`dbt_project.yml`](dbt/dbt_project.yml), [`profiles.yml`](dbt/profiles.yml) (no secrets),
    [`models/sources.yml`](dbt/models/sources.yml);
  - the marts [`mart_till_sales_daily`](dbt/models/marts/mart_till_sales_daily.sql) and
    [`fct_delivery`](dbt/models/marts/fct_delivery.sql), the seed
    [`channel_map.csv`](dbt/seeds/channel_map.csv), and the nightly reconciliation test
    [`till_value_reconciles_yesterday.sql`](dbt/tests/till_value_reconciles_yesterday.sql);
  - the macros: [`time.sql`](dbt/macros/time.sql) (Riyadh time, lookback, the spike pause),
    [`load_log.sql`](dbt/macros/load_log.sql) (item 6) and
    [`freshness.sql`](dbt/macros/freshness.sql) (a UTC freshness compare);
  - [`run-job.sh`](dbt/run-job.sh), the job entrypoint: freshness first, then build.
- [`schedule/crontab.example`](schedule/crontab.example) — how the analytics host would schedule the
  jobs, with the fixed container name as the overlap guard. It is not installed anywhere.
- [`sql/`](sql/):
  - `01-seed.sql` — the synthetic `POS` and the logins;
  - `02-audit.sql` — the XE session and POS's DDL trigger;
  - `03`, `04`, `06`, `07` — the audit reads;
  - `05-reader-loop.sql` — the mid-swap sampler;
  - `08-percentile-timing.sql` and `09-inc-sample.sql` — item 4;
  - `10-swap-statement.sql` — the delete+insert dbt sends.
- [`inc-check/`](inc-check/Program.cs) — `DispatchScorecardMath.Percentile`, copied verbatim, run over
  the same samples (`dotnet run -- ../evidence/4c-inc-sample-values.txt`).
- [`kill-test.sh`](kill-test.sh) — item 2's kill mid-swap.
- [`up.sh`](up.sh), [`run.sh`](run.sh) and [`sq.sh`](sq.sh) — start SQL Server and build the image,
  run one dbt command in a container, and run sqlcmd.
- [`evidence/`](evidence/) — one file per step, prefixed with its item number.

## Two machine quirks (not dbt's)

- **The remote Docker client drops an attached container's output after any pause.**
  `sh -c 'echo a; sleep 3; echo b'` prints only `a`. Every dbt run therefore goes detached, then
  `docker wait`, then `docker logs` ([`run.sh`](run.sh)). The first "dbt prints nothing" scare was
  this.
- **Git Bash rewrites `/dbt/run-job.sh` into `C:/Program Files/Git/dbt/run-job.sh`.**
  `MSYS_NO_PATHCONV=1` in `run.sh` stops it. Also, `core.autocrlf=true` checks the shell scripts out
  as CRLF, which breaks their shebang inside Linux. [`.gitattributes`](.gitattributes) forces LF, and
  the Dockerfile strips CR too.

## Re-run

```bash
./up.sh db                                   # ~15 s until SQL Server takes logins
./sq.sh -U sa -P 'Spike757!Sa' -t 1800 -i sql/01-seed.sql
./sq.sh -U sa -P 'Spike757!Sa' -i sql/02-audit.sql
./up.sh image
./run.sh debug
./run.sh build --full-refresh                 # first build
ENTRY=/dbt/run-job.sh ./run.sh intraday       # the scheduled job: freshness, then build tag:intraday
ENTRY=/dbt/run-job.sh ./run.sh nightly        # lookback 3 + tests
./kill-test.sh A-rcsi-off 500                 # item 2 (then ALTER DATABASE … READ_COMMITTED_SNAPSHOT ON, and C-rcsi-on)
```

The passwords in these files are spike-only values for a throwaway local container.
