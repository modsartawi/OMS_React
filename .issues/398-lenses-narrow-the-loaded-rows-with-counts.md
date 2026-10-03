---
status: done
spec: 380
blocked-by: 397
---

# 398 — Lenses narrow the loaded rows, with counts

## What to build

The Deliveries list gains a **220px views rail** at its inline-start edge, on a `--card-2` ground
with an inline-end border. This ticket fills its first section, **Lenses**.

- **What a lens is.** A **Lens** is built in, and is a predicate over the **loaded rows**. It never
  calls the server.

  | Lens | Matches |
  |---|---|
  | All | every row |
  | Needs attention | `failedJobsCount > 0` |
  | Cancellation requested | `closeStatus === 'R'` |
  | Dawaa Now | `isExpressDelivery` |
  | Rescheduled | `rescheduled` |

- **A lens row** shows an icon, a label and a count in mono. The active lens takes the
  `--primary-050` ground plus a 3px `--cursor` bar on the inline-start edge. The Needs attention
  count turns danger while it is above 0.
- **Counts** are the loaded rows each lens matches, over the **whole loaded result**, ignoring the
  grid's column filters.
  - Before any search, every count reads **"—"**.
  - When `rows.length === Limit`, **every** count reads as a lower bound (**"200+"**, "7+").
  - There is no server count.
- **The grid bar.** It shows the row pill ("5 deliveries", or **"12 of 40 shown"** plus *Clear grid
  filters* while column filters narrow the grid). When rows = Limit, the **cut-off line** reads
  "Showing the newest 200, there may be more. Narrow the search or raise the limit." It keeps
  Columns (today's chooser), Export and the Inspector toggle.
- **Empty state.** A lens with no matching loaded rows shows "No loaded rows match this lens" over a
  **still-mounted** grid.
- **Palette.** Each lens joins This screen as a "Show: ‹lens›" row with no key.

Saved views ("My views") are 400.

**Implements:** spec 380 **L1, L2, L7** (the lenses half), **L9** and **L17** (the lenses half).

**Rulings:** [366](366-deliveries-views-and-their-counts.md) (the lens, counts said honestly) and
[368](368-the-deliveries-list-as-one-screen.md) §1 (the views rail, the grid bar) and §2 (palette
rows). Prototype: branch `prototype/368-deliveries-list` (`9b7f32c`), variant A, with captures
`A-open-light.png` and `A-cut.png` in [368-shots](assets/368-shots/).

## Spine reach

store/logic (pure lens predicates and count wording) · component/route (the views rail, the grid
bar, the lens empty state, the palette rows) · i18n (`deliveries:lens.*`, `deliveries:gridBar.*`)
· test

## Proof (→ `tdd` red-green cycles)

- [x] `lensPredicatesMatchRowFields`: each of the five lenses selects exactly its rows from a fixture
  · pure
- [x] `lensCountsWording`: before a search every count is "—". A full page (rows = Limit) renders
  "N+" on every lens. Column filters don't change any count · pure
- [x] `tools/deliveries-list-drive.mjs`, extended. Clicking a lens narrows the grid with no request.
  The counts match. A Limit-hit search shows "N+" and the cut-off line. A column filter shows "N of
  M shown". "Show: Needs attention" from Ctrl+K applies the lens. The drive runs in light, dark and
  RTL · flow (Playwright)

## Boundaries

- No new API endpoint.
- New `deliveries:lens.*` and `deliveries:gridBar.*` keys.
- Count strings like "200+" and "12 of 40" are each formatted to one value and isolated once (384).

## Done when

The five lenses with honest counts narrow the loaded rows. The grid bar says what is shown, and the
proof tests and the drive are green.

## Blocked by

[397](397-the-selected-row-shows-in-a-resizable-inspector.md).

## Comments

**Built 2026-10-03 (AFK).**

- **Pure module `lenses.ts`.** The five predicates and `lensCount`/`lensCounts`: "—" before a
  search, "N" exact, and "N+" on every lens once rows ≥ Limit. `rowPill`: the lens total, or
  "shown of total" while column filters narrow. `lensIsEmpty` is true only when rows were loaded
  and the lens matches none of them. Counts take the whole loaded result, so no column filter can
  reach them.
- **The search store** gains the lens and the Limit the loaded rows ran with. `effectiveLimit` is
  extracted from `buildDeliveryQuery`, so the cut test and the wire share one value. The lens
  survives a new search and a trip to Details (R-8).
- **The views rail (`ViewsRail.tsx`).** 220px wide, flush at the inline-start edge, on `--card-2`
  with an inline-end border. Under a "Lenses" heading, each row is an icon, a label and a mono
  count isolated once in `Ltr`. The active row takes `--primary-050` and a 3px `--cursor` bar.
  Needs attention's count is `--danger-800` while above 0. My views is 400's.
- **The page.** The lens is the grid's external filter (through a ref, then `onFilterChanged`),
  so it never searches. A current row the lens hides is deselected. The grid bar's `RowSummary`
  replaces "Hit Count":
  - the row pill: "8 deliveries", "1 delivery", "8+ deliveries", and a lower bound always plural;
  - "3 of 8 shown" plus *Clear grid filters*;
  - the amber cut-off line.
  Each number sits in a `<Trans>` slot isolated with `Ltr`.
- **Empty state.** "No loaded rows match this lens" overlays the still-mounted grid, and AG Grid's
  no-matching-rows overlay is suppressed while it shows.
- **The palette.** Five "Show: ‹lens›" rows in This screen, registered through `useCommands`, with
  icons and no key.
- **Toolbar.** Columns now sits before Export (368 §1). Open Order, Open Delivery and the old
  ViewManager stay: see the HITL log.
- **Export** writes what the grid shows, so the active lens narrows an export the way column
  filters already did.

**Proof:**
- **vitest:** `lenses.test.ts` has 14 tests (`lensPredicatesMatchRowFields` and
  `lensCountsWording`, pinned against the en bundle's wording). The full suite is 186 files /
  3388 tests.
- **`tools/deliveries-list-drive.mjs`: 158/158** in light, dark, LTR and RTL. New checks cover:
  - the rail's edge, width, ground and border;
  - "—" before a search;
  - counts `8 1 1 1 1` with the danger ink;
  - a lens narrowing the grid with no `DeliveryDocumentList` request;
  - the active pair;
  - "3 of 8 shown" + Clear;
  - the lens empty state over a mounted grid;
  - a Limit-hit search (Limit 8) reading `8+ 1+ 1+ 1+ 1+`, with "8+ deliveries" and the cut line;
  - "8+" as one ltr isolate with no isolate characters;
  - "1+ deliveries";
  - "Show: Needs attention" from Ctrl+K with no key and no request.
- **Other drives:** command-palette 366/366, grid-theme 125/125, oms-access 28/28 (one run
  flaked on a Details check and passed twice on re-run).
- **foundation 1294/1302**, the same baseline failures (topbar, bell). Its Arabic Reason probe
  now scrolls the column into view, because the rail narrows the grid.
- `screen1-smoke.mjs` (live SIS.Api, not run) now reads the row pill instead of "Hit Count".
- **Gates:** typecheck clean. Lint has 4 gates clean, with 158 contrast pairs: +8 for
  `--muted-foreground` and `--danger-800` on `--card-2` and `--primary-050`. Build green.

**Reviews:**
- `/code-review` (medium) found 1 issue, fixed: a lower bound of one read "1+ delivery". It now
  has its own plural-only key, with a drive check.
- `/standards-review` found no hard violations. I applied:
  - one `lensCountText` helper;
  - a dead `?? DEFAULT_LIMIT` removed;
  - `hitCount` removed;
  - the rail's aria-label "Lenses and saved views" (CONTEXT.md avoids "view" alone);
  - the toolbar order.
  Not taken: the six-place add-a-lens edit, because palette labels are bare keys.

**Left for the owner (HITL-398):**
- whether L9's list drops Open Order and Open Delivery;
- the client-sent Limit as the cut test (check at the live door);
- "12 of 40" isolated per value (the words rule).

S3's owner sign-off (401) and a human eye on real Arabic remain the owner's.
