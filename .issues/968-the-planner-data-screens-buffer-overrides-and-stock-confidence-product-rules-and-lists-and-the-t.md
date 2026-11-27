---
status: done
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

- [x] `override-form-model.test.ts` — units or days or both; the level that will apply · vitest (`npm test`)
- [x] `rule-rows-model.test.ts` — rows by item group and mode with their switch · vitest (`npm test`)
- [x] `tools/sourcing-planner-drive.mjs` — add an override, switch a rule row, edit a contract row, in both languages · Playwright drive, run by hand against stubs

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

**Built 2026-11-27, on stubs** (branch `ticket-968`). The three server tickets (BO 4361, 4362, 4375) are still open and
stay listed as blockers: the screens run against the drive's stubbed doors only, and every door, field and grant below
must be reconciled when the server lands.

- Feature `src/features/oms/sourcing-planner/` (namespace `sourcing-planner`, en + ar), route `/oms/sourcing-planner`,
  OMS menu leaf "Sourcing planner data" right after the Sourcing simulator (shown with any one of the three grants).
- Variant A as production code: a tab per table, shown only to the holder of its grant; a row opens in a side sheet
  with its form, a reason only for buffer overrides and stock confidence (the only tables whose server keeps one),
  Save / End, and the row's own history (who, when, old and new, reason). Rule and slot rows switch straight from the
  list; a switch sends no reason. Any holder of the product rules grant switches any rule (medicine ruling): no
  medicine mark or extra step was built. Overrides carry a "Which override applies today?" probe.
- Proof: `override-form-model.test.ts` (16) and `rule-rows-model.test.ts` (5) green; `access.test.ts` and
  `menu-model.test.ts` extended; `tools/sourcing-planner-drive.mjs` 64/64 on Edge, LTR and RTL (add an override,
  switch a rule row, edit a contract row, grant hiding, a SAP-locked row, no raw key, no page error).

**PROVISIONAL (spec 4354: not specified)** — invented here, each marked so in code:
- Grants (`src/core/permissions.ts`, `src/core/sourcing-advisor/access.ts`): `SourcingPlannerBuffer:01`,
  `SourcingPlannerRules:01`, `SourcingPlannerTables:01`; predicates `canEditPlannerBuffer`, `canEditPlannerRules`,
  `canEditPlannerTables`, `canOpenSourcingPlanner` (any of the three).
- Doors (`src/features/oms/sourcing-planner/api.ts`): `GET SourcingAdvisor/Planner/<Table>?withEnded=`,
  `GET …/<Table>/History?rowId=`, `POST …/<Table>/Add {values, reason?}`, `POST …/<Table>/Change {rowId, values, reason?}`,
  `POST …/<Table>/End {rowId, reason?}`, `GET SourcingAdvisor/Planner/Choices` (stores, categories, sub-categories);
  `<Table>` = `BufferOverrides`, `StockConfidence`, `ProductRules`, `RestrictedList`, `BulkyList`, `StoreModes`,
  `CarrierContracts`, `SlotRules`.
- Wire (`src/core/models/sourcing-planner.ts`): row `{id, values, names, setAt, setBy, replaces, endedAt, endedBy,
  lockedBy: 'SAP'}`; change `{id, rowId, action: ADD|CHANGE|END|SWITCH_ON|SWITCH_OFF, diffs[{field, old, new}], reason,
  by, at}`; history `{versions, changes}`.
- Fields (`src/features/oms/sourcing-planner/tables.ts`): overrides `level` (`STORE_ITEM|ITEM|CATEGORY|STORE`),
  `store`, `item`, `category`, `keepUnits`, `keepDays`, `firstDay`, `lastDay`; confidence `store`, `confidence`,
  `endDay`; rules `groupKind` (`A_CLASS|COLD_CHAIN|SAP_STATUS|NAMED_LIST|ITEM`), `group`, `ruleKind`
  (`NOT_BY_MODE|ONLY_FROM_STORES`), `mode`, `stores` (list of codes), `on`; restricted `item`, `source` (`SAP|OURS`);
  bulky `kind` (`SUB_CATEGORY|ITEM`), `code`; store by mode `store`, one boolean per mode code (the advise door's
  `DAWAA_NOW`…`PICK_UP`), `note`; contracts `courier`, `mode` (the two carrier modes), `cities`, `cutoff`,
  `daysToDeliver`, `deliveredBy`, `rate`, `collectionTime`, `keepsCold`, `assumed`; slots `from`, `to`, `ordersUntil`,
  `day` (`SAME_DAY|NEXT_DAY`), `on`.
- Items are typed by code (no item list door is named); the probe asks the item's category for the same reason.

