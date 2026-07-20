---
type: wayfinder-ticket
wayfinder: prototype
map: 053
status: done
blocked-by: 054, 057
---

# 059 — List + search UX prototype

## Question

Make a concrete `/prototype` of the inquiry screen to react to, resolving the list-side UX:

- **Search bar**: BBY-number field + date-from / date-to pickers + an "active only" default toggle;
  how they combine; empty/loading/no-results states.
- **Summary grid**: which columns (from ticket 057's row DTO), how status and `yyyyMMdd`/`HHMMSS`
  strings are displayed, a **Details** button/action per row (opens the modal — ticket 060).
- AG Grid vs a simpler table; sort/filter affordances; logical-Tailwind + zero-literal compliance.
- **Export** decision (WPF had Export-to-Xlsx) — in v1 or deferred (resolves the map's fog item).

Deliverable: a linked prototype (HTML or stub React) + the resolved decisions. This is HITL —
review the look/behaviour with the user. Reference: `BbyInquiryView.xaml`, the restyle tokens
(project memory: warm-neutral + terracotta), sim results screen for grid conventions.

## Answer

Resolved via a live `/prototype` session with the user (2026-07-20). Deliverable:
[**assets/059-bby-list-search-prototype.html**](assets/059-bby-list-search-prototype.html) — a
self-contained, interactive prototype on the real restyle tokens (warm-neutral + terracotta), with a
state switcher (default / after-search / cap-reached / no-results / loading) and a light/dark toggle.
Rows are shaped exactly like the [057](057-bby-list-search-endpoint-contract.md) `BbyInquiryRow` DTO.

**One notable reversal:** the charting grill had pencilled "summary grid + per-row Details modal,
*rather than* one flat 28-column grid." The user overturned that here — the operator scans, filters,
and **downloads** by header fields (include/exclude, loyalty tier, min/max, stacking, condTargetType),
so **all 28 fields belong in the grid**. The Details modal is *not* dropped — it moves to
**on-demand** (see decision 5). Net: full-header grid **and** a Details drill, not one instead of the
other. This aligns with 057, which already specified a full-28-field-parity row DTO.

### Decisions locked

1. **Search toolbar (confirmed as prototyped).** BBY-number field (exact match) · "active during"
   from/to date pickers (validity-**overlap**, not `CreatedAt`) · an **Active only** toggle (default
   on, sublabel "status A & valid today"). Combination: the screen opens active-only with no criteria;
   issuing **Search** with any number or date auto-clears `activeOnly` (the 057 client rule) and shows
   a dismissable "filtered" chip; **Reset** returns to the active default. Fields AND together
   server-side.

2. **Grid = the full 28-field `BbyHeader`**, not a curated subset — one horizontally-scrolling table
   with **grouped column headers** (Identity & offer · Validity · Buy/Get rules · Stacking · Loyalty ·
   Audit), a **sticky Status + BBY-number identity column** (so the row is never lost when scrolling
   right), sortable columns, and a **toggleable per-column filter row** (the WPF `ShowAutoFilterRow`,
   on demand). Raw codes render as compact chips (`R`→Document, `A`/`O`→And/Or, etc.), booleans as
   ✓/–, dates `yyyyMMdd→yyyy-MM-dd`, times `HHMMSS→HH:mm`; underlying values stay raw for export. The
   server `isActive` flag drives a green "valid today" marker on the identity cell.

3. **Grid tech = AG Grid Community** (agent recommendation, user accepted). Reverses the earlier
   hand-rolled pick, which was made when the grid was only 7 columns. Rationale: a wide, dense,
   Excel-like scan/filter/export table is AG Grid's core strength (built-in per-column filters, sort,
   pinned columns, virtualization, CSV export) — *unlike* the sim-results grid, which was moved OFF AG
   Grid precisely because it needed bespoke responsive card-folding + cross-highlight in a split pane.
   Theme to the restyle tokens via AG Grid's CSS-variable **Theming API** (the `logical-tailwind` rule
   explicitly exempts third-party widget internals — theme via token API, not physical-class
   overrides); RTL via `enableRtl`. All user-facing chrome (headers, filter placeholders, badges,
   buttons) still goes through `t()` per the zero-literal rule.

4. **Export = v1, CSV** (resolves the map's Export fog item **into scope**). CSV of all 28 raw header
   fields for the current (filtered) result set — free with AG Grid Community's `exportDataAsCsv`,
   opens in Excel. **xlsx deferred** to a later ticket (Community's Excel export is Enterprise-only;
   xlsx would need SheetJS or a server endpoint — not worth blocking v1).

5. **Details modal kept, on-demand.** A **Details ▸** button in the sticky identity column opens the
   SAP-style "Display Bonus Buy" modal ([060](060-bby-detail-modal-prototype.md)). Because the grid now
   carries the full header, 060's modal narrows to what the header grid *cannot* show — the Buy→Get
   **condition rows** (quantities, material/grouping members via the [058](058-bby-detail-endpoint-contract.md)
   `Bby/Detail` + `Bby/GroupingMembers` endpoints). 060/058/055 all remain in scope; the map
   destination (grid + Details modal) holds — refined, not redrawn.

6. **States (confirmed).** Cap-reached amber banner ("first 1,000, newest first — narrow your
   search"), a proper no-results empty state, and a shimmer skeleton while loading.

### Notes for downstream tickets

- **Ticket 060** (Details modal prototype): scope narrows — the modal no longer repeats header
   scalars (the grid owns those); focus it on the Buy→Get condition rows + grouping-member drilldown.
- **`/to-spec`**: the grid is the full 28-field header (not a "summary"); AG Grid Community is the
   chosen widget; Export (CSV) and the on-demand Details drill are both v1.
