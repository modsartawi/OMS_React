{#- Ticket 757 item 5. The adapter's freshness compares max(loaded_at_field) with SYSDATETIME(),
    the SERVER clock in the server's own time zone. POS writes Riyadh local time, so on a UTC box a
    source would look 3 hours "in the future" and never go stale. This override (root project wins
    the dispatch) snapshots in UTC; each loaded_at_field converts its column to UTC. -#}
{% macro sqlserver__collect_freshness(source, loaded_at_field, filter) %}
  {% call statement('collect_freshness', fetch_result=True, auto_begin=False) -%}
    select
      max({{ loaded_at_field }}) as max_loaded_at,
      CAST(SYSUTCDATETIME() AS datetime2(6)) as snapshotted_at
    from {{ source }}
    {% if filter %}
    where {{ filter }}
    {% endif %}
  {% endcall %}
  {{ return(load_result('collect_freshness')) }}
{% endmacro %}
