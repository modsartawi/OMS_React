{#- Riyadh business time, independent of the server clock's time zone. -#}
{% macro riyadh_now() -%}
  CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Arab Standard Time' AS datetime2(0))
{%- endmacro %}

{% macro riyadh_today() -%}
  CAST({{ riyadh_now() }} AS date)
{%- endmacro %}

{#- The first business day an incremental run rebuilds (a datetime at 00:00, for sargable filters).
    lookback_days = N  -> today and the N-1 days before it.
    lookback_days null -> the intraday rule (748): today, and yesterday too before 02:00 Riyadh. -#}
{% macro lookback_start() -%}
  {%- set n = var('lookback_days') -%}
  {%- if n is none -%}
  CAST(DATEADD(day, CASE WHEN DATEPART(hour, {{ riyadh_now() }}) < 2 THEN -1 ELSE 0 END, {{ riyadh_today() }}) AS datetime)
  {%- else -%}
  {#- a typo ("x" | int = 0) would otherwise start tomorrow and silently rebuild nothing -#}
  {%- if not (n | string).isdigit() or (n | int) < 1 or (n | int) > (var('history_days') | int) -%}
    {{ exceptions.raise_compiler_error("lookback_days must be a whole number 1..history_days, got " ~ n) }}
  {%- endif -%}
  CAST(DATEADD(day, -({{ n | int }} - 1), {{ riyadh_today() }}) AS datetime)
  {%- endif -%}
{%- endmacro %}

{% macro history_start() -%}
  CAST(DATEADD(day, -{{ var('history_days') | int }}, {{ riyadh_today() }}) AS datetime)
{%- endmacro %}

{#- Spike only (item 2): hold the swap transaction open so the run can be killed mid-swap. -#}
{% macro spike_pause_hooks() -%}
  {%- set s = var('spike_pause_s') | int -%}
  {%- if s > 0 -%}
    {{ return(["WAITFOR DELAY '" ~ '%02d:%02d:%02d' | format(s // 3600, (s // 60) % 60, s % 60) ~ "'"]) }}
  {%- else -%}
    {{ return([]) }}
  {%- endif -%}
{%- endmacro %}
