---
status: done
spec: 147
blocked-by: —
---

# 148 — theGridWalksPagesInsteadOfStoppingAt50

## What to build

The people list on `admin/ua-users` stops being a 50-row wall and becomes the first of N pages.

A footer under the grid carries **Previous / Next** and a **"Page N of M"** readout, and appears
**only when `totalMatches > 50`** — a four-row result grows no controls. Next is enabled off
`isCapped`, which stops being displayed as a cap note and becomes the flag that says "there is
another page". Both the search results and every card worklist page identically.

**The page number is a field of the query object**, not separate state. That one decision buys three
behaviours for free, and they are part of this slice's definition of done even though no code
implements them directly: a new search resets to page 1, switching cards resets to page 1, and each
page is its own cache entry.

Paging must feel instant on a page already visited: keep the previous page's rows on screen while
the next loads (`placeholderData: keepPreviousData`), dimming and disabling the grid rather than
blanking it — so a spinner means *first load* again and nothing else.

Two pieces of the old wall retire with it:

- **The cap note goes.** `grid.capped` is deleted. `search.hint` and `grid.emptyHint` are reworded
  to stop advising "refine your search to narrow it down" as the way past a wall that no longer
  exists.
- **The match count is wrong today and is fixed here** — the grid header reads `rows.length`, so a
  6,000-row card reports "50". It must read `totalMatches`.

Deliberately **not** in this slice, and not to be added: a page-size chooser (the server clamps
`take` downward, so the only selectable range is 25/50) and numbered page buttons (*All people* is
120 pages; nobody navigates to page 87 on purpose).

**Accepted, recorded, not engineered around:** a membership change shifts rows up by one, so a person
can slide between pages during a methodical walk. That is a property of offset paging over live data.

## Spine reach

model/api (the paging call gains a real `skip`) · logic (a pure pager module) · component (the grid
footer + query shape) · i18n (`ua-admin`: pager controls, readout; one key deleted, two reworded) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `pageCountFromTotalMatches` — 0/1/50/51/6000 rows → how many pages, and whether the footer
      shows at all · pure · `src/features/admin/ua-admin/pager.test.ts` (9 tests, green)
- [x] `pagerButtonEnablement` — Previous disabled on page 1; Next disabled when `isCapped` is false;
      both live on the middle pages · pure · same file
- [x] `walkingPagesOnAWorklist` — drive: open *All people*, footer reads "Page 1 of 120", Next moves
      to page 2 with different rows, Previous returns, a new search snaps back to page 1, and the
      header count reads the true total · flow (Playwright, new `tools/ua-users-scale-drive.mjs`) —
      **28/28 passing** against a stubbed 6,000-identity estate that honours `skip`/`take`/`isCapped`

## As built

- `pager.ts` — the pure module: `PAGE_SIZE`, `skipForPage`, `pageCountFromTotalMatches`, `showsPager`,
  `pagerButtonEnablement`. `PAGE_SIZE`/`skipForPage` are what ticket 150's export walk will walk with.
- `GridPager.tsx` — the footer. `busy` inerts both buttons while a read is in flight.
- `api.ts` — `search(term, page)` / `worklist(card, page)` bind a real `skip`; the audit tab keeps its
  own single first-page read (paging it is out of scope).
- `UaAdminUsersPage.tsx` — `page` joins the `Query` type; `keepPreviousData` **plus `staleTime: 30_000`**
  (the global default is `0`, so without it a step back would refetch and dim — "instant on a page
  already visited" needed both); the grid dims via `pointer-events-none opacity-50` + `aria-busy`; the
  header reads `totalMatches`.
- i18n: `pager.*` added (previous/next/readout/ariaLabel), `grid.capped` **deleted**,
  `search.hint` + `grid.emptyHint` reworded. `grid.matchCount` now interpolates `formatted` so 6,000
  reads with a separator while `count` still drives the plural.
- `CONTEXT.md` gained a **Page** entry recording that `isCapped` reads as "another page exists", not
  "truncated" — the meaning flip this ticket performed.
- The `grid.capped` keys left in `active-sessions` and `authz-admin` are different namespaces on
  different screens; spec 147 puts them out of scope.

## Boundaries

No new endpoint — both reads already bind `skip` and clamp only `take` (research
[140](140-uaadminweb-contract-as-built.md)). No new namespace. `grid.capped` is **deleted**, so
grep for stragglers. The new drive file is this slice's to create; later slices extend it.

## Done when

Opening *All people* and clicking Next lands on rows 51–100 with the footer reading "Page 2 of 120",
the header states the true match count, no cap note appears anywhere on the screen, and the two pure
suites are green alongside `npm run typecheck` and `npm run lint`.

## Blocked by

None — can start immediately.
