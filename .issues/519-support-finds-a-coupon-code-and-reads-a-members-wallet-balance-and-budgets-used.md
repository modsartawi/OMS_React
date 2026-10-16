---
status: done
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

- [x] `profileBudgets_rowsShowUsedOfLimitPerPeriod` · pure — `src/features/campaigns/customers/budgets-used.test.ts` (8 cases: used / limit as one string with its period, HQ's order, money and points in the campaign's currency with BHD at three decimals, at the limit is used up not over, past it the overshoot, a float hair under reads used up, 0 used, none) plus `member-query.test.ts` (the address keeps one key) and `budgetUsage`'s new `usedUp` in `core/rules/budget.test.ts`
- [x] drive: find a code → its uses; find a member → wallet, balance, budgets used (stubbed) · flow — `tools/support-lookups-drive.mjs` 42/42 against vite :5199, every door stubbed at Playwright (code found/unknown, members by loyalty id / mobile with none, one or several, wallet ok/failing, budgets); sibling drives re-run green over the final tree: sessions 56/56, simulator 55/55, campaigns 596/596
- [ ] OWNER: Arabic-UI eyeball of the EN + AR pairs (campaign names in the finder, wallet and budgets)
- [ ] OWNER: sign-off on the HITL defaults (.afk/HITL-519.md: exact code lookup, several members per mobile, points as bare numbers)
- [ ] LIVE: the real BackOffice 2754 / 2744 doors + grant — ticket 520

## Boundaries

Provisional endpoints (BackOffice 2754 coupons, 2744 budgets), stubbed. This does not duplicate `loy/member`; it shows only the
rule-engine view (wallet + budgets). Linking across features is a route link, not an import.

## Done when

The drive finds a code and a member against stubs.

## Blocked by

[501](501-a-marketer-sees-the-campaigns-list-by-state-and-opens-a-campaigns-dashboard.md)

## Open questions

- Which endpoint serves a member's wallet and profile budgets is not named in BackOffice 2754 / 2744. Default: provisional, settled in 520.

## Outcome (2026-10-17)

Built on `spec/2737-rule-engine-screens`. `features/campaigns/coupon-finder/` at `/campaigns/coupon-finder?code=`
and `features/campaigns/customers/` at `/campaigns/customers?loyaltyId=|mobile=`, plus two Campaigns leaves (ungated),
namespaces `coupon-finder` and `rule-customers` (en only). Four PROVISIONAL doors in `core/rules/api.ts`
(`RuleCampaign/Coupons/{code}`, `RuleCampaign/Members…`), types in `core/models/rule-campaign.ts`. Route links only
across pages: a use's sale id → Sessions, a bound member → Customers, a wallet code → the finder, a campaign → its
coupons. Graduated to core because two features need them: `SaysBoth`, `COUPON_STATUS_SEV` + `cleanCode`, the
paths, and `budgetUsage().usedUp`. Gates: typecheck, vitest 332/5488, lint (4 gates) and build are green.
Decisions are in `.afk/HITL-519.md`.
