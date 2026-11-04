# 756 — Cube Core spike: assets

Run 2026-11-04 on the dev machine. Docker daemon = the dev Mac (arm64); SQL Server 2022 and Cube
Store ran **amd64 under emulation**, Cube API ran native arm64. Never pointed at the replica.

| Image | Pin |
|---|---|
| `cubejs/cube:v1.8.18` | `sha256:d382326a…5dcb7` (Apache-2.0 Core) |
| `cubejs/cubestore:v1.8.18` | `sha256:bc26e36e…1d62e` (amd64 only: there is **no arm64 Cube Store image**) |
| `mcr.microsoft.com/mssql/server:2022-latest` | `sha256:cf8f0ab2…1718` = **16.0.4305.5, 2022 RTM-CU27-GDR**, Developer |

## Files

- [`docker-compose.yml`](docker-compose.yml) — the topology, declaratively. This machine's Docker
  CLI has no `compose` plugin, so it was run through [`up.sh`](up.sh), the same containers with
  plain `docker run` (`./up.sh db`, then `./up.sh cube` after each model change).
- [`Dockerfile`](Dockerfile) — the pinned Cube image plus `COPY model/ cube.js` (the daemon is remote,
  so it cannot see a bind mount of this Windows folder).
- [`cube.js`](cube.js) — the `driverFactory` that sets `trustServerCertificate` (no env var exists).
- [`model/cubes/till_sales_daily.yml`](model/cubes/till_sales_daily.yml) and
  [`model/views/till_sales_view.yml`](model/views/till_sales_view.yml) — the cut-down model. The file
  as it stands is **variant B**: the cubes are `public: false` and only the view is public.
  Variant A (cubes public) is that file without the two cube-level `public: false` lines.
- [`sql/01-seed.sql`](sql/01-seed.sql) — `POS_Spike` (raw stand-in, Cube has no access) and
  `POS_Analytics` (a `mart_till_sales_daily` of 15,000 rows plus `dim_store`). It also creates the
  `cube_reader` login (db_datareader only), a database DDL trigger and an XE session that records
  every statement and error from `cube_reader`.
  [`sql/02-trace.sql`](sql/02-trace.sql) and [`sql/03-slow-trace.sql`](sql/03-slow-trace.sql) read that XE session.
- [`probe.mjs`](probe.mjs) — the client. It mints the HS256 service JWT by hand (no library), runs
  each step and writes `evidence/<step>.json` (request, status, response, ms, "Continue wait" polls).
- [`evidence/`](evidence/) — one file per call. Bodies over 20 rows are trimmed to 5, with
  `dataTrimmedForRepo` recording the count. `trace-full.txt` is the whole XE capture.

## Re-run

```bash
./up.sh db                       # wait ~15 s for SQL Server
sqlcmd -S <docker-host>,14330 -U sa -P 'Spike756!Sa' -f 65001 -i sql/01-seed.sql
./up.sh cube                     # ~35 s until the refresh worker has built the rollup
node probe.mjs auth meta load rollup limits slow variantB source
SPIKE_TRUST_CERT=0 ./up.sh cube  # reproduces the self-signed failure (the process exits)
```

The secrets in these files are spike-only values for a throwaway local container.
