---
status: open
spec: 147
blocked-by: 148
---

# 149 — actingOnAPersonHoldsThePageAndClampsAnEmptyLastPage

## What to build

Working down a worklist must not restart it. When an administrator acts on someone from the detail
pane — set a temporary password, disable, re-enable, clear TOTP — the lists refetch and **the page
holds**. Page 7 of a worklist stays page 7.

One guard on that rule: an action can remove the last row of the last page (fix the final person on
*Awaiting activation* and that page is now empty). Landing on an empty grid would look like the
screen broke at the exact moment the work succeeded. So **if the refetch leaves the current page
empty and the page is above 1, clamp to the new last page** — `ceil(totalMatches / 50)`.

**Selection survives paging**, and this slice asserts it rather than building it: the detail pane
fetches by employee id and never reads the grid row, so paging away from a selected person leaves
the pane intact. It is recorded here so nobody later "fixes" it by clearing selection on page
change — that would be a regression, not a tidy-up.

## Spine reach

logic (the clamp, in the pure pager module from [148](148-ua-users-pager.md)) · component (what
happens after a mutation's refetch) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `clampToLastPageWhenCurrentPageEmpties` — page 3 of 3 goes empty at 100 total ⇒ page 2; page 1
      going empty stays on page 1 (there is nowhere to clamp to, and "no results" is the honest
      state); a page still holding rows is untouched · pure
- [ ] `aFixHoldsTheWorklistPage` — drive: page to 2 of a worklist, clear someone's TOTP from the
      pane, and the grid is still on page 2 with the counts refreshed · flow (Playwright, extends
      `tools/ua-users-scale-drive.mjs`)

## Boundaries

No new endpoint, no new keys. Touches the existing refresh-after-mutation path shared by the detail
pane's actions — check every caller of it, not just the one the drive exercises.

## Done when

Clearing TOTP for a person on page 2 leaves the grid on page 2, acting on the last row of the last
page moves to the new last page instead of showing an empty grid, and the selected person's pane
stays open across a page change.

## Blocked by

[148](148-ua-users-pager.md) — there is no page to hold until the pager exists.
