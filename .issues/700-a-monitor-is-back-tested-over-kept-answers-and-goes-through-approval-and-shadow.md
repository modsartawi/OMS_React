---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 699
---

# 700 — A monitor is back-tested over kept answers and goes through approval and shadow

## What to build

Story 38; A1, A13; door 3290. A monitor follows the guard's path: a back-test of the current revision, then ask for
approval by someone else, then shadow, then promote. Its back-test replays kept answer copies and reads as "how many
review items this would have raised, and on which answers", not as refusals on sales.

## Spine reach

model/api (monitor back-test reply) · store/logic (result reading per kind) · component (back-test tab, approvals) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] the back-test result reads per kind, and a guard's reading is unchanged — pure
- [x] back-test, ask, approve as another user, shadow, promote a monitor — flow (stubbed)

## Boundaries

Reuses the approval and shadow rules as they are. Patient keys stay masked on the back-test view. Doors stubbed; 711
reconciles.

## Done when

A monitor reaches live only as a guard does, and the author saw what it would have raised first.

## Blocked by

699.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).** Pure proofs in `core/insurance-rules/backtest.test.ts`; `tools/insurance-fhir-700-drive.mjs` 82/82 in
LTR and RTL; `insurance-approvals-drive` 126/126 unchanged. RTL is direction only (`lng` stays `en`), so the Arabic is proved by key parity and no one has read it on screen.

Shape guesses for 711 (door 3290 spells none):
- No new door: `POST Guards/Backtests { days }` is one job of the draft's revision, replaying requests through guards and kept answers through monitors.
- The reply gains `monitors: { answers, raisedOn, raised: { action, info }, items: [{ on, message: { source, id }, maskedKey, rules }], itemsTotal, rules: [{ ruleId, raised }] } | null`. Null or absent while running, and when the draft holds no monitor.
- `items` is cut like `stopped`, first N with a total. A key arriving whole is masked on screen.
- The guard fields stay as they are, with `requests: 0` when the draft holds only monitors.
- Monitors' `rules` rows stay out of the guard `rules` list, and monitors' figures out of `fires`.
- A monitor's shadow figure is its row of `GET Metrics?by=rule` (`shadowFires`), and Promote is the guard's door.

Decisions, overrulable:
- **One job, one gate.** Monitors share the revision, so Submit needs one finished job of it. If 3290 gives monitors their own job, `backtestForAsking` and `backtestKinds` move.
- **Client gate beyond HQ's.** A draft holding a running monitor treats a finished job with no `monitors` section as no back-test ("Run a back-test first"), so the author has always seen what it would raise. HQ's own `GUARDS_BACKTEST_MISSING` is unchanged. A disabled monitor does not count.
- **Monitors alone read no sale figures.** `requests: 0` plus a `monitors` section hides the guard tiles, by-rule table and stopped table. A mixed draft with zero past requests also hides them: the reply cannot tell the two apart. Overlap and SAR stay guard-only.
- **Shadow copy is a guess.** "A monitor in shadow raises no review item until it is promoted, on the same 14 days" is my reading of A1's "same shadow". 3290 does not say what a shadow monitor does; 711 should confirm. Promote rules are unchanged (14 days, or sooner with a reason).
- **The answer is shown as `source · id`, unlinked.** Payer and `use` are left out: 701's scopes have no `use`, and door 3290 names only (source, id).
- **"The guard draft" stays the panel's title:** it is the document's name, and it does hold the monitors.
