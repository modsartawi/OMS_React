---
status: done
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

- [x] `budgetSentence_readsEveryScopeAndPeriod` · pure (`core/rules/budget.test.ts`, with `budgetFigure`; the drawer's form in `workspace/budget-form.test.ts`)
- [x] `budgetUsage_showsOvershootOnlyPastTheLimit` · pure (`core/rules/budget.test.ts`)
- [x] drive: add a budget from the drawer; on a live campaign change a limit (no publish call) (stubbed) · flow (`tools/campaigns-drive.mjs` §510, checks 81–89; whole drive 414/414)

## Boundaries

Provisional endpoints (BackOffice 2758 drafts, 2744 live limits), stubbed. Money is formatted by currency, so BHD has three decimals.

## Done when

The drive adds a budget and changes a live limit without a publish.

## As built

`Settings ▸ Budgets` lists the budgets as sentences, one section per scope (Coupon only with the coupons feature). **+ Budget**, a section's Add, a sentence or its pencil open a side drawer that asks "Limit the… / To at most… / Counted per… / Starting again…", with an optional name and the sentence it makes. Save saves at once, and a delete is confirmed first.

On a live campaign each budget shows its counter as used / limit, with a bar, and "Over by …" once it passes the limit. The counter of a per-key scope is the busiest key's. A click on a sentence then changes **only the limit**, through its own door, with no publish call.

What it touches:
- the pure functions `core/rules/budget.ts` (`budgetSentence`, `budgetUsage`, `budgetFigure`) and `workspace/budget-form.ts`;
- three PROVISIONAL doors: `Settings/Budgets`, `BudgetUsage` and `Budgets/{id}/Limit`;
- drive checks 62 and 72, which had been waiting on 510, are updated.

Rulings are logged in `.afk/HITL-510.md`: the whole-list save is last-write-wins, add/delete on a live campaign goes through the settings door, `year` is kept as a period although 2744 lists only lifetime/day/week/month, and a budget with no counter row reads 0.

Outstanding (not AFK): the owner signs off the Open-questions defaults and those rulings; the live doors are checked in 520.

## Blocked by

[509](509-campaign-settings-details-schedule-audience-features-and-offline.md)
