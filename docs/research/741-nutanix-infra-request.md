# Analytics container — request to infra

**From:** the OMS BackOffice team · **Date:** 2026-11-05

Please run **one container image** that we supply, the same way you run our other apps. We build
and test the image ourselves; you only run it. All its settings are built in; you set only the
three secrets in §4. A ready deployment file comes with the image: `oms-analytics.k8s.yaml`
(Kubernetes) or `oms-analytics.compose.yaml` (Docker).

## 1. Run it

| | |
|---|---|
| Image | `oms-analytics:<version>`, linux/amd64. Delivered the same way as our other apps' images. |
| Size | **4 vCPU, 16 GB RAM** (may later grow to 8 vCPU / 32 GB). |
| Instances | **Exactly one.** Never scale it out or run two at once. |
| Disk | **None.** Nothing needs to persist; it rebuilds its cache on start. |
| Restart | Always restart on failure. A restart is always safe. |
| Port | The container listens on **4000** only. |

## 2. Name and certificate

- An **internal-only** DNS name (not published on the internet), e.g. `oms-analytics.<internal domain>`.
- A Cloudflare certificate on **443**, routed to container port **4000**.

## 3. Network

| From → to | Port | Rule |
|---|---|---|
| Production SIS.Api and staging SIS.Api → the container | 443 | allow |
| Your monitoring → the container | 443 | allow (health check only) |
| The container → `DWPOSREPL03` / 172.23.27.47 | 1433 | allow |
| Anything else in, and the container → the internet | — | **deny** |

## 4. Secrets (environment variables, set at deploy time)

`CUBEJS_DB_PASS` · `DBT_ENV_SECRET_PASSWORD` · `CUBEJS_API_SECRET`

We give you the values in person or through your secret store — never by email or ticket. The
container refuses to start (exit code 64) if one is missing.

## 5. Health checks

| Path | Use it for | Healthy |
|---|---|---|
| `GET /livez` | liveness (restart if failing) | `200` |
| `GET /health` | **monitoring and alerts** | `200`; `503` means the service or its data is stale. The JSON body says which. |

Please alert **the OMS BackOffice team** when `/health` returns 503 for more than 15 minutes.

## 6. What we need from you

- **Back on this request:** the DNS name, the source IPs of production and staging SIS.Api, and
  how we hand you a new image version.
- **Running:** read access to the container's logs, and a way to see it running and restart it (or a
  named contact who can). **No shell access is needed.**
