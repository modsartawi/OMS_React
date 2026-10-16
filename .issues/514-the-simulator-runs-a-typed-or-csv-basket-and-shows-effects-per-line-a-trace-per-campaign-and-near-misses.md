---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 514 — The simulator runs a typed or CSV basket and shows effects per line, a trace per campaign and near misses

## What to build

**Campaigns ▸ Simulator** (new feature `features/campaigns/simulator/`, distinct from the bonus-buy
`pricing/simulation`) takes a basket that is **typed** (SKU + qty, with the material lookup) or **uploaded / pasted as CSV**,
checked row by row before it is used. It also takes a **store**, a **member** (optional), the **channel**, and a **date and time** (local),
plus "include drafts" or a chosen draft (opened from a dashboard's "Simulate the working copy"). Run calls HQ's
dry run (BackOffice 2758) and shows:

- **effects per line** (discount, free unit, points, created coupon "will create"), plus session-level effects;
- a **trace per campaign** (which rules ran, which conditions passed or failed, the group outcome);
- **near misses** with their gap ("add SAR 12.00 for 15% off").

## Spine reach

model/api (`simulate`) · logic (CSV basket parse + row check, result shaping) · component (form, results) ·
i18n (`rule-simulator`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `basketCsv_parsesSkuQty_andFlagsBadRows` · pure — `src/features/campaigns/simulator/basket.test.ts`
- [x] `simResult_groupsEffectsPerLine_andSessionLevel` · pure — `src/features/campaigns/simulator/sim-result.test.ts`
- [x] drive: typed basket + store + time → per-line effects, trace, near miss; CSV upload path (stubbed) · flow

## Boundaries

Provisional simulate endpoint (BackOffice 2758), stubbed with the prototype's six baskets. Grid cells use the core base
`defaultColDef`.

## Done when

The drive runs both a typed and a CSV basket and shows all three result sections.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Comments

**2026-10-16 — built (AFK).** Campaigns ▸ Simulator is at `/campaigns/simulator` (`features/campaigns/simulator/`, namespace `rule-simulator`, en only). The sale has a store, an optional member id, a channel, and a LOCAL date and time. Campaigns run live, or as every working copy, or as one campaign's working copy (`?draft=`, from the dashboard's new ⋯ ▸ "Simulate the working copy").

The basket is typed (materials lookup by SKU or name) or comes from a CSV that is pasted or uploaded. Each CSV row is checked (format, then the SKU on HQ's lookup) before the basket takes it. **Run** calls the PROVISIONAL `POST RuleCampaign/Simulate` and shows the totals, the near misses with their gap, the effects on the whole sale, the effects per line (AG Grid) and the trace per campaign (outcome, group, rules, conditions met or not, both languages).

Proof:
- vitest: 20 + 6 cases in the simulator, plus the menu test; the full suite passes (325 files, 5441 tests).
- Drive `tools/simulator-drive.mjs`: **55/55**, STUBBED with the prototype's six baskets (`tools/simulator-fixtures.mjs`). It covers the typed basket, the pasted and uploaded CSV, BHD at three decimals, "will create", a draft, a refusal, and a bonus-buy store.
- `tools/campaigns-drive.mjs` still passes 495/495, and `tools/priority-drive.mjs` 36/36.
- typecheck, lint (4 gates) and build are clean.

Outstanding (not AFK): the live door (520); the owner's sign-off on the decisions in `.afk/HITL-514.md`; and a human eyeballing the Arabic rendering.
