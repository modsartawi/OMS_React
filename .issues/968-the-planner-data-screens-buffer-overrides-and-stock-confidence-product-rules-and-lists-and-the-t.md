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

**2026-11-27 — reconciled with BackOffice 4361, 4362 and 4375 at pricing2 35a4e56be** (branch `reconcile-sets-planner`).
Three families of doors replace the one provisional door; `./wire.ts` reads each into the screen's one row shape and one
history, and writes each change in its door's own body (variant A unchanged: a side sheet per row, a reason only where
the server keeps one, a tab hidden without its grant).
- BO 4375 `PlannerStockEndpoints`: `GET SourcingAdvisor/BufferOverrides[?withEnded=true]`, `POST …/Save {replaces, level,
  store, item, category, keepUnits, keepDays, firstDay, lastDay, reason}`, `POST …/End {id, reason}`;
  `GET SourcingAdvisor/StoreConfidences[?withEnded=true]`, `POST …/Set {store, confidence, reason, endsOn}`,
  `POST …/End {id: store, reason}`. Grant `SourcingPlannerStock:03`.
- BO 4362 `ProductRuleEndpoints`: `GET SourcingAdvisor/ProductRules[?withHistory=true]` → `{rules, lists}`;
  `POST …/Change {rule?, group, value, mode, onlyFrom, reason, on, note}` (a rule is switched, never ended),
  `POST …/Lists/Add` and `…/Lists/Remove {list, kind, code, note?}` (an entry is never changed). Group codes `A_CLASS`,
  `COLD_CHAIN`, `SAP_STATUS`, `LIST`, `ITEM`; the row's `reason` is the sentence code (`COLD`, `RESTRICTED`, `BULKY`,
  `OUT_OF_RANGE`, `NAMED_STORES`). SAP's Restricted Drugs status is a rule row, not a locked list entry. Grant
  `SourcingProductRules:03` — its holder switches any rule, a medicine's too.
- BO 4361 `PlannerTableEndpoints`: `GET SourcingAdvisor/PlannerTables?table=` (current rows), `GET …/History?table=&key=`,
  `POST …/Save {table, row, note}`, `POST …/End {table, key}`; tables `storeModes` (`{store, mode, gives}`, one row per
  store and mode), `carrierContracts` (`{contract, mode, courier, cities[], cutOff, daysToDeliver, deliverBy, rate,
  collectAt, keepsCold, assumed}`), `slotRules` (`{kind: SLOT|NEXT_DAY_AFTER, from, to?}`). Grant `SourcingPlannerTables:03`.
- Every list reads under the run grant: the page opens with the run grant and any planner grant (`canOpenSourcingPlanner`).
- History: the BO 4361 history door; for the others the versions are found in the list with its ended rows (an override
  by `replaces`/`replacedBy`, a confidence by store, a rule by rule id, a list entry by list/kind/code).
- The forms read the server's own checks first (keep days ≤ 365 with two decimals, last day not before today, confidence
  two decimals and ending today to +90 days, a named-stores row and only it names stores, exclusion only from Dawaa Now
  and pick-up, 0–30 days to deliver, a slot ends after it starts).
- Proof: `wire.test.ts` (11), `tables.test.ts` (7), `override-form-model.test.ts` (18), `rule-rows-model.test.ts` (5);
  `tools/sourcing-planner-drive.mjs` 82/82 on Edge, LTR and RTL.

SERVER GAP (spec 4354), marked so in code where it bites:
- No door names the stores, items, merchandise categories or sub-categories the planner forms pick from (the stubbed
  `Planner/Choices` is gone): every code is typed as a code and shown as a code.
- A planner table's list (BO 4361) gives only current rows: a key ended with no successor cannot be listed (its history
  still reads by key), so those three tabs offer no "show ended rows".
