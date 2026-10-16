---
status: open
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

- [ ] `basketCsv_parsesSkuQty_andFlagsBadRows` · pure
- [ ] `simResult_groupsEffectsPerLine_andSessionLevel` · pure
- [ ] drive: typed basket + store + time → per-line effects, trace, near miss; CSV upload path (stubbed) · flow

## Boundaries

Provisional simulate endpoint (BackOffice 2758), stubbed with the prototype's six baskets. Grid cells use the core base
`defaultColDef`.

## Done when

The drive runs both a typed and a CSV basket and shows all three result sections.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)
