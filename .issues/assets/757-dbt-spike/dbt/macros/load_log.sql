{#- Ticket 757 item 6 — mart_load_log: one row per mart per run.

    success rows: written by log_load(), a post-hook. Post-hooks run INSIDE the model's transaction
    (after the delete+insert, before COMMIT), so the row commits with the swap or not at all.
    newest_source_event_at is the newest source event the mart now actually holds (MAX of the
    mart's _source_newest_at), not a re-read of the source, so an event that lands mid-run is
    never claimed. "Data as of" = MIN over the marts of their last success row's value.

    error / skipped rows: written by log_failed_models(), on-run-end, because a failed model's
    post-hook rolls back with it.

    job-level failures (a stale source stops the job before dbt build runs): log_job_failure(),
    a run-operation the job script calls. -#}

{% macro ensure_load_log() %}
  IF OBJECT_ID('{{ target.schema }}.mart_load_log') IS NULL
  CREATE TABLE {{ target.schema }}.mart_load_log (
    load_id bigint IDENTITY PRIMARY KEY,
    invocation_id varchar(40) NOT NULL,
    job varchar(20) NULL,
    model_name varchar(128) NULL,
    status varchar(20) NOT NULL,             -- success | error | skipped | stale_source
    run_started_at_utc datetime2(3) NOT NULL,
    logged_at_utc datetime2(3) NOT NULL DEFAULT SYSUTCDATETIME(),
    lookback_start datetime2(0) NULL,
    rows_in_mart bigint NULL,
    newest_source_event_at datetime2(0) NULL, -- Riyadh local, like the source
    message nvarchar(1000) NULL)
{% endmacro %}

{% macro log_load() %}
  INSERT {{ target.schema }}.mart_load_log
    (invocation_id, job, model_name, status, run_started_at_utc, lookback_start, rows_in_mart, newest_source_event_at)
  SELECT '{{ invocation_id }}', {{ "'" ~ env_var('DBT_JOB', '') ~ "'" }}, '{{ this.identifier }}', 'success',
         '{{ run_started_at.strftime("%Y-%m-%d %H:%M:%S") }}',
         {% if is_incremental() %}{{ lookback_start() }}{% else %}{{ history_start() }}{% endif %},
         COUNT_BIG(*), MAX(_source_newest_at)
  FROM {{ this }}
{% endmacro %}

{% macro log_failed_models(results) %}
  {%- if execute -%}
    {%- for r in results if r.node.resource_type == 'model' and r.status in ('error', 'skipped') -%}
      {%- set msg = (r.message or '') | replace("'", "''") | truncate(900, True, '') -%}
      {%- call statement('log_failed_' ~ loop.index, auto_begin=False) -%}  {#- autocommit: an on-run-end statement inside a transaction is never committed -#}
        INSERT {{ target.schema }}.mart_load_log (invocation_id, job, model_name, status, run_started_at_utc, message)
        VALUES ('{{ invocation_id }}', '{{ env_var('DBT_JOB', '') }}', '{{ r.node.name }}', '{{ r.status }}',
                '{{ run_started_at.strftime("%Y-%m-%d %H:%M:%S") }}', N'{{ msg }}')
      {%- endcall -%}
    {%- endfor -%}
  {%- endif -%}
  select 1 as noop
{% endmacro %}

{% macro log_job_failure(job, status, message) %}
  {% do run_query(ensure_load_log()) %}
  {% call statement('log_job_failure') %}
    INSERT {{ target.schema }}.mart_load_log (invocation_id, job, model_name, status, run_started_at_utc, message)
    VALUES ('{{ invocation_id }}', '{{ job }}', NULL, '{{ status }}', '{{ run_started_at.strftime("%Y-%m-%d %H:%M:%S") }}',
            N'{{ message | replace("'", "''") }}')
  {% endcall %}
  {% do adapter.commit() %}
{% endmacro %}
