---
type: wayfinder-ticket
wayfinder: grilling
labels: [wayfinder:grilling]
map: 354
status: wontfix
blocked-by: 355, 356
---

# Agree the central theme contract and specification

## Question

What central theme contract faithfully expresses the accepted prototypes and gives future screens one clear source for colors, typography, spacing, control sizes, radii, borders, and interaction states?

Use grilling and domain-modeling to settle the remaining choices with the owner. Prefer extending the existing semantic CSS tokens and grid adapter where they already work. Specify exact light/dark palette values and roles; token ownership and naming; common component variants and density rules; the app-to-AG-Grid mapping; and the small set of justified exceptions. Distinguish palette values from semantic roles and from component styling without adding implementation vocabulary to the business glossary.

Identify which historical design rulings are retained or superseded, and how contrast, focus, status meaning, and consistent token consumption will be checked. Link the visual evidence and resolve any cross-screen exceptions surfaced by the earlier ticket. If new questions are still unresolved, create precise child decisions rather than hiding assumptions in the specification.

The answer supplies the agreed contract for a ready theme specification using the repo's `to-spec` workflow. The final specification should reference decisions by title, include a representative validation matrix, and be sufficient for a later rollout plan. Do not slice or execute that rollout here.

## Cancelled

Cancelled 2026-10-02 by the owner: the whole theme map is dropped in favour of the Ops Console direction (new map on main). Nothing here is a production baseline.
