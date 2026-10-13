---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2641-oms-react-delivery-statistics-brief.md
blocked-by: 484
---

# 485 — An HQ user narrows the statistics to one store and chooses the leave-outs

## What to build

- **Scope:**
  - A store picker fed by the existing `storeDetails` lookup (`@/core/services/lookups`).
  - **Empty means all stores**, and that is the default. A chosen store sends `StoreCode`.
  - Each option is labelled as a `code · city` pair, built with `formatPair` and isolated once.
- **Leave-outs** (ticked = left out, as on the till):
  - **Wasfaty churned refills** is a switch, **ticked by default**, sent as `LeaveOutChurned`.
  - **Order types** is a multi-pick fed by the existing `documentTypes` lookup. The chosen codes
    are sent comma-joined as `LeaveOutTypes`; none chosen sends nothing.
- **URL state:** the store and both leave-outs live in the URL beside 484's period, so a link
  reproduces the view. The three period tabs share them, as on the till.

## Spine reach

logic (query builder) · component (picker, leave-out controls) · i18n EN/AR · test

## Proof (→ `tdd` red-green cycles)

- [ ] `buildStatisticsQuery`:
  - no store omits `StoreCode`;
  - churned defaults to `true`;
  - types are joined with commas;
  - no types omits `LeaveOutTypes`;
  - it round-trips through the URL (vitest).
- [ ] The drive is extended. It picks a store and asserts `StoreCode` on the stubbed request; it
  unticks churned, leaves out two types, reloads, and asserts the state survived (LTR and RTL).
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

No new door: the lookups already exist. Keys go in the `delivery-statistics` namespace.

## Done when

Choosing a store and the leave-outs changes the stubbed request and survives a reload; the vitest builder is green.

## Blocked by

[484](484-an-hq-user-sees-today-s-delivery-statistics-across-all-stores.md)
