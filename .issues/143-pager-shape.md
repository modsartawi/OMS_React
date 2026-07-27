---
type: wayfinder-ticket
wayfinder: grilling
map: 139
status: done
blocked-by: 140
---

# 143 — The pager: page size, controls, and what a page change disturbs

## Question

The server already takes `skip`/`take`; the client sends `skip: 0` forever (`api.ts:17`) and shows a
"showing 50 of N, refine to narrow" note instead of a pager. Settle the replacement.

- **Page size.** Stay at 50, or is a different number right for a table this dense? Does the user
  get to choose (25/50/100), and does 140's `MaxSearchRows` finding allow the top of that range
  without a server change?
- **The control.** Prev/next only, or numbered pages with a "page N of M"? The screen has an exact
  `totalMatches`, so a total page count is available — is it worth the width? Where does it live —
  the grid's header strip (which already carries the count) or a footer bar?
- **Both paths.** Search results and card worklists share `UaEmployeeSearchResult`. Does the pager
  behave identically on both, and does switching card or running a new search reset to page 1
  (almost certainly yes — confirm and write it down)?
- **What a page change disturbs.** The detail pane holds `selectedId` from a row on some page. Does
  paging clear the selection, keep the pane open on an off-page person, or something else? And after
  a mutation, `refreshLists()` invalidates the list — should the user land back on the page they
  were on, or page 1?
- **The cap note's fate.** `grid.capped` exists to apologise for the wall. With a pager the wall is
  gone — does that string retire, or does a cap survive somewhere?

Resolving this also settles the map's **detail pane across pages** fog.

## Answer

**A fixed 50-row page, walked with prev/next in a grid footer, that disturbs nothing it doesn't
have to.** Eight decisions, in the order they were put:

### 1. Page size — fixed 50, no chooser

`MaxSearchRows = 50` (`UaAdminService.cs:69`) clamps `take` **down** only, so the client cannot ask
for a bigger page. The only selectable range without a server change is 25/50 — a chooser whose top
value is the only interesting one isn't a chooser, it's a way to make the screen slower, and 25
doubles the round trips (each page costs ~6 DB queries regardless of size) for nothing. If a bigger
page is ever wanted it is the **same one-line const change** that [144](144-export-scope-and-cost.md)
may want for export — one lever in the addendum, not two.

### 2. The control — prev/next + "Page N of M", in a footer

Numbered pages are *available* (`totalMatches` is exact and re-queried every page) but not worth it:
the `all` card is **120 pages**, which means ellipsis logic (`1 … 7 8 9 … 120`) and real width in a
`7fr` split column, for a screen where nobody navigates to page 63 on purpose. The access pattern is
"scan the worklist" / "refine the search". So:

- **Prev / next only**, with the page count rendered as text between them, so the user still learns
  the size of what they are in.
- **A footer bar at the bottom of the grid card**, not the header strip — the header is already a
  two-slot `text-xs` bar (title start, count end), and controls belong under the rows they move.
- Prev disabled on page 1; next disabled when `isCapped === false`.

`isCapped` is used as-is for that: `LeavesRowsBeyond(total, cappedSkip, rowsOnPage)` already means
"rows exist beyond *this* page" and correctly goes false on the last page — it is a `hasNextPage`
flag, which is what its doc comment says it is for.

### 3. Both paths, and where the page lives — a field of `Query`

Search and card worklists share `UaEmployeeSearchResult`, so the pager is identical on both. The page
number becomes a **field of the existing `Query` object**, not a separate `useState`:

```ts
type Query = { kind: 'search'; term: string; page: number } | { kind: 'card'; card: string; page: number }
```

`runSearch()` and `openCard()` already build a fresh `Query`, so a new search or a card switch lands
on `page: 1` **by construction** — no `useEffect` watching the term, which is the classic place that
bug lives. It also falls out that the key `['ua-admin', 'list', query]` gains the page, so each page
is its own cache entry and **prev is instant** off cache while it revalidates. Consequence, and it is
the right one: `refreshLists()` invalidates the whole `['ua-admin','list']` prefix, so every visited
page dies after a mutation and only the mounted one refetches.

### 4. The detail pane across pages — keep the selection (settles the fog)

**Paging does not touch `selectedId`; the pane stays open on the off-page person.** `UserDetailPane`
is keyed on `selectedId` and fetches its own `status`/`sessions`/`audit` by `employeeId` — it
**never reads the row from the list**, so an off-page selection is not a dangling reference. Keeping
it is the *do-nothing* implementation: clearing is code you add in order to destroy the user's work,
and it punishes the exact pattern that rewards a pager (open someone, page on to find the next
person). The highlighted row simply isn't on screen and reappears on paging back — **no marker, no
"selected person is on page 3" note, no extra key.**

### 5. After a mutation — hold the page, plus a clamp-on-empty guard

**Hold.** The page is client state `refreshLists()` never touches, so staying put is again the
default and is right: you deactivated someone on page 3, you carry on down page 3. Accepted caveat,
recorded not engineered around: a mutation can change a worklist's *membership*, so `totalMatches`
drops and everything after that person **shifts up by one** — someone can slide from the top of
page 4 to the bottom of page 3 and be missed in a methodical walk. Ordering is stable by
`employeeId`, so it is a clean shift, not a reshuffle, and jumping to page 1 would not fix it.

**One edge needs code.** On the last page holding one row, mutating that person out of the worklist
leaves you on a page that no longer exists — an empty grid on a query that plainly has matches, with
no escape but prev. `totalMatches` comes back even on an empty page, so: when a result lands with
`rows.length === 0 && page > 1`, set the page to `Math.max(1, Math.ceil(totalMatches / 50))` and let
it refetch. One deterministic guard, and it covers every stale-page case, not just the mutation one.

### 6. The cap note retires from this screen

The wall is gone, so the apology goes with it — and the pager would otherwise **expose a latent bug**
in the count.

| Where | Today | Fate |
|---|---|---|
| `grid.capped` | *"first 50 of 6,000 — refine to narrow"* | **retire** — key deleted, branch deleted |
| `grid.matchCount` | `{ count: rows.length }` | keep the key, **fix the argument** → `totalMatches` |
| `search.hint` | *"…capped at 50 rows."* | reword — drop the cap clause |
| `grid.emptyHint` | *"…(first 50, refine to narrow)."* | reword — drop the parenthetical |

`matchCount` reading `rows.length` is the bug: on page 1 of `all` it would say "50 matches" beside a
footer saying "Page 1 of 120". The header's end slot becomes **one unconditional string — the exact
`totalMatches`** — on every query; the footer carries the position. `isCapped` stops being displayed
and becomes the next-button flag.

Two caps deliberately survive:

- **`audit()` keeps its 50 wall** — it still has no pager. So the shared `PAGE` const is not simply
  deleted: the two list calls take a caller-supplied `skip`, and `audit()` keeps its own local
  `{ skip: 0, take: 50 }`.
- **`authz-admin` and `active-sessions` keep theirs untouched** — other screens, already out of scope
  on the map. Note both carry the *same* `grid.capped` string in their own namespaces; only
  `ua-admin.json` changes.

### 7. While a page loads — `keepPreviousData`, dimmed and disabled

Today `list.isPending` swaps the whole table for a centred spinner. Correct for a first search, wrong
for a page step — the table vanishes, the card collapses toward `min-h-[22rem]`, and the footer jumps
out from under the cursor on **every** click. So: **`placeholderData: keepPreviousData`** on the list
query. The previous page's rows stay mounted while the next loads, the footer stays still, and
`isPending` recovers its true meaning — *nothing has ever loaded for this query* — reserving the
spinner for the genuine first load. Pair with `list.isFetching` → dim the table body and disable both
pager buttons, so a slow page isn't silently swallowing clicks.

Accepted wrinkle: because the page is in the key, a **card switch** also changes the key, so the old
card's rows show for one frame under the new card's title. Accepted — a cross-fade, not a lie, and
title and count update together. If it ever grates, hold the placeholder only when `kind` and
`term`/`card` are unchanged.

### 8. No footer when there is nothing to page

**Render the footer only when `totalMatches > 50`.** Most queries here return well under 50 (an id
search returns one row), and "Page 1 of 1" with two dead buttons is chrome that says nothing. Below
the threshold the grid card ends at the last row exactly as today — so **every existing narrow-search
flow on this screen is visually unchanged by this ticket**, and the pager appears only where there is
genuinely a wall to walk. `min-h-[22rem]` already stabilises the common layout, so the "always render
it disabled" alternative buys a permanent dead bar for very little.

### Consequences for the rest of the map

- **No server change.** Confirmed against [140](140-uaadminweb-contract-as-built.md): nothing here
  enters the contract addendum. The one server-side lever this ticket *declines* to pull —
  `MaxSearchRows` — is left entirely to [144](144-export-scope-and-cost.md) to argue for if export
  needs it.
- **[144](144-export-scope-and-cost.md) inherits a 50-row walk** as the cost basis: ~120 sequential
  requests for `all`, unless it raises the clamp.
- **The audit tab's wall is untouched** and is the only capped read left on this screen.
