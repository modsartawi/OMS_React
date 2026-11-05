# 741 / 749 — What IT and the DBA provide before the analytics build starts

The checklist for
[IT approves the on-prem hosts and service logins for the analytics stack](../../.issues/749-it-approves-the-on-prem-hosts-and-service-logins-for-the-analytics-stack.md).
It covers the stack the map settled: Cube Core with Cube Store (743, 756), and dbt-sqlserver into
`POS_Analytics` (748, 757). SIS.Api is the only caller (746, 747). Metabase is **not** in v1, so
nothing here provisions it.

Written 2026-11-04. Every sizing figure and every "recommended" choice is the agent's call. The
owner may overrule any of them. Facts measured on the replica that day are marked **(measured)**.

> **Amended 2026-11-05 (owner ruling): §1 and §2 are superseded.** Infra already runs our apps as
> containers on Nutanix, so there is no new VM. The stack ships as **one image** (Cube API with its
> refresh worker, Cube Store on localhost only, and dbt with its schedule inside, overlap guarded by
> a lock file). Infra runs it as one instance, with an **internal-only** DNS name and a Cloudflare
> certificate on 443, SIS.Api in, `DWPOSREPL03:1433` out, no disk, no internet. **D8 is (a):** pin
> the replica's current certificate; the internal-CA certificate is no longer asked. The live ask
> is [741-nutanix-infra-request.md](741-nutanix-infra-request.md). §3 (the DBA half) stands as
> done.

## 0. What the build needs, on one line

One Linux amd64 VM with Docker runs four containers. It reaches `DWPOSREPL03:1433` and is reached
only by SIS.Api. It needs a sibling DB, `POS_Analytics`, with two SQL logins. It adds **no**
internet egress.

```
browser ──► SIS.Api (IIS, existing) ──HTTPS 443──► analytics host ──TDS 1433──► DWPOSREPL03
                │                                    cube-api · cube-refresh · cubestore · dbt (cron)
                └──HTTPS──► model API (734 D9, unchanged)
```

## 1. IT — the analytics host

| # | Item | Recommended | Why |
|---|---|---|---|
| H1 | **One VM, Linux, x86-64 (amd64)** | Ubuntu 24.04 LTS, or IT's standard RHEL 9 | Cube Store has **no arm64 image** (756). The spikes never tried Windows-native Cube Store, so a Windows host is not an option. |
| H2 | **Sizing** | **8 vCPU, 32 GB RAM, 150 GB SSD** (40 GB OS, 110 GB `/var/lib/docker` and Cube Store data). The floor is 4 vCPU and 16 GB. | Cube Store keeps rollups in memory and on local disk. dbt jobs are short (8–11 s cold, 757). The rollups are small: about 1,561 stores **(measured)** × days × channel. The headroom is for the 30 s auto-refresh boards (755) hitting Cube's cache. |
| H3 | **Container runtime** | Docker Engine with the compose plugin, from the distro or Docker's repo. Podman with compose is acceptable if it is IT's standard. | The four services are a single compose file. The dbt overlap guard needs `docker run --name` (757). |
| H4 | **Scheduler** | Host `cron` or a systemd timer that starts the dbt container: intraday every 15 minutes, nightly at 03:00 Riyadh time (748). | It keeps Python and our jobs off `DWPOSREPL03` and out of the DBA's SQL Agent (748). |
| H5 | **Images reach the host offline** | We build and pin the images by digest, `docker save` them, and IT copies the tarballs in. | The host then needs **no** registry, PyPI or `packages.microsoft.com` egress. If IT prefers it, allow pull-only egress to `registry-1.docker.io`, `mcr.microsoft.com` and `ghcr.io` during install, and close it afterwards. |
| H6 | **Telemetry off** | `CUBEJS_TELEMETRY=false` and `CUBESTORE_TELEMETRY=false`. dbt `send_anonymous_usage_stats: false`. | With telemetry off and offline images, the host makes **zero** outbound internet calls. |
| H7 | **Secrets on the host** | One env file per service, mode `0600`, owned by the service account. The files hold `CUBEJS_DB_PASS`, `CUBEJS_API_SECRET` and `DBT_ENV_SECRET_PASSWORD` (757). | No secret goes in the repo or the image. |
| H8 | **Backups** | No VM backup is required. An image-level snapshot after install is enough. | Cube Store is rebuilt from `POS_Analytics`. The model comes from the BackOffice repo. Saved views and boards live in **SIS.Api's** store (755), not on this host. |
| H9 | **Two environments, one host** | Staging SIS.Api and production SIS.Api both call the **same** analytics host, which reads the production replica. | There is only one replica, and it is production's. v1 is aggregate-only, HQ-only, with no PII member (745), so staging seeing production aggregates is acceptable. The owner may overrule this and ask for a second host. |

## 2. IT — network paths (firewall lines)

| # | From → to | Port | Notes |
|---|---|---|---|
| N1 | **SIS.Api host(s)** (production behind `oms-backoffice.al-dawaa.com`, plus staging) **→ analytics host** | **TCP 443** | Cube's API, behind a TLS-terminating reverse proxy container (nginx or Caddy) with an **internal-CA certificate**. Only SIS.Api's source IPs are allowed. Each call also carries a short-lived HS256 JWT signed with `CUBEJS_API_SECRET`. SIS.Api holds that secret in its server secret config, as 734 D9 does for the model key. |
| N2 | **Analytics host → `DWPOSREPL03` (172.23.27.47)** | **TCP 1433** | Both dbt (reads `POS`, writes `POS_Analytics`) and Cube (reads `POS_Analytics`) use it. The connection is encrypted (see D8). |
| N3 | **No browser → analytics host** | — | Users reach only SIS.Api (747). Port 4000 (Cube) and Cube Store's ports are never published off the host. Cube Store has **no auth** and stays on the compose network (756). |
| N4 | Admin SSH to the analytics host | TCP 22 | From IT's usual jump host only. |
| N5 | **Model egress** | — | **Unchanged.** It stays the one line 734 D9 approved: the SIS.Api host → the model API. The analytics stack adds **no** egress line. ⚠ This is a 734 matter, not this map's: D9 names only the Anthropic line, but 734 D4 also ships a Gemini connector. Switching it on would need a second line from SIS.Api → `generativelanguage.googleapis.com`. |
| N6 | NTP and DNS | as standard | The freshness gate compares UTC times (757). |

## 3. DBA — `DWPOSREPL03`

Measured 2026-11-04: **Enterprise Edition, SQL Server 2019** (15.0.4470.1). The sibling DBs `ZC` and
`BusinessMonitor` already exist, which is a precedent for item D1 **(measured)**.

| # | Item | Recommended |
|---|---|---|
| D1 | **Create `POS_Analytics`** on `DWPOSREPL03`, outside the publication. | Compatibility level **150**. The DB survives a reinitialisation of `POS` (748). |
| D2 | **Size budget** | Start the data file at 10 GB and the log at 2 GB, autogrow by 1 GB, **capped at 40 GB**. Estimate: `fct_delivery` has one row per delivery. About 7.1M `DeliveryHeader` rows exist all-time **(measured)**, so it is around 1–3 GB with its indexes. The daily marts are under 1 GB. The cap leaves several years of growth. |
| D3 | **Recovery and backups** | `SIMPLE` recovery. No backups are required, because the marts rebuild from `POS`, which holds the full history. The DBA may still take a weekly full. |
| D4 | **`READ_COMMITTED_SNAPSHOT ON`** for `POS_Analytics` | **Required.** A NOLOCK reader saw a ~5 ms gap mid-swap (757). It sits beside `POS`'s own RCSI, which is already on (750). |
| D5 | **Login `svc_analytics_dbt`**, SQL authentication, policy on | `db_owner` on `POS_Analytics`. **`db_datareader` on `POS`**, with nothing written there (757: 107 reads, 0 writes). Why a role, not table grants: a reinit whose `@pre_creation_cmd` is `drop` re-creates the articles, and per-table `GRANT SELECT` would vanish with them. Role membership survives. |
| D6 | **Login `svc_analytics_cube`**, SQL authentication, policy on | `db_datareader` on `POS_Analytics` **only**. It gets **no user in `POS`**, so the interactive engine cannot touch the replica (748). |
| D7 | **Resource Governor** (asked, not required) | One workload group per login. `svc_analytics_cube`: **`MAX_DOP` 4**, because unbounded parallelism cost 3× the CPU (757). `svc_analytics_dbt`: `MAX_DOP` 2 and `REQUEST_MAX_MEMORY_GRANT_PERCENT` 25. This needs a classifier function, so it is the DBA's call (750 item 1). |
| D8 | **TLS trust** | The sanctioned `sqlcmd` shape uses `-C`, which suggests the server certificate is self-signed. Choose one: (a) export the server certificate's public part for the containers' trust store (no restart; it breaks when the certificate is renewed), or (b) install a certificate issued by the internal CA, which needs a SQL service restart. Either way the build **never** ships `trustServerCertificate` (756, 757). Cube needs a `driverFactory` for this, already written. |
| D9 | **Auto-created statistics** (a note, nothing to do) | The dbt reads make the engine auto-create `_WA_Sys_*` statistics on `POS` tables (757 saw 24). They are harmless, and a reinit drops them. |
| D10 | `VIEW DATABASE STATE` on `POS_Analytics` for `svc_analytics_cube` (optional) | For tuning only (750 item 10). It does not gate v1. |
| D11 | Area 4's source | The callout and donor articles are their own ticket, 753. They gate v1 area 4 only, not this checklist. |

## 4. Dev-side items this surfaced (for the ADR, not IT)

- ⚠ **The replica is SQL Server 2019, and both spikes ran on 2022 CU27.** No 2022-only function
  (`GREATEST`, `LEAST`, `DATETRUNC`, `DATE_BUCKET`, `GENERATE_SERIES`, `IS DISTINCT FROM`) appears
  in either spike's SQL. `PERCENTILE_CONT`, `delete+insert` and RCSI are all 2019 features, so
  nothing is known to break. The ADR should still pin **compat level 150** and run the build's dbt
  and Cube smoke tests on a SQL 2019 container. Cube generates its SQL itself, so its date
  truncation is the part to watch.
- **The dbt image** was built only for arm64 (757). The build must produce and smoke-test the amd64
  image. It has no arch-specific step.
- **SSO for a BI tool:** not v1. It applies only to a later Metabase Pro tier (746, 747).

## 5. What the owner records back on the ticket

- the host name or IP, its OS, and the size IT gave it;
- the URL SIS.Api calls (`https://<analytics-host>/cubejs-api/v1`) and which SIS.Api hosts are
  allowed;
- whether the images reach the host offline (H5) or by temporary egress;
- `POS_Analytics` created: compat level, the RCSI state, the size cap;
- the login names, **never their secrets**, plus where the secrets are kept;
- the Resource Governor groups (yes or no), and the TLS choice (D8 a or b);
- any condition IT or the DBA attached.
