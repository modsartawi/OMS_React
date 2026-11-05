---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md
blocked-by: — (server: BackOffice 3391)
---

# 786 — The Order / ERX list finds an order by any identifier, with Bupa Care Connect and No-delivery-yet lenses

## What to build

Backend: BackOffice spec 3389 (`C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md`). SIS.Api minimal APIs, System.Text.Json web defaults (camelCase). Door: BackOffice 3391 `GET SdDocumentWeb/OrderDocumentList`.


A new route beside `oms/deliveries` built on the delivery list's shell, as its own feature (a feature never imports
another — shared pieces move to `core/`): query-bar tokens with the criteria of BackOffice 3391, relative date kept
in saved views, the identifier-ignores-date rule mirrored client-side, lenses **All / Bupa Care Connect** (type BUPA,
source ERX) **/ No delivery yet / CHANNEL / ENGINE**, an inspector pane, the status bar (exact vs "at least"), Excel
export **without patient and member ID unless the insurance-view grant is held**. A row opens Document Details
(`oms/document/:documentNo`); a row with a delivery links its delivery. EN + AR, RTL, the bidi rule.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [ ] `order-list query model: identifiers ignore the date, other tokens need a range ≤ 31 days` · vitest
- [ ] `order-list lenses: Bupa Care Connect / No delivery yet / CHANNEL / ENGINE match their rows` · vitest
- [ ] `order-list saved view keeps a relative date` · vitest
- [ ] `order-list export leaves patient and member ID out without the insurance grant` · vitest

## Boundaries

Read-only screen; door stubbed until BackOffice 3391 is on staging.

## Done when

Proof tests green; the list finds 1006358459 by approval against the real door on dev.

## Blocked by

Server: BackOffice [3391](C:\Work\DMSCO\BackOffice\.issues\3391-the-order-search-finds-orders-and-erx-by-any-identifier-before-they-have-a-delivery.md)
