#!/usr/bin/env bash
# sqlcmd against the spike container. Usage: ./sq.sh [-U login -P pass] -i file | -Q "sql"
exec sqlcmd -S 10.211.55.2,14331 -C -f 65001 -W -s '|' "${@}"
