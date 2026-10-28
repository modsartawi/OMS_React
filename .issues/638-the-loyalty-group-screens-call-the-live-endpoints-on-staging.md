---
status: open
spec: BackOffice 3173 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3173-oms-react-loyalty-groups-brief.md)
blocked-by: 629, 630, 631, 632, 633, 634, 635, 636, 637
---

# 638 — The loyalty-group screens call the live endpoints on staging

## What to build

Swap every stub for the live `LoyGroupWeb/*` doors (BackOffice 3174, 3175, 3176) and the bonus-buy save
findings (3179) on staging. Reconcile each dated line under the brief's **Changes** section against the
client (shapes, error codes, field spellings) and fix any drift. Confirm the two grants live: a view-only
user sees no write buttons, a user with neither sees no leaf, chips or picker.

Owner walk: create a group, rename it (Arabic with Arabic-Indic digits), add one mobile in each spelling,
bulk-load a CSV and an Excel file with bad lines, find a mobile, deactivate with a live bonus-buy named,
pick the group on a bonus-buy and in a simulation, see the chips on a member.

## Spine reach

api (stub removal) · test (live drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `loy-groups live drive green on staging` — read-only paths plus a disposable test group · flow
- [ ] Owner walk recorded in Comments · manual

## Boundaries

Waits on BackOffice 3174, 3175, 3176, 3179 being deployed to staging. Never load real customer lists in the walk.

## Done when

The live drive is green on staging, the brief's Changes are reconciled, and the owner walk is recorded.

## Blocked by

[629](629-the-loyalty-groups-list-shows-each-groups-code-name-active-flag-mobile-count-and-live-bonus-buys.md),
[630](630-a-marketing-user-creates-a-group-with-an-upper-case-code-and-edits-its-names-and-the-code-never-changes.md),
[631](631-deactivating-a-group-confirms-naming-the-live-bonus-buys-it-stops-and-reactivating-restores-it.md),
[632](632-a-groups-members-are-listed-by-page-searched-by-any-mobile-spelling-and-added-or-removed-one-at-a-time.md),
[633](633-a-pasted-csv-or-excel-list-loads-into-a-group-and-every-rejected-line-is-shown-with-its-reason.md),
[634](634-typing-a-mobile-shows-every-group-it-is-in-active-and-inactive.md),
[635](635-the-member-screen-shows-the-members-active-groups-as-chips-only-for-users-allowed-to-view-groups.md),
[636](636-bonus-buy-maintenance-picks-loyalty-groups-from-the-defined-groups-and-shows-the-unknown-and-inactive-group-findings.md),
[637](637-the-simulations-basket-loyalty-groups-are-picked-with-the-same-picker.md)
