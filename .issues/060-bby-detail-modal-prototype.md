---
type: wayfinder-ticket
wayfinder: prototype
map: 053
status: done
blocked-by: 055, 058
---

# 060 — Details modal prototype (SAP "Display Bonus Buy" mirror)

## Question

Make a concrete `/prototype` of the per-row **Details modal** — the SAP "Display Bonus Buy" shape —
to react to. The user has a **SAP example/screenshot** of the target layout; use it as the fidelity
reference. Resolve:

- **Layout**: Header/Org block (number, description, promo, offer, profile, status, validity + time,
  currency, limit, min/max, cond-target, link categories, stackability, includes/excludes,
  loy groups/tiers, score) → **Buy** grid (prereqs, with material-grouping drilldown popup) →
  **Get** grid (conditions: type, scale, qty/uom, discount type + value, pricing unit).
- The **`Document` total-discount** variant (Get grid collapses to a single "Total Discount" form).
- Grouping-member **drilldown** interaction (double-click/expand → member list).
- Modal-in-grid mechanics (open from the Details button in ticket 059), close, loading/error.
- Zero-literal + logical-Tailwind; label vocabulary from ticket 054's glossary.

Deliverable: a linked prototype + resolved decisions. HITL — review against the user's SAP example.
Reference: `BonusBuyDetailController.cs` + `BonusBuyDetailView.xaml` (38KB layout),
`BonusBuyGroupMembersController.cs`. **Exclude** the live-basket status column (out of scope).

## Answer

Prototype built and **approved** by the user (HITL review, 2026-07-20). Asset:
[060-bby-detail-modal-prototype.PROTOTYPE.html](060-bby-detail-modal-prototype.PROTOTYPE.html)
(also published as an interactive artifact:
`https://claude.ai/code/artifact/f8efdfe3-7971-49b6-9c0b-d1ffcd805d19`). Self-contained HTML; app
tokens; bottom bar switches scenario, header layout, and theme.

### Decisions the review settled

1. **Layout order (SAP mirror):** title bar (number + status badge + validity badge + description) →
   **Header** block → **Buy side** (prerequisites) → a "then" link strip carrying each side's link
   category → **Get side** (conditions) / total-discount card. Approved as-is.
2. **Buy/Get line items = lightweight read-only tables**, not AG-Grid instances (user pick). The
   summary grid (ticket 059) stays AG-Grid; the modal's 1–3-row lists are plain tables. Large sets
   never render inline — they go to the members drilldown.
3. **Header layout = split panels** (the artifact default the user approved): a distinct
   **Organisation** panel (sales-org / dist-channel / plant / currency) above a **Header & rules**
   panel (promo, offer, profile, status, validity window, condition target, limit, link Buy/Get,
   min/max, stackability, score, loyalty groups/tiers, includes/excludes). A merged single-grid
   variant exists in the prototype but is not the chosen form.
4. **Document total-discount branch** (`condTargetType==='R'`): Get grid is replaced by a single
   total-discount card — big discount figure + type + condition type + basket requirement
   (`header.minValue`). Buy side shows an empty-note (qualification is basket value).
5. **Grouping drilldown:** grouping Buy/Get rows carry an inline "N members" chip → opens a nested
   paged popup (Endpoint B), footer notes per-page enrichment. Both Buy-side (`matGrouping`) and
   Get-side (`condNumber`) keys supported.
6. **States:** loading skeleton; not-found → `BBY_NOT_FOUND` business error card (per api-envelope,
   shows the message, not "unexpected"), no live-basket status (out of scope).
7. **Codes → labels** mapped the client `t()` way (status A/I/D/X, link A/O, condTarget R/P/M/G,
   discount P/R/%, condType ZB0x, scale A/B/C, prereq MGP/MAT); "Active now" derived per the
   glossary rule (status A AND validFrom ≤ today ≤ validTo, ordinal `yyyyMMdd` compare).

Feeds `/to-spec` for the Details-modal section of the BBY Inquiry spec.
