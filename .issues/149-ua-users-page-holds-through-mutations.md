---
status: done
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

- [x] `clampToLastPageWhenCurrentPageEmpties` — page 3 of 3 goes empty at 100 total ⇒ page 2; page 1
      going empty stays on page 1 (there is nowhere to clamp to, and "no results" is the honest
      state); a page still holding rows is untouched · pure ·
      `src/features/admin/ua-admin/pager.test.ts` (3 new tests, 12 in the file, green)
- [x] `aFixHoldsTheWorklistPage` — drive: page to 2 of a worklist, clear someone's TOTP from the
      pane, and the grid is still on page 2 with the counts refreshed · flow (Playwright, extends
      `tools/ua-users-scale-drive.mjs`) — **41/41 passing** (28 from 148 + 13 new), against an
      *Awaiting activation* worklist of 152 whose membership the stub really changes

## As built

- `pager.ts` — `clampToLastPageWhenCurrentPageEmpties({ page, rowCount, totalMatches })`. Rows present
  or page 1 ⇒ the page is returned untouched; otherwise `min(page, pageCountFromTotalMatches(total))`.
- `UaAdminUsersPage.tsx` — the clamp sits on the **list result**, not in an action handler: an effect
  reads the settled query and calls the existing `goToPage`. That is what makes it cover every caller
  of `refreshLists` (the pane's disable / re-enable / clear-TOTP / save-contact / revoke, the
  set-password modal, and the new-identity modal) rather than the one the drive exercises — the
  boundary the ticket asked to check.
- It is gated on a **settled** read (`!isFetching && !isPlaceholderData`): with `keepPreviousData`,
  `list.data` mid-flight is the *previous* page's rows, and clamping off those counts would fire a
  page change on every ordinary Next.
- "The page holds" needed **no code** — the page is a field of the query and a mutation only
  invalidates, so nothing resets it. The drive asserts it so a later change can't quietly break it.
- The drive's stub gained live worklist membership (Clear TOTP takes a person off *Awaiting
  activation*) plus counts-read and mutation ledgers, so "the counts refreshed" is asserted on the
  wire rather than inferred from a number that happened not to move.

## Boundaries

No new endpoint, no new keys. Touches the existing refresh-after-mutation path shared by the detail
pane's actions — check every caller of it, not just the one the drive exercises.

## Done when

Clearing TOTP for a person on page 2 leaves the grid on page 2, acting on the last row of the last
page moves to the new last page instead of showing an empty grid, and the selected person's pane
stays open across a page change.

## Blocked by

[148](148-ua-users-pager.md) — there is no page to hold until the pager exists.
