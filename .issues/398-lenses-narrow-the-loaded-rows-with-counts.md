---
status: open
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

- [ ] `lensPredicatesMatchRowFields`: each of the five lenses selects exactly its rows from a fixture
  · pure
- [ ] `lensCountsWording`: before a search every count is "—". A full page (rows = Limit) renders
  "N+" on every lens. Column filters don't change any count · pure
- [ ] `tools/deliveries-list-drive.mjs`, extended. Clicking a lens narrows the grid with no request.
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
