---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 501
---

# 519 — Support finds a coupon code and reads a member's wallet, balance and budgets used

## What to build

Two read-only leaves in the Campaigns group:

- **Coupon finder** (`features/campaigns/coupon-finder/`): enter a code and see its campaign, batch, status,
  validity (local), the member it is bound to, and its uses (when, store, sale id linking to Sessions).
- **Customers** (`features/campaigns/customers/`): find a member by loyalty id or mobile and see their **coupon
  wallet**, **points balance** (spend vs tier, pending), and the **budgets they have used** (profile-scope budgets:
  used / limit per period).

## Spine reach

model/api (coupon find, member wallet / budgets) · logic (budget-used rows) · component (two pages) · i18n
(`coupon-finder`, `rule-customers`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `profileBudgets_rowsShowUsedOfLimitPerPeriod` · pure
- [ ] drive: find a code → its uses; find a member → wallet, balance, budgets used (stubbed) · flow

## Boundaries

Provisional endpoints (BackOffice 2754 coupons, 2744 budgets), stubbed. This does not duplicate `loy/member`; it shows only the
rule-engine view (wallet + budgets). Linking across features is a route link, not an import.

## Done when

The drive finds a code and a member against stubs.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Open questions

- Which endpoint serves a member's wallet and profile budgets is not named in BackOffice 2754 / 2744. Default: provisional, settled in 520.
