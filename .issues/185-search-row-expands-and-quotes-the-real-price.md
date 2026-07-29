---
status: open
spec: 180
blocked-by: —
---

# 185 — expandingASearchRowQuotesTheRealPrice

⚠ **A genuinely undrawn surface** — no prototype exists for this panel. It is a build, not a wiring.

## What to build

A search row expands into one **about this item** panel, and its first half answers *"how much is
that?"* with engine truth.

Today that question is answered off the row's `≈` estimate, which reads **~13% under** what the
caller pays — a number built to sort a list, read down a phone as a price. `priceCheck` (contract
v1.6) prices the item for real at the order's own plant, origin, customer and loyalty, VAT-inclusive,
**one unit**.

The rules that make it worth building:

1. **`unitPrice.gross` must equal the basket line's `unitPrice.gross`** for the same item under the
   same header. That equality is the whole point — adding the item must never contradict what the
   agent just said out loud.
2. It renders in a money column **with `SAR`**, exactly like a basket line, because it *is* engine
   money.
3. The `≈` estimate **stays exactly where [168](168-search-in-arabic-no-estimate-as-money.md) put
   it** — the row's meta line, beside the item number. The two numbers coexist on one screen and
   never swap places, so no row changes shape mid-list.
4. A pricing failure is a **typed refusal, never a fallback to the estimate**.
5. The offers half uses [138](138-near-miss-guidance-design.md)'s promise language — the discount
   *definition*, `progress`, `isReady` — and holds **no figure formatted as money at all**. The
   region can guarantee that absolutely because it holds no engine money.
6. `offersComplete: false` prints *offers were not fully checked*, so silence never reads as *no
   offer exists*. It flips to `true` with **no client change**.
7. The gate is `capabilities.canPriceCheck` — `canAddItem`'s predicate. Quoting at a store nobody
   chose is a silent wrong price said out loud.
8. The request carries `transactionId` + `itemNumber` and **nothing else** — map note 4 enforced by
   the wire having no other field.

The panel takes no claim and never queues behind the 15-second lease, so asking the price mid-basket
costs the call nothing.

## Spine reach

model (`PriceCheckResult`, `capabilities.canPriceCheck` — **new**) · api (`priceCheck`) ·
logic (`price-check-view` — new) · component (the expansion + panel — new) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `priceCheckView` — conditions and offers projected; `offersComplete: false` yields the *not
      fully checked* state · pure
- [ ] `priceCheckView` — **no figure formatted as money anywhere in the offers region**, asserted in
      the narrow form over a fixture whose BBY description deliberately contains a currency word
      (`"2 PC for 29.95 SR"` is in our own captures — the broad *no `SAR` anywhere* form fails on
      server text nobody may edit) · pure
- [ ] `priceCheckView` — a refusal yields a refusal state and **never** the row's estimate · pure
- [ ] new `tools/item-panel-drive.mjs` — expanding a row shows the price with `SAR` while the row's
      `≈` estimate stays on its meta line; the panel is absent while the gate is shut · flow (Playwright)

## Boundaries

**Server:** BackOffice [875](C:\Work\DMSCO\BackOffice\.issues\875-cc-price-check-endpoint.md)
(contract v1.6, additive). Envelope codes: `ITEM_NOT_FOUND`, `ITEM_NOT_SELLABLE`,
`NO_PRICE_AT_PLANT`, `NO_CUSTOMER_ATTACHED`, `STORE_NOT_CHOSEN`. **No new codes.**
**i18n:** existing namespace; the panel, its conditions, its offers region, its refusals.
🚩 `Pricing/Simulate` must **not** be reused — route or body. It is gated on a different grant and
its `ManualConditions` would hand an agent the price-affecting power map note 4 removes.

## Done when

In the running app, expanding a search row shows a VAT-inclusive price equal to the line that item
would create, the estimate has not moved, and the panel refuses before a caller and a chosen store.

## Blocked by

None — can start immediately.
