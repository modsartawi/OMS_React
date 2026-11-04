#!/usr/bin/env bash
# Ticket 757 — dbt-sqlserver spike. Local only; never points at the replica.
# Docker daemon is remote (the dev Mac, arm64): no bind mounts, so the dbt project is COPYed into the image.
# Usage: ./up.sh db      network + SQL Server 2022 (amd64 under emulation), port 14331
#        ./up.sh image   (re)build the dbt image from ./Dockerfile
#        ./run.sh <dbt args...>   run one dbt command in a throwaway container
set -euo pipefail
NET=dbt-spike-757
MSSQL=mcr.microsoft.com/mssql/server:2022-latest@sha256:cf8f0ab2ebe61feec2eed2629061a07d247f791c2a8ddda74a4ac9f06a291718
what=${1:-all}
if [[ $what == db || $what == all ]]; then
  docker network inspect $NET >/dev/null 2>&1 || docker network create $NET
  docker rm -f spike757-mssql >/dev/null 2>&1 || true
  docker run -d --name spike757-mssql --network $NET --network-alias mssql --platform linux/amd64 \
    -e ACCEPT_EULA=Y -e MSSQL_PID=Developer -e 'MSSQL_SA_PASSWORD=Spike757!Sa' -p 14331:1433 $MSSQL
fi
if [[ $what == image || $what == all ]]; then
  docker build -t dbt-spike-757:local .
fi
