---
status: open
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

- [ ] helpers over the real flip / history shapes · pure
- [ ] engine-switch drive re-stubbed, green; in-flight shown on the flip reply · flow

## Done when

The switch calls only real doors, and its drive is green stubbed.
