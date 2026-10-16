---
status: open
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

- [ ] `couponCreate_validatesEachKind_andCarriesNoLimitField` · pure
- [ ] drive: create a random batch → modal with batch id → list filtered to it (stubbed) · flow

## Boundaries

Provisional batch endpoints (BackOffice 2755), stubbed. The pricing/coupons feature is not reused (features never import
features). Anything shared graduates to `core/`.

## Done when

The drive creates all three kinds and shows the batch id.

## Blocked by

[502](502-a-marketer-creates-a-campaign-from-a-name-and-features-or-copies-one.md)
