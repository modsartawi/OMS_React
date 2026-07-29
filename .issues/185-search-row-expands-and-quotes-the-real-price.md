---
status: done
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

The projection shipped as `priceCheckPanel` in `price-check-view.ts` — one entry point answering
**which of four states the panel is in** (`shut` · `pending` · `refused` · `quoted`) rather than a
`view` over a result that a caller would still have to branch on. Three of the four have **no money
field at all**, which is how rule 4 is held structurally instead of remembered.

- [x] `priceCheckPanel` — conditions and offers projected; `offersComplete: false` yields the *not
      fully checked* state, and flipping it to `true` changes that one flag and **nothing else**
      (same offers, same quote — 787-C's "no client change", made mechanical) · pure
- [x] `priceCheckPanel` — **no figure formatted as money anywhere in the offers region**, in the
      narrow form `guidance-view.test.ts` already settled (a currency word, or decimals *forced* to
      two — `29.95` is the numeral a set price already is). Over a description carrying
      `"2 PC for 29.95 SR"` **and** a `P`-kind discount, which is the one definition that comes
      nearest to being money. The guard self-tests the shape it guards against · pure
- [x] `priceCheckPanel` — a refusal yields a refusal state and **never** the row's estimate: the
      module is handed the whole row, estimate and all, and the refusal state serialises with no
      figure in it at all. Each of §3.4's five codes is a sentence, and an unknown code is one too · pure
- [x] new `tools/item-panel-drive.mjs` (31 assertions, 31/31) — expanding a row shows the price with
      `SAR`, **equal to the capture's own basket line** for the same item; the row's meta line is
      **byte-identical** before and after expanding with its `≈` still on it; the estimate appears
      nowhere in the panel; the shut gate draws no expander and sends **no `PriceCheck` at all**; the
      request carries `transactionId` + `itemNumber` and nothing else, on a GET with no body; and
      `Pricing/Simulate` is never touched · flow (Playwright)

Also green: `npm run typecheck`, `npx vitest run` (671), `npm run lint`, and
`tools/callcenter-drive.mjs` 507/507 — the last because the *priced by* conditions run was extracted
into a shared `Conditions.tsx` the basket line now uses too (one rule, two surfaces).

## What the reviews moved

`/standards-review`'s two axes each found something real, and both are fixed in the slice:

- an offer whose `progress` the wire omitted got `shortfall: 0` and was announced as ***applies to
  this item*** — the inverse of the fact. The state is now branched on the **class**, and where there
  is nothing honest to say it says nothing.
- the offer's DOM handle keyed on `offerId`, which is the empty string on every offer in this
  capture (859) — two distinct offers under one handle. It keys on `guidance-view`'s `cardId`, which
  exists for exactly that case, and the drive asserts the handles are distinct.
- the pure test's row estimate was the capture's own `net`, so the *never the estimate* assertion
  could not have failed on a **quoted** panel. It is now a figure the capture contains nowhere.
- `PriceQuote` no longer carries `title` / `title2` / `net`: nothing drew them, and the row one line
  above already carries both names and the number.

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
