---
status: open
spec: BackOffice 4057
blocked-by: BO 4061, 925
---

# 926 — Item lists sit in the library, and a Copilot answer shows the list it used

## What to build

- **The analytics library** shows the `itemlist` kind beside boards, reports and views: icon, filter, folders, share,
  reassign and delete, through the existing item actions. Opening one goes to 925's list page.
- **A Copilot answer** shows the server's "Used" line with a link to the list. The `list_periods` result renders as
  a table with a per-status total, and calendar overlaps appear as a warning line.
- **A saved panel whose list is gone** shows "list not available" with no figures.

## Spine reach

UI (library, Copilot answer rendering, panel state).

## Proof (→ `tdd` red-green cycles)

- [ ] The library filters by the new kind
- [ ] The answer's Used line links to the list
- [ ] The calendar warning renders
- [ ] The "list not available" panel state has no figures
- [ ] Lint + build clean

## Done when

Proof is green, and there is a live walk on BO 4061.

## Blocked by

- BackOffice 4061
- 925

## Comments
