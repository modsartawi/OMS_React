---
status: done
spec: 334
blocked-by: — (+ BackOffice 2151, BackOffice 2152)
---

# 335 — Cash Collections opens with finance's nine columns and a Type

BackOffice spec 2149 D1-D3; web spec 334 item 1. Server: BackOffice 2151 (the figures, Type, order) and 2152 (theft filled in).

## What to build

The Cash Collections grid opens with these default columns, in this order: collection date, business date, store code, type, description, amount, surplus, net collected, collector — then the profit center (store) column.

- Type shows the server's label as sent (`Regular`, `Short`, `Regular+Surplus`, `Regular+Stolen`, `Regular+Surplus+Stolen`, and the outside-system label). The web does NOT derive it.
- Surplus is shown as the negative figure the server sends; zero shows as zero, not blank.
- Every column the screen has today stays available behind "More columns". Nothing is deleted.
- Rows are shown in the order the server returns them (collection date, store, business date); the grid applies no default sort of its own. A user may still sort by clicking a header.
- The wire model declares the fields the server already sends and the web never declared (type, cash sales, settlement, status and the rest named in the contract).
- The collector filter, date filters and the slip-count column keep working.

## The seam

Build and test against a stub of EXACTLY the shape recorded under `## Web contract` in the BackOffice ticket(s) named above (`C:/Work/DMSCO/BackOffice/.issues/`). Never invent a field. If that heading is missing, the BackOffice ticket has not landed and this ticket is not startable. **Do not edit the BackOffice repo.**

## Spine reach

oms-react screen / wire model / vitest

## Proof (→ `tdd` red-green cycles)

- [x] `default columns are finance's nine in order, then profit center` · vitest (collections columns). In
  `collections-columns.test.ts`, "finance's sheet": `DEFAULT_FIELDS` is `collectedAt, businessDay, storeId,
  collectionType, description, amount, surplus, netCollected, collectorOperatorId, storeText`; the built columns
  follow it; each of the ten is headed by its own key. Mutation: swapping Type and Description → 2 red.
- [x] `type cell shows the server label for each of the five shapes` · vitest. The five and `Outside system`
  are shown as sent. A second case checks the label is never derived: the parts contradict the label and the
  label still wins, and an unknown label is shown rather than blanked. Mutation: a `valueGetter` that derives
  `Regular+Stolen` from `hasTheft` → red. Also covered: surplus is the negative sent and a zero is `0.00`;
  finance's `3,500.00 / -3,000.00 / 500.00`; 2152's sample row verbatim; the joined `A | B` description shown
  whole; Collector is the id. Mutation: `Math.abs` on money → 2 red.
- [x] `more columns still offers every previous field` · vitest. All 27 fields the screen had before this ticket
  are among the open columns, each once, with the slip count too. The completeness union (default + tail +
  slips + argued non-columns = the whole wire row) still holds over the 26 newly declared fields. Mutation:
  dropping `storeName` from the tail → 3 red.
- [x] `rows keep the server order by default` · vitest. No column carries `sort`/`initialSort`/`sortIndex`/
  `initialSortIndex`, with the tail open or folded and the slip count drawn. Neither does the default ColDef,
  and `sortable` stays true. Mutation: `sort: 'desc'` on the date columns → red.
- [x] Screen driven (`tools/collection-drive.mjs`, 18 new `335 —` checks, all green). The stub follows 2151 +
  2152's Web contracts: the six Type shapes, finance's figures, and the Arabic descriptions copied from the
  samples. The checks: the exact header row; each Type as sent; Surplus negative and `0.00`; the Regular+Stolen
  sample; descriptions, the joined one included; Collector is the id; a settlement receipt's blank business
  date; rows drawn in the order sent, with no header sorted on arrival; the same rows sent reversed are drawn
  reversed; a header click still sorts Amount ascending; the collector filter still sends
  `CollectorOperatorId`; the exported workbook carries Type as text and Amount + Surplus = Net Collected;
  no raw key.
- **Drives, overall.** `tools/collection-drive.mjs` passes 258/260. The 2 red are the ACR landing-date checks
  ticket 336 already recorded (b124dfe), not this ticket's. `tools/collections-filters-drive.mjs` 44/44 and
  `tools/slip-count-drive.mjs` 65/65 were updated for the new order. `tools/profit-center-drive.mjs` passes its
  11 grid checks, then crashes where it still reads a CSV export (ticket 336 replaced it). It crashed the same
  way with this slice stashed.
- **Outstanding (not AFK):** no drive against a live SIS.Api carrying 2151/2152. Every envelope is stubbed.

## Boundaries

Web only. English locale only (Arabic appears inline where labels already carry it). No new dependency.

## Done when

An accountant opening Cash Collections sees finance's sheet: same columns, same order, same type words.

## Blocked by

BackOffice 2151 and BackOffice 2152 (their `## Web contract`)

## Comments

**Built (2026-09-30), AFK.** Built against BackOffice 2151's `## Web contract` (e3ad98072, branch `spec2149`)
and reconciled with 2152's once it was committed (a0989fe51). 2152 adds no field and renames none. Its values
(the joined `A | B` description; `hasSurplus` false on a `Regular+Stolen` row) are in the model's docs and the
fixtures.

- **Wire model:** `CollectionInquiryRow` declares all 26 contract fields. Four are columns (`collectionType`,
  `description`, `amount`, `surplus`). The other 22 are in `NON_COLUMN_FIELDS`, grouped with a reason.
- **Columns:** the default set is finance's nine, then Profit Center (Store). The six former defaults lead the
  More-columns tail. Headers: "Store Code" (was "Store"); "Collector" is now the id and the name is
  "Collector Name"; new "Type", "Description", "Amount", "Surplus". Amount and Surplus are money columns, so the
  workbook writes them as numbers.
- **Slips** still follows Card Total. With the tail folded it is the last column.
- Decisions in `.afk/HITL-335.md`: Collector as the id, the collection date keeping its time, "Store Code",
  no new tail columns, Slips placement, and the 2152 reconciliation.

**Review round.** `/code-review`: no correctness bugs. It noted one weak drive check (`'Reason'` matched inside
"Reason Detail"), fixed to compare whole headers. `/standards-review`: no hard violations.
- Fixed: every group in `NON_COLUMN_FIELDS` now has its own reason; the Type comment lists all six labels; the
  off-system fields have a doc line; the Outside-system stub row carries its off-system values.
- Kept for the owner (logged): Slips on the landing grid, the collection date's time, and no tail columns for
  the audit fields.
