---
type: wayfinder-ticket
wayfinder: research
map: 793
status: done
blocked-by: —
---

# 795 — How do Cube and comparable BI tools model run-time report parameters?

## Question

Before deciding what a v2 author may declare, gather how parameters are modelled elsewhere:
- **Cube Core:** query-time filters, `FILTER_PARAMS`, `COMPILE_CONTEXT` and the security context.
  Which of them SIS.Api can resolve *before* `/load` without breaking the governed path (spec 766
  §C and the 756 spike's findings).
- **Metabase, Superset, Lightdash, Looker:** how a saved question or dashboard declares
  parameters (types, defaults, required, multi-value, linked filters), how a viewer fills them,
  and how they map onto each card.
- **Which parameter types fit our model:** member lists (store, city, region, channel), a date
  range, a numeric threshold on a measure, a top N, a choice of measure or breakdown.

Notes go in `docs/research/793-run-time-parameters.md`, linked from the answer.

## Answer

Done 2026-11-06 (AFK). The notes are in
[793-run-time-parameters.md](../docs/research/793-run-time-parameters.md). Nothing is decided here;
797 decides.

- **Cube Core has no parameter concept.** All five candidate types fit in ordinary `/load` JSON:
  member lists become filters, a period becomes `timeDimensions.dateRange`, a threshold becomes a
  measure filter (`HAVING`), top N becomes `order` + `limit`, and a choice of measure or breakdown
  swaps one member from a list the author allows. So **SIS.Api resolves every parameter before
  `/load`**, and Cube never sees one.
- **v1 already works this way for board filters.** `AnalyticsQueryCompiler.Compile` merges them in,
  and the compiled query is the cache key. A parameter extends that path; it is not a second one.
- **Parameters stay out of the JWT, `COMPILE_CONTEXT` and `FILTER_PARAMS`.** The first two would
  compile the model once per set of values and make `/meta` vary by context. `FILTER_PARAMS` can
  only read filters already in the query. v1 uses none of the three.
- **All four BI tools split two kinds of input:** a filter (it narrows rows and maps to one field
  per card) and a template parameter (it changes the query's shape by putting values into SQL). Our
  safe version of the second kind is a choice from a list of members the author declares.
- **New compiler work:** a filter on a measure, since today the compiler only emits `equals` on a
  category dimension. Top N together with a date or a second breakdown needs two queries, or Cube's
  `rank`, which is preview-only.
- 🚩 **Flags for later tickets:**
  - **797:** v1 silently skips a board filter that a panel cannot take
    (`AnalyticsQueryCompiler.cs:166-171`). A required parameter that silently does nothing would
    mislead a viewer. 797 must also choose whether a required parameter has a default: Lightdash
    forbids it, Metabase demands it.
  - **801:** decide what a scheduled report does when one of its parameters is removed. Superset
    only began checking stored filter values in March 2026.
  - **796:** the owner's "two order types" is a model gap, not a parameter. The orders data has
    `document_type`, but the model keeps it private, and QC is not a channel.
