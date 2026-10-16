---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 502 — A marketer creates a campaign from a name and features, or copies one

## What to build

**+ New campaign** on the list opens the **Create campaign** dialog: a name in **EN + AR** (both
required), and the optional **features** (coupons, points), each with a line saying what it switches on.
Create saves a new draft and lands on its dashboard. The features decide which workspace menu items
(Coupons) and, later, which palette items show. The dashboard's **⋯** menu gets **Copy campaign**:
it creates an independent draft named "<name> (copy)" and opens it.

## Spine reach

model/api (`create`, `copy`) · logic (features → menu items) · component (dialog, menu) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `workspaceMenu_showsCouponsOnlyWithTheCouponsFeature` · pure
- [ ] `createForm_requiresBothNames` · pure
- [ ] drive: create → the new draft's dashboard; copy → a second draft, original untouched (stubbed) · flow

## Boundaries

Provisional `create` / `copy` endpoints (BackOffice 2758 drafts, 2759 copy), stubbed.

## Done when

The drive creates and copies a campaign against stubs, and the gates are green.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)
