# Ticket 757 — the scheduled dbt container (item 7).
# The official dbt-labs images publish no dbt-sqlserver image (it is a community adapter, dbt-msft),
# and ghcr.io/dbt-labs/dbt-core:1.9.latest has no linux/arm64 manifest, so this is a pinned Python image.
FROM python:3.12-slim-bookworm@sha256:e697c81897302a4c4333bade000d98038fbb21eb064f8ee1fd42d02ebcd9d337
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg ca-certificates unixodbc \
 && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/12/prod bookworm main" > /etc/apt/sources.list.d/mssql-release.list \
 && apt-get update \
 && ACCEPT_EULA=Y apt-get install -y --no-install-recommends msodbcsql18 \
 && apt-get purge -y curl gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
ENV DBT_SEND_ANONYMOUS_USAGE_STATS=false \
    DBT_USE_COLORS=false \
    DBT_PROFILES_DIR=/dbt \
    DBT_PROJECT_DIR=/dbt
WORKDIR /dbt
COPY dbt/ /dbt/
# strip CR (a core.autocrlf checkout breaks the shebang). A `dbt parse` baked in here was tried and
# does not help: the run discards it ("profile has changed"), so it is not done.
RUN sed -i 's/\r$//' /dbt/run-job.sh && chmod +x /dbt/run-job.sh && dbt --version
ENTRYPOINT ["dbt"]
CMD ["build", "--select", "tag:intraday"]
