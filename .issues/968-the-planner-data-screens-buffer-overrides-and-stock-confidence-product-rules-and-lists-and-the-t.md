---
status: open
spec: BackOffice 4354
blocked-by: BO 4361, BO 4362, BO 4375
---

# 968 — The planner-data screens: buffer overrides and stock confidence, product rules and lists, and the three planner tables

Spec: BackOffice `.issues/4354-the-sourcing-advisor-plans-an-orders-shipments-and-comparison-runs-judge-it-before-anything-obeys-spec.md` (the sourcing advisor spec; sections 11, 17 and 19 for the screens).

## What to build

- Start with a quick prototype shown to the owner (HITL). One home for the planner-data screens, each under its own grant:
- buffer overrides (units or days, four levels, first and last day, reason) and a store's hand-set stock confidence (0.6 to 1.0, reason, end date), with their history;
- the product rule rows with a switch each, the restricted list and the bulky list;
- the store-by-mode table, the carrier contracts (with the "assumed" mark) and the slot rule table.
- Every change asks for what the server asks (a reason where one is kept) and shows who changed what and when.

## Spine reach

oms-react: pages / models / locales / tests

## Proof (→ `tdd` red-green cycles)

- [ ] `override-form-model.test.ts` — units or days or both; the level that will apply · vitest (`npm test`)
- [ ] `rule-rows-model.test.ts` — rows by item group and mode with their switch · vitest (`npm test`)
- [ ] `tools/sourcing-planner-drive.mjs` — add an override, switch a rule row, edit a contract row, in both languages · Playwright drive, run by hand against stubs

## Boundaries

HITL prototype first. Three grants.

## Done when

The owner has seen the prototype; the model tests are green and the drive passes.

## Blocked by

BackOffice 4361 (`.issues/4361-the-store-by-mode-table-the-carrier-contracts-and-the-slot-rule-table-are-planner-data-every-run.md`),
BackOffice 4362 (`.issues/4362-product-rules-keep-a-line-off-a-mode-and-say-why-in-english-and-arabic.md`),
BackOffice 4375 (`.issues/4375-the-buffer-holds-back-expected-walk-in-sales-a-planner-overrides-it-and-a-stores-stock-confidenc.md`)

## Open questions

Who may switch a rule that guards a medicine? The default is the holder of the product rules grant.

## Comments

Owner decision 2026-11-27 on the prototype (branch `prototype/4354-secondary-screens`, route `/oms/prototype-sourcing-planner`): **variant A**. A row opens in a side sheet with its form, a reason where the server keeps one (overrides and stock confidence) and its own history. Rules are a list of rows. A tab is hidden without its grant. **Open question settled:** whoever holds the product rules grant may switch a rule that guards a medicine; no extra step. Defaults taken: rule, list and table changes ask no reason, as BO 4361/4362 keep none.
