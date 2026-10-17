---
status: done
spec: BO 2737 (brief § Doors → Rules/Switch/Flip, GET Rules/Switch/History (2745))
blocked-by: —
---

# 528 — The engine switch calls Flip and History, and shows what is in flight after the flip

Split out of [520](520-the-rule-campaign-screens-call-the-real-doors-on-staging.md) on 2026-10-17.

## What to build

Re-point `src/features/admin/engine-switch/api.ts` (517) and its model block in `core/models/rule-campaign.ts`:

- **`POST Rules/Switch/Flip { storeCode, engine: BonusBuy|Rule, reason }`** answers `{ storeCode,
  fromEngine, engine, changedBy, changedAt, reason, inFlight: { liveCampaigns, openSessions, storeBudgets,
  truncated } }`. **There is no `from` on the body** (517's question answered). It is `openSessions` (517's
  rename ask stays open, for the glossary). Refusals: `RULES_REASON_REQUIRED`, `RULES_BAD_ENGINE` and
  `RULES_BAD_STORE`.
- **`GET Rules/Switch/History?storeCode=`** answers `{ store: { storeCode, engine, isSet, changedAt,
  changedBy }, changes: [flip reply], newest first }`.
- ⚠ **No `InFlight` read, and no stores list.** The warning is on the flip's reply, and it **never
  blocks**. Default: show the in-flight list **after** a Rule → BonusBuy flip, as "what is still in
  flight". BO ask **C** (see 520) is a dry-run read, if the owner wants it shown before the flip. For the
  store list, `Lookups/stores` gives each store's engine in `detail`, but it sits behind the
  **RuleAuthoring** grant, not RuleEngineSwitch. The default is to use it and record the grant mismatch,
  else BO ask **C**.

## Spine reach

model · api · component (FlipDialog: the warning moves after the flip; the store list source) · test

## Proof (→ `tdd` red-green cycles)

- [x] helpers over the real flip / history shapes · pure
- [x] engine-switch drive re-stubbed, green; in-flight shown on the flip reply · flow

## Done when

The switch calls only real doors, and its drive is green stubbed.

## Comments

**2026-10-18 — built (AFK).** The switch now calls only real doors:
`POST Rules/Switch/Flip { storeCode, engine, reason }` (no `from`), `GET Rules/Switch/History?storeCode=`
(`{ store, changes }`), and, for the list, `POST Rules/Authoring/Lookups/stores { q }` (engine in `detail`).
`StorePromotionEngine/Stores`, `/InFlight` and `/Flip`, `StoreEngineRow`, `StoreEngineInFlight`,
`StoreEngineHistoryEntry` and the PROVISIONAL marks are gone. The model is `StoreEngineFlip`,
`StoreEngineChange`, `RuleEngineInFlight`, `StoreEngineReading`, `StoreEngineHistory` and
`StoreEngineLookupItem` in `core/models/rule-campaign.ts`.

- **In flight after the flip** (settled default): the reason step says HQ lists it afterwards. A
  reply with `inFlight` turns the dialog into the list: live campaigns EN + AR, customer sessions
  still paying, store-scope budgets, and the truncated note. Done closes it and opens the history. A
  reply with `inFlight: null` closes at once. Each history entry says what it left in flight.
- **Store list.** The list is HQ's search, at most 50, with an "at most 50" note. The engine filter
  narrows that answer. ⚠ **Grant mismatch:** the list sits behind **RuleAuthoring**, not
  RuleEngineSwitch, so an admin with only the switch grant sees a banner naming RuleAuthoring. This,
  and listing every Rule store past the first 50, is **BO ask C** (a store list under
  RuleEngineSwitch, and optionally a dry-run in-flight read).
- **Forced by the shape:** the grid's changed by / at / reason columns are gone, because the lookup
  answers none of them. The history pane shows the engine now and who set it, from History's `store`.
  A store HQ holds no row for says so.
- **No `from`:** a flip from a stale list is answered `fromEngine === engine`, and the toast says "was
  already on …".
- A bare 403 names the missing grant on the list (RuleAuthoring), the flip (RuleEngineSwitch, change)
  and the history (RuleEngineSwitch, display). `RULES_REASON_REQUIRED` marks the reason box.
- Proof: `helpers.test.ts` 11/11 over the real shapes. `tools/engine-switch-drive.mjs` **56/56**,
  stubbed on `{ success, data }` and real refusals. The drive's header records what was dropped from
  517's drive and why: the pre-flip in-flight read and its failure path (no such door), and the
  changed by / at / reason columns. Gates: typecheck, `npm test` (338 files, 5545 tests), lint (4
  gates) and build, all green.
- Open, not mine: the live walk on staging (520). The owner may overrule the settled defaults (see
  `.afk/HITL-528.md`). 517's `openSessions` → `openCustomerSessions` rename ask stays with the
  glossary. Fold the stores call into `core/rules` when 523 re-points the core lookup.
