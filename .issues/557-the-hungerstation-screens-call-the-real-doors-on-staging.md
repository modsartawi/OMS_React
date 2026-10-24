---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551, 552, 553, 554, 555, 556 (live: BackOffice 3030–3037 on staging; pairs with BackOffice 3038)
---

# 557 — The HungerStation screens call the real doors on staging

## What to build

Switch the HungerStation area from stubs to the live doors on staging, and walk every page. This is the
oms-react half of BackOffice 3038, the live walk; do the two together.

- **Staging prerequisites (BackOffice owner):**
  - HQ SQL 005, 006, 007 (part 1), 008 and 004 run on the staging OMS DB;
  - the three `OMS_HUNGERSTATION_*` roles granted to a test user;
  - SIS.Api deployed with spec 3028.
- **Walk**, with the browser pointed at the live doors (no stubs):
  - Stores: list, filters, health, onboard, edit, remove, revive, pause, resume, sync now. Use a
    **staging-only vendor id**, so production HungerStation is never pushed.
  - The logs drawer, push lines and material history.
  - Materials: search, import a small file, change one row.
  - Orders: window, filters, detail, raw, and retry a seeded failed order.
- Each write's admin log row (with the reason) is confirmed on the BackOffice side (3038).
- Record any contract drift. The fix goes into the contract first
  (`C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`), then into both repos.

## Spine reach

UI (oms-react) → web doors → HQ DB on staging

## Proof (→ `tdd` red-green cycles)

- [ ] each drive re-run against staging (`hungerstation-stores`, `-materials`, `-orders`), or a recorded
  manual walk where a drive can't run live, with a screenshot or GIF per page
- [ ] zero contract drift, or every drift fixed in the contract and in both repos
- [ ] owner sign-off on the Arabic rendering

## Boundaries

Staging only. The BackOffice retention worker stays **off**. No production HungerStation push.

## Done when

Every page works against the live doors on staging.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)
- [552](552-an-hq-user-removes-a-hungerstation-store-s-onboarding-and-revives-it.md)
- [553](553-an-hq-user-pauses-resumes-or-pushes-a-hungerstation-store-s-stock-now.md)
- [554](554-the-hungerstation-logs-drawer-opens-a-push-s-lines-and-a-material-s-history.md)
- [555](555-a-category-manager-searches-imports-and-changes-the-hungerstation-material-list.md)
- [556](556-an-hq-user-follows-hungerstation-orders-in-the-monitor-and-retries-a-failure.md)

(live: BackOffice 3030–3037 on staging; pairs with BackOffice 3038)
