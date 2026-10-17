---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 502
---

# 515 — A coupon campaign creates random, universal or personal batches, with the batch id shown

## What to build

The workspace's **Coupons** page appears only when the coupons feature is on. It lists the campaign's coupon codes and batches, with a search, a
**status filter** (unused, used, disabled, expired) and a batch column. **Create coupons** offers:

- **random** (count, prefix / suffix, length, charset);
- **universal** (one code);
- **personal** (member ids, one code each);
- validity from / until (local).

There are **no redemption-limit fields** ("each code once", "once per customer" are coupon / profile budgets, ADR 0094),
and a line links to Settings ▸ Budgets. Success opens a modal with the **batch id** and the count.

## Spine reach

model/api (coupon list, create batch) · logic (create form per kind) · component (page, dialog, modal) ·
i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `couponCreate_validatesEachKind_andCarriesNoLimitField` · pure — `src/features/campaigns/workspace/coupon-form.test.ts` (plus the list filter / counts / member-paste tests)
- [x] drive: create a random batch → modal with batch id → list filtered to it (stubbed) · flow — `tools/campaigns-drive.mjs` §515 (checks 110–123): random, universal and personal batches each show HQ's batch id; no limit field for any kind; the Budgets link; refusals; coupons-off. Full drive 548/548 against stubs (no live SIS.Api).

## Boundaries

Provisional batch endpoints (BackOffice 2755), stubbed. The pricing/coupons feature is not reused (features never import
features). Anything shared graduates to `core/`.

## Done when

The drive creates all three kinds and shows the batch id.

## Blocked by

[502](502-a-marketer-creates-a-campaign-from-a-name-and-features-or-copies-one.md)

## Outcome (2026-10-16)

Built AFK. Coupons page at `/campaigns/:id/coupons` (menu item landed), codes grid with search / status / batch filter in
the URL, Create coupons dialog (random / universal / personal + local validity, no limit fields, a line linking to
Settings ▸ Budgets), success modal with the batch id and count, "Show the codes" filters to the batch. Provisional
doors `RuleCampaign/Campaigns/{id}/Coupons` and `…/Coupons/Batches` in `src/core/rules/api.ts`; shapes in
`src/core/models/rule-campaign.ts`.

Outstanding (not AFK's): the live door walk (ticket 520, BackOffice 2755); owner sign-off on the rulings in
`.afk/HITL-515.md` (inclusive `until`, member ids kept as typed, HQ-owned `expired`, no separate batch table).
