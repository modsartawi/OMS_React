#!/usr/bin/env bash
# Ticket 756. This machine's Docker CLI has no `compose` plugin (remote daemon on the dev Mac),
# so this script starts the SAME topology as docker-compose.yml with plain `docker run`.
# Usage: ./up.sh [db|cube]   (db = network + mssql + cubestore; cube = (re)build + (re)start cube)
set -euo pipefail
NET=cube-spike-756
MSSQL=mcr.microsoft.com/mssql/server:2022-latest@sha256:cf8f0ab2ebe61feec2eed2629061a07d247f791c2a8ddda74a4ac9f06a291718
STORE=cubejs/cubestore:v1.8.18@sha256:bc26e36e81c9465b46659afdf3818439c26bde2a30a321c6301c1dbf12d1d62e
what=${1:-all}
if [[ $what == db || $what == all ]]; then
  docker network inspect $NET >/dev/null 2>&1 || docker network create $NET
  docker rm -f spike-mssql spike-cubestore >/dev/null 2>&1 || true
  docker run -d --name spike-mssql --network $NET --network-alias mssql --platform linux/amd64 \
    -e ACCEPT_EULA=Y -e MSSQL_PID=Developer -e 'MSSQL_SA_PASSWORD=Spike756!Sa' -p 14330:1433 $MSSQL
  docker run -d --name spike-cubestore --network $NET --network-alias cubestore --platform linux/amd64 \
    -e CUBESTORE_REMOTE_DIR=/cube/data -e CUBESTORE_TELEMETRY=false $STORE
fi
if [[ $what == cube || $what == all ]]; then
  docker build -q -t cube-spike-756:local .
  docker rm -f spike-cube >/dev/null 2>&1 || true
  docker run -d --name spike-cube --network $NET -p 4000:4000 \
    -e CUBEJS_TELEMETRY=false -e CUBEJS_DEV_MODE=false \
    -e CUBEJS_API_SECRET=spike-756-service-secret-not-for-prod-0123456789 \
    -e CUBEJS_DB_TYPE=mssql -e CUBEJS_DB_HOST=mssql -e CUBEJS_DB_PORT=1433 \
    -e CUBEJS_DB_NAME=POS_Analytics -e CUBEJS_DB_USER=cube_reader -e 'CUBEJS_DB_PASS=Spike756!Reader' \
    -e CUBEJS_DB_SSL=${DB_SSL:-true} -e CUBEJS_DB_QUERY_TIMEOUT=${QUERY_TIMEOUT:-30s} \
    -e CUBEJS_DB_QUERY_LIMIT=10000 -e CUBEJS_DB_QUERY_DEFAULT_LIMIT=10000 \
    -e CUBEJS_CUBESTORE_HOST=cubestore -e CUBEJS_REFRESH_WORKER=true \
    -e CUBEJS_SCHEDULED_REFRESH_TIMEZONES=Asia/Riyadh -e CUBEJS_LOG_LEVEL=info \
    -e SPIKE_TRUST_CERT=${SPIKE_TRUST_CERT:-1} \
    cube-spike-756:local
fi
