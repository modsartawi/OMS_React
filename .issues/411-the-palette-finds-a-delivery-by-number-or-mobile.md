---
status: open
spec: 380
blocked-by: 395
---

# 411 — The palette finds a delivery by its number, order, document or the customer's mobile

> ⛔ **NOT for the AFK loop — waiting on BackOffice.** This ticket needs spec 380's **BO-2**
> (`DeliveryQuickFind` and its two DBA-run indexes), which has **not been filed** in BackOffice's
> tracker yet. Do not start it until that read exists and records its `## Web contract`.

## What to build

The Ctrl+K palette gains its **live search** group (spec 380 Further Notes "Palette live search",
**BO-2**; ruled in [374](374-what-read-backs-the-palettes-live-delivery-search.md) and
[376](376-what-the-palettes-live-search-matches-and-shows.md), amending
[364](364-what-the-command-palette-holds.md)).

- **A typed term** runs a debounced (**250 ms**) server search, cancelled through `signal` on the
  next keystroke.
- **Matching** (the server's, by term shape):
  - delivery, document and order number: exact or prefix (≥4 chars);
  - the mobile: **exact across its stored formats** (`05…`, `9665…`, `+9665…`);
  - **no suffix, never by name**.
- **A hit row** shows the delivery no. (mono), the **status pill** from the `@/core` timeline
  derivation (396) over the hit's row fields, the store code, the entry date and a **matched-on
  tag** (delivery, document, order or mobile). **No name, no phone, never the OTP.**
- **Opening a hit** navigates to Delivery details, whose own gate answers not-found or denied (the
  same as Jump to number).
- **Gating:** the group shows only with **both** `canOpenList` and `canOpenDetail`. Pending or
  errored probes **fail closed**. The server's grant filters stay the boundary.
- **There is no flagged stub.** The group doesn't exist until the route does. Jump to number keeps
  covering exact numbers.

## Spine reach

model (quick-find hit) · api (`quickFind` in a core OMS api over `@/core/api`) · logic (debounce +
cancel, gating, hit → status pill) · component (palette group rows) · i18n (`common`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `live search group is hidden unless both OMS grants are confirmed; pending or errored hides it` · pure
- [ ] `a hit row carries number, status from the shared derivation, store, entry date and matched-on, and never name, phone or OTP` · pure
- [ ] `tools/palette-search-drive.mjs`: light, dark and RTL against a stub of **exactly** BO-2's recorded payload; typing debounces and cancels the stale request; a mobile in each stored format finds the delivery; Enter opens Details · flow (Playwright)

## Boundaries

- **New endpoint (BO-2):** `DeliveryQuickFind`, gated by both OMS grants. It runs static `TOP 8`
  branches:
  - delivery-number prefix on the PK;
  - document-number prefix on index 028;
  - order-number prefix on a new `IX_DeliveryHeader_OrderNo`;
  - `CustomerPhone IN (@local, @intl, @plusIntl)` on a new `IX_SdDocumentCustomer_CustomerPhone`.

  **The payload:** `deliveryNo · documentNo · orderNo · storeCode · entryTime · matchedOn` plus the
  status fields. **There is no `customerName` and no `customerPhone`.**
- **Envelope:** a business `success:false` shows its message in the group. 401 belongs to
  `handle401`.
- **i18n (`common`):** `palette.search.group`, `palette.search.matchedOn.{delivery,document,order,mobile}`,
  `palette.search.empty`, `palette.search.failed`.
- **Pre-build checks, BackOffice's:** is 028 applied in prod, does an unscripted phone or OrderNo
  index already exist, and what is the histogram of phone formats at rest.

## Done when

With both grants, typing a number or mobile in Ctrl+K lists matching deliveries with their status
and no PII, Enter opens the record, and the drive is green against BO-2's real payload.

## Blocked by

- 395 — the call center's palette is the core one (the end of S2's palette work)
- **BackOffice BO-2:** `DeliveryQuickFind` + the two `ONLINE` indexes (not yet filed)

## Open questions

- **BackOffice ticket number once filed** (BO-2), and its `## Web contract`.
