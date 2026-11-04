#!/usr/bin/env bash
# Run one dbt command in a container on the spike network:  ./run.sh build --select ...
#   ENTRY=/dbt/run-job.sh ./run.sh intraday     (the scheduled job's own entrypoint)
#   DETACH=1 ./run.sh ...                       (start and return; for the kill test)
# Detached + `docker wait` + `docker logs`, because this machine's remote Docker client (tcp, the dev Mac)
# drops an attached container's output after any pause: `sh -c 'echo a; sleep 3; echo b'` prints only `a`.
set -uo pipefail
NAME=${NAME:-spike757-dbt}
docker rm -f "$NAME" >/dev/null 2>&1 || true
MSYS_NO_PATHCONV=1 docker run -d --name "$NAME" --network dbt-spike-757 \
  -e ANALYTICS_DB_HOST=mssql -e ANALYTICS_DB_TRUST_CERT=${TRUST_CERT:-true} \
  -e 'DBT_ENV_SECRET_PASSWORD=Spike757!Dbt' ${EXTRA_ENV:-} \
  ${ENTRY:+--entrypoint "$ENTRY"} dbt-spike-757:local "$@" >/dev/null
[[ -n "${DETACH:-}" ]] && exit 0
rc=$(docker wait "$NAME")
docker logs "$NAME" 2>&1
docker rm "$NAME" >/dev/null
exit "$rc"
