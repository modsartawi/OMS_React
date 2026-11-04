---
type: wayfinder-ticket
wayfinder: task
map: 741
status: done
blocked-by: 746, 747, 748
---

# 749 — IT approves the on-prem hosts and service logins for the analytics stack

## Question

Once the pieces are chosen, what must IT and the DBA provide before the build can start?

Hand the owner a precise checklist covering:
- the host or hosts: VM sizing and the container runtime;
- the service logins on the replica, or a sibling database, and their least-privilege grants;
- the network paths: from the BI tool and the semantic layer to the replica, and from SIS.Api to
  the semantic layer;
- the SSO registration for the BI tool;
- whether the model egress stays the one line 734 D9 approved.

**Sharpened by [What builds the marts](748-what-builds-the-marts-views-on-the-replica-dbt-into-a-sibling-database-or-a-copy-to-a-columnar-store.md)
(2026-11-04).** The checklist must also carry these items:
- **Database:** `POS_Analytics` on `DWPOSREPL03`, the sibling DB (DBA item 9), with its size
  budget.
- **Two logins:**
  - `svc_analytics_dbt`: `db_owner` on `POS_Analytics` and `db_datareader` on `POS`;
  - `svc_analytics_cube`: `db_datareader` on `POS_Analytics` only.
- **The dbt scheduler:** a container on the same analytics host as Cube and Cube Store.
- **Network path:** analytics host → `DWPOSREPL03:1433`.

The "SSO for the BI tool" bullet above applies only to the later Metabase Pro tier (746/747). It
does not gate v1.

Resolved when IT has approved, or has named its conditions. The answer records the hosts, the
login names (never their secrets) and the URLs that the spec relies on.

## Progress

- **2026-11-04, the checklist is ready; the ticket is not resolved.** It is
  [741-it-dba-provisioning-checklist.md](../docs/research/741-it-dba-provisioning-checklist.md).
  It has 9 host items, 6 network lines and 11 DBA items, plus what to record back. The sizing and
  the "recommended" choices are the agent's calls, and the owner may overrule them:
  - **Host:** one Linux amd64 VM with Docker, 8 vCPU / 32 GB / 150 GB.
  - **Images:** they reach the host offline, so the host has **zero** internet egress.
  - **One host for both environments:** staging and production SIS.Api both call it.
  - **TLS:** SIS.Api → the host on 443, with an internal-CA certificate and a JWT.
  - **`POS_Analytics`:** compat level 150, RCSI on, `SIMPLE` recovery, capped at 40 GB.
  - **Why the dbt login keeps `db_datareader` on `POS`:** a reinit drops per-table grants.
  - **The certificate:** choose between pinning the replica's self-signed certificate and
    installing an internal-CA one.
- **Measured on the replica through the sanctioned door:**
  - it is **SQL Server 2019** (15.0.4470.1, Enterprise), not 2022 as both spikes assumed;
  - `ZC` and `BusinessMonitor` are sibling DBs, a precedent for `POS_Analytics`;
  - about 7.1M `DeliveryHeader` rows exist all-time;
  - there are 1,561 stores.
  - The spikes' SQL uses no 2022-only function. The ADR pins compat level 150 and a smoke test on
    SQL 2019 (§4 of the checklist).
- **Flagged for spike 734, not this map:** D9 approves only the Anthropic egress line, but D4 ships
  a Gemini connector.
- **Next (HITL):** the owner puts §1–§3 to IT and the DBA, then records §5's answers here. Any
  session can then close the ticket.
- **2026-11-04 22:3x, the DBA half has started; the ticket is not resolved.** The owner is acting
  DBA until a dedicated one is hired, so §3 is the owner's to do. Checked through the sanctioned door:
  - **`POS_Analytics` exists** on `DWPOSREPL03`, created 2026-11-04 22:27:27. It is compat level
    **150** and **RCSI on**, as §3 asked.
  - **Its recovery model is `FULL`; §3 asked for `SIMPLE`.** The marts can be rebuilt from `POS`, so
    nothing needs point-in-time restore. Under `FULL` with no log backups, the dbt `delete+insert`
    churn (every 15 minutes) grows the log without bound. Either switch it to `SIMPLE` or schedule log
    backups. **Settled the same evening: the owner switched it to `SIMPLE`, re-verified.**
  - **Not verifiable from the `read` login:** it has no `VIEW ANY DEFINITION` and no access to
    `POS_Analytics`. So the two `svc_analytics_*` logins, their grants, and the 40 GB cap stay owed
    from the owner.
  - **Still owed from IT:** the analytics host (§1), the firewall lines (§2), and §5's answers.
  - 753's tables are still not on the subscriber. The only new tables since 2026-11-03 are a
    `Julib*` snapshot at 09:11 on 2026-11-04.
- **2026-11-04, later, the logins verified by logging in as each; the ticket is not resolved.**
  - **`svc_analytics_dbt`:** `db_owner` on `POS_Analytics`. On `POS` it is `db_datareader` with no
    writer or owner role, and sees all 274 tables. This matches §3.
  - **`svc_analytics_cube`:** `db_datareader` on `POS_Analytics`, with no write and no `CREATE TABLE`.
    It has **no access to `POS`**. This matches §3.
  - **Where the secrets are kept:** in the owner's gitignored `.passwords/POS_Analytics.md`
    (`.gitignore:163`, never tracked), until the analytics host's env files exist (H7).
  - **Gap 1, no size cap.** The data file is 1 GB with 1 GB growth and `max_size` unlimited; §3 asked
    for a 40 GB cap. The log has the default 2 TB cap.
  - **Gap 2, `MAXDOP` 0.** 757 caps Cube's login at `MAXDOP` 4 or less. A database-scoped `MAXDOP 4`
    on `POS_Analytics` covers it, since only the marts are read there.
  - The database is still empty (0 tables), as expected before the first `dbt build`.
- **2026-11-04, later, both gaps closed by the owner and re-verified.** The data file is capped at
  40 GB and the log at 8 GB, and the database-scoped `MAXDOP` is 4. **§3 (the DBA half) is now
  complete:** `POS_Analytics` is compat 150, RCSI on, `SIMPLE`, capped, and both logins hold exactly
  their §3 grants. **Only IT's half is still owed:** the analytics host (§1), the firewall lines
  (§2), and its §5 answers: host or IP, OS, size, the URL and the allowed SIS.Api hosts, offline
  images or not, the TLS choice, and any conditions.

## Answer

**Approved, 2026-11-04.** The owner speaks for IT and is acting DBA, and ruled the ticket solved.
Infra provisions from [741-nutanix-infra-request.md](../docs/research/741-nutanix-infra-request.md).

- **The host:** one **Docker host VM on Nutanix AHV**: Linux amd64, 8 vCPU, 32 GB RAM, 150 GB SSD,
  with a static IP, an internal DNS name and an internal-CA certificate. It is **not** the Kubernetes
  platform *(agent; the request's last section maps it onto Kubernetes if infra requires that)*.
  Images come from an internal registry, or else as offline tarballs. The VM has no internet egress.
- **The network:** production and staging SIS.Api → the VM on 443, the VM → `DWPOSREPL03:1433`,
  and SSH from the jump host. Nothing else gets in. **Model egress is unchanged:** it is the one 734
  D9 line from SIS.Api.
- **The database, done and verified on the replica:** `POS_Analytics` is compat 150, RCSI on,
  `SIMPLE`, capped at 40 GB data and 8 GB log, with `MAXDOP` 4 database-scoped.
- **The logins, verified by logging in as each:** `svc_analytics_dbt` is `db_owner` on
  `POS_Analytics` and `db_datareader` on `POS`; `svc_analytics_cube` is `db_datareader` on
  `POS_Analytics` only. Their secrets are in the owner's gitignored `.passwords/`, and move to the
  host's env files (H7).
- **Resource Governor: not in v1** *(agent)*. The scoped `MAXDOP` covers 757's CPU risk.
- **SQL TLS (D8): (b)** *(agent)*, an internal-CA certificate on `DWPOSREPL03` in a maintenance
  window. Until then the build pins the current certificate. It never ships
  `trustServerCertificate`.
- **SSO:** none in v1. It applies only to the later Metabase Pro tier.
- **The URL the spec relies on:** `https://<analytics-host>/cubejs-api/v1`. Infra's name for the
  host, its IP and the SIS.Api source IPs are **build inputs**, not decisions. They get filled in
  when infra hands the VM over, and the build tickets record them. Nothing in the spec or the ADR
  waits on them.
