---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3028-hungerstation-follow-up-on-oms-react-spec.md
blocked-by: 551 (live: BackOffice 3031)
---

# 552 — An HQ user removes a HungerStation store's onboarding, and revives it

## What to build

On the HungerStation Stores page (551):

- **Remove onboarding.** A row action with a mandatory reason and a confirmation that says, in words:
  - the store's stock sync stops and its orders are no longer fetched;
  - its vendor id becomes free for another store;
  - its logs, orders and history stay readable;
  - it is **not** taken off HungerStation: that is done in HungerStation's portal.
- The door answers `data: null`. The row leaves the list, because a removed store is never listed.
- DHS-00007 (already removed, or not onboarded) shows inline and refreshes the list.
- **Revive.** There is no separate action: onboarding the same store code again (551's dialog) revives it,
  with the vendor id and chain given in the dialog. The onboard dialog's help text says so.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3028-hungerstation-web-door-contract.md`, section
`DELETE HungerStationWeb/Stores/{storeCode}?reason=` (the reason goes in the **query string**), plus
onboard's revive note.

## Spine reach

UI → app (BackOffice doors, stubbed until 557)

## Proof (→ `tdd` red-green cycles)

- [ ] helper: the remove confirmation text and the reason in the query string, URL-encoded with unicode kept (vitest)
- [ ] `tools/hungerstation-stores-drive.mjs`: new sections, against stubs, LTR and RTL:
  - remove with a reason, and the row leaves the list;
  - DHS-00007 inline;
  - onboarding the removed code again brings it back.
- [ ] typecheck, lint, test green

## Boundaries

oms-react only. Same gate as the Stores page (`canManageStores`).

## Done when

The helpers and the drive are green; the live check rides 557.

## Blocked by

- [551](551-an-hq-user-lists-onboards-and-edits-hungerstation-stores-with-a-reason.md)

(live: BackOffice 3031)
