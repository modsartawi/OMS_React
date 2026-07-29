---
status: open
spec: 180
blocked-by: 185
---

# 186 — thePanelNamesTheStoresThatHaveIt

## What to build

The same **about this item** panel gains its second half: when the order's store cannot supply an
item, the agent can say who can.

`stockElsewhere` (contract v1.7) is a **separate call** from the price check, sharing the panel and
the gate but not the shape — and that separation is the design, not an accident. The price is a
lock-free engine run inside SIS.Api; this is the **only remote HTTP hop on the whole contract**. A
stock outage must not cost the agent the price they asked for, so the two render together and **fail
independently**.

The rules:

1. **Read-only, by ruling, not omission.** No control in this block moves the order. A store change
   re-prices every line and refuses atomically — a blast radius that cannot live inside a per-item
   disclosure — and the list is ranked *from* the order's plant, so a one-click rebind would
   invalidate the list it was clicked from. The panel **may name** the store-change path in words.
2. **One availability number, and it is ATP** — the same definition as the search row's. The till's
   grid shows on-hand beside it; two availability numbers read down a phone is how the larger one
   gets promised.
3. Nearest first, stores with no stock dropped, the order's **own** plant excluded, capped at 10
   with an honest `withStock` total and a `truncated` marker.
4. **Unknown distance is a value, never a missing store.** A null row distance draws blank and the
   store still appears.
5. **`distanceKnown: false` means the whole list is honestly unranked** — ordered by store code,
   and said so. It must never be a plausible ranking measured from `(0,0)`.
6. **`available: false` means unknown, not empty.** *We could not check* renders differently from
   *nobody has it*, per [135](135-agent-console-prototype.md)'s three-way ATP rule.

## Spine reach

model (`StockElsewhereResult` — new) · api (`stockElsewhere`) · logic (`stock-view` — new) ·
component (the panel's second half) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `stockView` — the three-way rendering: a count, *none at store*, and *we could not check*,
      with `available: false` producing the third and never the second · pure
- [ ] `stockView` — `distanceKnown: false` orders by store code and marks the list unranked · pure
- [ ] `stockView` — a row with a null `distanceKm` renders blank and is **never dropped** · pure
- [ ] `item-panel-drive.mjs` extension — a stock outage leaves the price on screen and intact; the
      price refusing leaves the store list intact · flow (Playwright)

## Boundaries

**Server:** BackOffice [876](C:\Work\DMSCO\BackOffice\.issues\876-cc-stock-elsewhere-endpoint.md)
(contract v1.7, additive). Envelope codes: `ITEM_NOT_FOUND`, `NO_CUSTOMER_ATTACHED`,
`STORE_NOT_CHOSEN`. **No new codes and no new capability** — a stock outage is rule 6, not an error.
**i18n:** existing namespace; the store list, the unranked note, the unknown-availability wording.
⚠ **Out of scope:** the SMS referral. The till can text a customer a map link; that is new outbound
messaging with its own consent design.

## Done when

In the running app the panel lists nearest-first stores with ATP, an unlocatable origin produces an
honestly unranked list rather than a plausible wrong one, and killing one of the two reads leaves the
other on screen.

## Blocked by

[185](185-search-row-expands-and-quotes-the-real-price.md)
