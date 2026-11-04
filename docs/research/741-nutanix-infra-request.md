# 741 / 749 — The infra request for the analytics host (Nutanix)

What the owner hands infra. It turns §1 and §2 of
[the provisioning checklist](741-it-dba-provisioning-checklist.md) into a request for the Nutanix
platform. The DBA half (§3) was done and verified on 2026-11-04; see
[IT approves the on-prem hosts and service logins](../../.issues/749-it-approves-the-on-prem-hosts-and-service-logins-for-the-analytics-stack.md).

Written 2026-11-04. The owner speaks for IT. Every choice marked *(agent)* is overrulable.

## The ask, in one paragraph

Please give us **one Linux VM on Nutanix AHV that runs Docker**. It needs a static IP, an internal
DNS name and a TLS certificate from the internal CA. It must reach the POS replica on 1433. Only the
two SIS.Api servers may reach it, on 443. It needs **no internet access**.

## 1. The VM

| # | Item | Value |
|---|---|---|
| V1 | Platform | A **Docker host VM** on AHV, not the Kubernetes platform *(agent)*. See "Why not Kubernetes" below. |
| V2 | OS | Ubuntu 24.04 LTS or the platform's standard RHEL 9 image, **x86-64**. Cube Store has no arm64 build. |
| V3 | Size | **8 vCPU, 32 GB RAM, 150 GB** on the SSD storage tier: 40 GB for the OS, 110 GB for `/var/lib/docker`. The floor is 4 vCPU and 16 GB. |
| V4 | Runtime | Docker Engine with the compose plugin. |
| V5 | Name | A static IP plus an internal DNS A record, for example `oms-analytics.<internal domain>`. Infra picks the name. |
| V6 | Account | One non-root service account in the `docker` group, which owns `/opt/analytics`. SSH for that account and for the dev leads. |
| V7 | Time and DNS | The standard NTP and DNS. The data freshness check compares UTC times. |
| V8 | Protection | One VM snapshot after install. No backup policy: everything on the host can be rebuilt. |

## 2. The certificate

| # | Item | Value |
|---|---|---|
| C1 | Server certificate | Issued by the **internal CA** for V5's DNS name, as a PEM certificate plus key. It goes on the host's reverse proxy. |
| C2 | CA chain | The public CA chain as PEM. SIS.Api trusts it for C1, and the containers trust it for the SQL Server (D8 below). |

## 3. The firewall lines

| # | From → to | Port |
|---|---|---|
| F1 | **Production SIS.Api** (the server behind `oms-backoffice.al-dawaa.com`) and **staging SIS.Api** → the VM | TCP **443** |
| F2 | The VM → **`DWPOSREPL03` / 172.23.27.47** | TCP **1433** |
| F3 | The jump host → the VM | TCP 22 |
| F4 | Everything else inbound | **Denied.** No browser ever reaches the VM. |
| F5 | The VM → the internet | **Denied.** See images below. |

## 4. How the images get there

Choose one, in this order:
1. **An internal registry**, if the platform has one (Harbor, Nexus, or the Nutanix-bundled
   registry). We push pinned images to it, and the VM may pull from it only.
2. **Offline tarballs.** We hand over `docker save` files and infra copies them to the VM.
3. As a last resort, pull-only egress to `registry-1.docker.io`, `mcr.microsoft.com` and `ghcr.io`
   during install, closed afterwards.

## 5. What to send back

Record these on the ticket. **Never send secrets.**
- the VM's DNS name and IP, its OS, and the size it got;
- the source IPs of production and staging SIS.Api allowed on F1;
- the CA chain (public, C2), and confirmation that C1 is installed or handed over;
- the registry URL (option 1), or "tarballs" (option 2);
- the jump host name;
- any condition infra attaches.

## Why not Kubernetes *(agent)*

v1 is four containers in one compose file:
- the Cube API;
- the Cube refresh worker;
- Cube Store, whose state is on local disk and which has no authentication, so it must stay off
  the network;
- dbt, a 15-minute job whose overlap guard is its fixed container name.

Both spikes (756, 757) proved exactly this shape. Kubernetes would add three things for no v1 gain:
- a persistent volume for Cube Store;
- an ingress with the CA certificate;
- a NetworkPolicy to keep Cube Store private.

dbt's job would also become a `CronJob` with `concurrencyPolicy: Forbid`. If infra *requires*
Kubernetes, the map still holds: one namespace, one StatefulSet for Cube Store, two Deployments, one
CronJob, and an ingress allowed only from F1's IPs. That is a build-time translation, not a new
decision.

## What the DBA side settled on the same day (for the record)

- `POS_Analytics` is compat 150, RCSI on, `SIMPLE`, capped at 40 GB data and 8 GB log.
- `MAXDOP` is 4, as a database-scoped setting.
- **Resource Governor is not used in v1** *(agent)*. The scoped `MAXDOP` 4 covers the CPU risk 757
  measured, and Cube's login touches only `POS_Analytics`. Revisit only if 750's headroom probe
  shows `POS` and the marts competing for the instance's hardware.
- **D8 TLS:** the choice is **(b)** *(agent)*, a certificate from the internal CA on
  `DWPOSREPL03`, installed in a maintenance window, since it needs a SQL service restart. Infra is
  issuing from that CA anyway, and a pinned self-signed certificate breaks at its next renewal.
  Until then the build may pin the current certificate (a); it **never** ships
  `trustServerCertificate`.
