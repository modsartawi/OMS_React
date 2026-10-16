---
status: open
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 509
---

# 510 — Budgets read as sentences, show used / limit / overshoot, and a limit changes without republishing

## What to build

**Settings ▸ Budgets** lists the campaign's budgets as sentences: "Limit the **discount money** to **SAR 50,000.00**
per **campaign**" and "Limit the **uses** to **1** per **member** per **month**". Scopes are campaign, profile, store, session and
coupon (ADR 0091). **+ Budget** and a click on a sentence open the **Budgets drawer**, which asks "Limit the … to … per …
(per period)". On a live campaign each budget shows **used / limit** and an **overshoot** when it went
past (BackOffice 2744's live limits). On a live campaign, **changing a limit saves without republishing**.

## Spine reach

model/api (budgets, live usage, limit change) · logic (budget sentence, overshoot) · component (list,
drawer) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `budgetSentence_readsEveryScopeAndPeriod` · pure
- [ ] `budgetUsage_showsOvershootOnlyPastTheLimit` · pure
- [ ] drive: add a budget from the drawer; on a live campaign change a limit (no publish call) (stubbed) · flow

## Boundaries

Provisional endpoints (BackOffice 2758 drafts, 2744 live limits), stubbed. Money is formatted by currency, so BHD has three decimals.

## Done when

The drive adds a budget and changes a live limit without a publish.

## Blocked by

[509](509-campaign-settings-details-schedule-audience-features-and-offline.md)
