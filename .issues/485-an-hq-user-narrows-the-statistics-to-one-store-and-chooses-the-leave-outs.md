---
status: done
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

- [x] `buildStatisticsQuery`:
  - no store omits `StoreCode`;
  - churned defaults to `true`;
  - types are joined with commas;
  - no types omits `LeaveOutTypes`;
  - it round-trips through the URL (vitest).
- [x] The drive is extended. It picks a store and asserts `StoreCode` on the stubbed request; it
  unticks churned, leaves out two types, reloads, and asserts the state survived (LTR and RTL).
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

No new door: the lookups already exist. Keys go in the `delivery-statistics` namespace.

## Done when

Choosing a store and the leave-outs changes the stubbed request and survives a reload; the vitest builder is green.

## Blocked by

[484](484-an-hq-user-sees-today-s-delivery-statistics-across-all-stores.md)

## Comments

- 2026-10-13 (AFK, /implement): **done**, against a STUB of the door (BackOffice 2641 unbuilt) and stubs of the two
  existing lookups.
  - Built: `query.ts` — `StatisticsQuery` (484's period + `store`, `leaveOutChurned`, `leaveOutTypes`), its URL reader/writer
    (`store`, `leaveOutChurned=false` only when unticked, `leaveOutTypes` comma-joined in code order) and
    `buildStatisticsQuery`, which replaces 484's `doorParams`; `scope-options.ts` — `storeOptions` (`code · city` via
    `formatPair`) and `orderTypeOptions` (order + Erx categories only, as the till's `ReadOrderTypesAsync`);
    `ScopeControls.tsx` — the store `<select>` (each option the whole pair in `fsi`), the churned switch (ticked by
    default) and the order-type multi-pick, mounted at the inline end of 484's control bar; `controls.ts` (the bar's shared
    field classes). `withTab`/`withPick` are now generic so the scope rides through a tab change. Keys `scope.*` and
    `leaveOut.*` in EN + AR. No new door, route, menu item, namespace or dependency.
  - Proof: vitest 4843 green (`query.test.ts` 15, `scope-options.test.ts` 7); typecheck, lint (4 gates), build green;
    `tools/delivery-statistics-drive.mjs` **106/106** LTR + RTL — block 11 picks a store (asserts `StoreCode`), unticks
    churned, leaves out two types (asserts `LeaveOutTypes=ZC,ZO`), reloads (state and first request survive), and
    checks Yesterday and Range keep the scope.
  - Review: /code-review fixed the picker's Escape (now `takesEscape` + focus return), its anchor (`end-0`), rows
    re-sorting under the pointer, a padded category, duplicated classes and memoised options. /standards-review: no hard
    violations; spec axis clean.
  - Decisions (owner sign-off): `.afk/HITL-485.md` — URL param names, the O/X order-type filter, all open stores in the
    picker (not only `deliveryStore`), the Arabic copy, the scope's place in the bar.
  - **Outstanding (not AFK):** the live door (488); an owner eyeball of the Arabic strings (the drive proves RTL layout and
    isolation under `lng: 'en'`).
