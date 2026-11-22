---
status: open
spec: BackOffice 4157
blocked-by: 943, BO 4163
---

# 945 — SAP's movements for a store and the ledger's lines for an item are read by their own buttons

Spec: BackOffice `C:\Work\DMSCO\BackOffice\.issues\4157-the-stock-console-every-stores-stock-held-and-reserved-searched-down-to-the-batch-spec.md`.

## What to build

Layout, wording and the order of things follow the accepted prototype, round 3:
`C:\Work\DMSCO\BackOffice\.scratch\proto\store-stock-console\console.html` (it makes no live call). The sync console
(`src/features/admin/sync-console`) is the model for the shape; nothing is imported from it (feature boundary).

- **A store's SAP movements tab**. Nothing is read on opening.
  - two day boxes (entry days, at most 5, the last 2 days by default) and **Read SAP**;
  - above the list, where our feed stands: the SAP place and its last attempt;
  - the answer by entry day and movement type: documents, lines, quantity in and out;
  - a row opens its lines, paged: document, line, item and name, batch, quantity, posting day, entry time, and the
    mark: applied, received not applied, not received by us;
  - "SAP is not connected on this host" and "SAP could not be reached" are their own sentences, never an empty list.
- **An item's Movements tab**. Nothing is read on opening.
  - two day boxes (at most 7 days, the last 7 by default) and **Read**;
  - our ledger's lines, newest first, paged: time, feed (SAP or till), movement type, quantity, batch, the document,
    and the effect on each counter.
- A window over its limit is stopped in the browser with a sentence, before any call.
- "How this is read" on both: SAP read live for the store; our own ledger for the item, and why the two are not put
  side by side.

## Spine reach

UI (two tabs, wire types, api, locale files)

## Proof (→ `tdd` red-green cycles)

- [x] neither tab asks before its button, and a window over the limit asks nothing · vitest (pure module)
- [x] the three marks map to their labels · vitest
- [x] SAP not configured and SAP unreachable render their sentences, not an empty list · vitest
- [x] a ledger line's effect cells for a SAP sale, a till sale and a receipt · vitest
- [x] the locale key-mirror test passes · vitest

## Boundaries

As ticket 940.

## Done when

Proofs green, and on dev the SAP tab shows a store's count days after Read SAP, and an item's ledger lines appear
after Read.

## Blocked by

[943](943-an-items-page-writes-out-its-sum-and-opens-its-batches-holds-takes-and-other-stores-and-find.md),
BackOffice [4163](C:\Work\DMSCO\BackOffice\.issues\4163-an-items-ledger-lines-and-a-stores-sap-movements-reach-the-stock-console-within-their-day-li.md)

## Comments

- 2026-11-22, web built first on `spec/4157-stock-console`, ahead of the server (owner's choice). The Proof cases are
  green under vitest, and typecheck plus the lint gates pass. The wire types follow a drafted contract (spec 4157 and
  BO 4158–4163; the "as built" deviations are recorded in the merge commits). There was no prototype on this machine,
  so the layout follows the ticket text. **Still owed before `done`:** the "on dev" Done-when check, once the BackOffice
  routes (and SIS.Stock 075–080) are deployed, and reconciling the web types with the C# DTOs as built. Status is left
  `open` until then.
