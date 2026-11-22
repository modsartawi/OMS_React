---
status: open
spec: BackOffice 4157
blocked-by: 940, BO 4159
---

# 941 — A store's page reads its header fresh and searches its items and batches only when asked

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4157-the-stock-console-every-stores-stock-held-and-reserved-searched-down-to-the-batch-spec.md`.

## What to build

`/stock/console/store/:store`. Layout, wording and the order of things follow the accepted prototype, round 3:
`C:\Work\DMSCO\BackOffice\.scratch\proto\store-stock-console\console.html` (it makes no live call). The sync console
(`src/features/admin/sync-console`) is the model for the shape; nothing is imported from it (feature boundary).

- **Header**, read on opening from `StockConsole/Stores/{store}`: store, city, stage, status and flags; six figures
  (SAP stock, till-side stock, held with its two parts, reserved, free, last update); the SAP place and the last till
  read.
- **Tabs**: the frame for all seven, with Items and Batches built here. The open tab is in the address (`?tab=`);
  only it is mounted; Refresh re-reads it alone.
- **The search-first list frame**, shared by every list tab and by Find:
  - boxes: item number or name; batch or vendor batch (optional); a filter; Search and Clear. (The GS1 box arrives
    with ticket 944.)
  - on opening: "Nothing is read yet", and no call;
  - Search, or Enter in a box, reads; empty boxes list the whole view; 25 a page with the total and a pager;
  - Clear empties the boxes and the list;
  - the address carries the boxes, the filter, the sort, the page and that a search ran, so a shared link shows the
    same rows; opening such a link reads.
- **Items**: number, name (in the reader's language), SAP stock, till-side, gap, held, reserved, free, last update;
  filter (with stock, below zero, held, SAP and till differ); sort (item, held, till-side, gap). A row opens the
  item's page (ticket 943).
- **Batches**: item, our batch, vendor batch, expiry, SAP stock, till-side, held, free for the take door, first
  received, a mark on a placeholder batch; filter (with stock, below zero, held, placeholder, expired, expires within
  90 days).
- A refusal shows its own sentence: busy ("the console is busy, try again"), timed out, name too wide, Stock
  Visibility not reached.
- "How this is read" on each tab.

## Spine reach

UI (store page, tab frame, search-first frame, two tabs, wire types, api, locale files)

## Proof (→ `tdd` red-green cycles)

- [ ] a list tab asks nothing until a search ran, and asks on Search with empty boxes · vitest (the frame's decision as a pure module)
- [ ] the boxes, filter, sort, page and "ran" go to the address and come back the same · vitest
- [ ] Clear returns to "nothing is read yet" · vitest
- [ ] each refusal code maps to its sentence · vitest
- [ ] a batch row's placeholder mark and expiry cell · vitest
- [ ] the locale key-mirror test passes · vitest

## Boundaries

As ticket 940. The frame is the feature's own; it does not import the sync console's grid.

## Done when

Proofs green, and on dev opening a store reads the header only, and its items and batches appear after Search.

## Blocked by

[940](940-the-stock-console-opens-on-every-stores-stock-held-reserved-and-status.md),
BackOffice [4159](C:\Work\DMSCO\BackOffice\.issues\4159-a-store-opens-fresh-on-the-stock-console-and-its-items-and-batches-are-searched-by-number-na.md)
