---
status: open
spec: BackOffice 4157
blocked-by: BO 4158
---

# 940 — The stock console opens on every store's stock, held, reserved and status

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4157-the-stock-console-every-stores-stock-held-and-reserved-searched-down-to-the-batch-spec.md`.
The tracer on the web: the feature, its gate, its menu leaf and the one list read on opening.

## What to build

A new feature `features/stock/stock-console` (namespace `stock-console`), route `/stock/console`, one menu leaf under
Stock gated by the feature's own `canOpenStockConsole` (`StockConsole:03`), the page behind `ScreenGate`.
Layout, wording and the order of things follow the accepted prototype, round 3:
`C:\Work\DMSCO\BackOffice\.scratch\proto\store-stock-console\console.html` (it makes no live call). The sync console
(`src/features/admin/sync-console`) is the model for the shape; nothing is imported from it (feature boundary).

- **Top links**: Stores now; Find an item or a batch, and Feeds and switches arrive with their tickets.
- **Stores** reads `StockConsole/Stores` once on opening:
  - tiles that count and filter: All, Counted (Seeded or Blocking), Old hold, SAP quiet, Below zero (Problem);
  - search by store code or city, sort by any figure, in the browser (the list comes whole);
  - columns: store, city, stage, status, stock (till-side) with SAP stock and the gap, held with its two parts,
    reserved, free, items below zero, last update;
  - **reserved** shows "not computed" when it never was (no zero), and its time with a stale mark when stale;
  - **free** says "reserved not included" when it is not;
  - the status pill opens its flags, each with its value and its limit;
  - sums are labelled as base units; the time the list was read is shown; Refresh re-reads it.
- A row opens the store's page (ticket 941).
- "How this is read": a short panel in both languages saying which rows the summary sums and by which rule.

## Spine reach

UI (feature, access, route, menu leaf, wire types in `src/core/models`, api, Stores page, locale files en + ar)

## Proof (→ `tdd` red-green cycles)

- [x] each tile counts and filters its stores · vitest (pure module)
- [x] a status and its flags map to the pill and its lines, value and limit · vitest
- [x] reserved's three states give "not computed", a stale mark, or the figure; free's label follows · vitest
- [x] search by code or city, and sort by a figure · vitest
- [x] the locale key-mirror test passes for `stock-console` · vitest

## Boundaries

Calls only through `@/core/api`; no string literal on screen; logical Tailwind and the bidi rule; the grid on the base
column definition. Read-only: no button changes anything.

## Done when

Proofs green, and on dev the page lists the stores for a person holding the grant and shows the gate to one who does
not.

## Blocked by

BackOffice [4158](C:\Work\DMSCO\BackOffice\.issues\4158-hqs-stock-console-lists-every-store-through-the-stages-address-behind-its-own-grant.md)

## Comments

- 2026-11-22, web built first on `spec/4157-stock-console`, ahead of the server (owner's choice). The Proof cases are
  green under vitest, and typecheck plus the lint gates pass. The wire types follow a drafted contract (spec 4157 and
  BO 4158–4163; the "as built" deviations are in [STOCK-CONSOLE-WIRE-CONTRACT.md](STOCK-CONSOLE-WIRE-CONTRACT.md)). There was no prototype on this machine,
  so the layout follows the ticket text. **Still owed before `done`:** the "on dev" Done-when check, once the BackOffice
  routes (and SIS.Stock 075–080) are deployed, and reconciling the web types with the C# DTOs as built. Status is left
  `open` until then.
- 2026-11-22, the BackOffice side (4158–4163) is built on `pricing2` (9970de845), and the web's contract was reconciled
  against it field by field (ed6e212a). [STOCK-CONSOLE-WIRE-CONTRACT.md](STOCK-CONSOLE-WIRE-CONTRACT.md) is now the
  reconciled contract. Merged to `main` in cf2374f6. **Still owed before `done`:** the "on dev" Done-when check, once
  SIS.Stock 075–080 and SIS.Api are deployed (BackOffice 4164's live walk).
- 2026-11-22, owner's ruling: the Below zero tile follows spec story 7, "over 500 items below zero", not "Below zero
  (Problem)". A Blocking store with a few items below zero is still a Problem on its pill, but not on this tile. The
  tile reads the limit the server's flag carries (`BelowZeroProblem`, 500 by default).
