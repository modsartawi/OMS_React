---
status: wontfix
spec: 043
blocked-by: 046, 047, 048, 049
---

# 050 — theHybridLaysOutResponsivelyByWidth

> **Superseded 2026-07-25 by [map 097 — The POS Simulation screen rework](097-simulation-screen-rework.md).**
> Responsive behaviour is re-decided for the reworked device by
> [105 — How the arrangement behaves across widths](105-sim-responsive-arrangement.md), which carries
> this ticket's live concern forward explicitly: the 047 cross-highlight when the blocks are no
> longer beside the grid.

## What to build

The final composition — the grid and the promotion panes laid out **responsively by width**, chosen
automatically, not by a manual switch (the approved decision from map 039 ticket 042):

- **side-by-side** (grid + promo rail) on wide back-office screens;
- **stacked** (promo blocks as the headline over the full grid) when narrower;
- a **compact Lines / Promotions toggle** on the smallest, so each view gets full width instead of both
  being crushed.

Plus the run summary gains the **promotions fired · missed** counts alongside the existing net total /
gross / promotions-total / VAT figures. This ticket assembles the panes 046–049 built into the single
`SimulationPage` hybrid; the sketch ([042-...PROTOTYPE.html](042-sim-promo-hybrid-lock.PROTOTYPE.html))
is the layout + breakpoint ground truth.

## Spine reach

component (`SimulationPage` layout composition + summary counts) · i18n (`simulation` keys) · test (app-drive)

## Proof (→ `tdd` red-green cycles)

- [ ] at a wide viewport grid and promo rail sit side by side; at a narrow one they stack; at the smallest the Lines/Promotions toggle shows one pane · component (RTL, when runner lands) / manual viewport check
- [ ] the summary shows the fired + missed counts · component (RTL, when runner lands)

Runner not installed — verify via `npm run typecheck` + drive `npm run dev`: resize the window across
the breakpoints against live `SIS.Api`, confirm side → stacked → compact-toggle and the summary counts.

## Boundaries

Whole-page layout composition (uses logical Tailwind utilities per the rule — no physical left/right).
New `simulation` i18n keys (compact toggle labels, count labels). No endpoint change. Closes the rework.

## Done when

`SimulationPage` lays the hybrid out side / stacked / compact by width with the fired·missed summary
counts, verified across breakpoints in the running app; typecheck green.

## Blocked by

[046](046-sim-grid-promo-column.md), [047](047-sim-promo-blocks.md),
[048](048-sim-could-have-applied.md), [049](049-sim-progressive-disclosure.md) — needs all panes present
to compose the responsive layout.
