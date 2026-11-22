---
status: open
spec: BackOffice 4165
blocked-by: 946
---

# 947 — The kingdom map shades the regions, shows each pharmacy as a point, and opens a pharmacy's scorecard

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- **The map** on the right of the home, drawn with Google Maps through the same component and key path as the
  analytics map chart. Only coordinates and pharmacy codes are used on the map; no figure is sent to Google.
- **Zoomed out:** the five regions and Bahrain, drawn from a small boundary file shipped with the front end, shaded
  by their share of flagged pharmacies.
- **Zoomed in:** each pharmacy a green, amber or red point.
- **The filter:** all issues, sales, stock or delivery. It changes the shading, the points and the region table.
- **The region table** beside the map: pharmacies scored, flagged count and share per region.
- **Selecting a region** zooms to it. **Selecting a pharmacy** opens the scorecard panel: the six measures with
  colour, own figure and peer figure, and two buttons (open the store profile; ask the copilot).
- A pharmacy code in the brief opens the same panel.

## Spine reach

routes → map and panel

## Proof (→ `tdd` red-green cycles)

- [ ] the filter changes the points, the shading and the table together · vitest
- [ ] selecting a pharmacy opens its scorecard with six measures · vitest
- [ ] a pharmacy code in the brief opens the same panel · vitest
- [ ] a new pharmacy shows "new" on the growth measures · vitest
- [ ] a pharmacy with no coordinates is counted under the map and not drawn · vitest

## Boundaries

Front end only. Needs Google Maps billing approved for this use.

## Done when

The tests are green, and on dev the map shades the regions and a pharmacy opens its scorecard.

## Blocked by

[946](946-the-command-center-home-shows-the-morning-brief-the-status-line-and-the-language-switch.md)

## Open questions

The boundary file for the five regions and Bahrain: the mock used open boundary data; its licence must allow shipping
it, and the borders must match the official map of the kingdom.
