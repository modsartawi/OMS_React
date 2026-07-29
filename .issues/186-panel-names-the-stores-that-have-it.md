---
status: done
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

- [x] `stockView` — the three-way rendering: a count, *none at store*, and *we could not check*,
      with `available: false` producing the third and never the second · pure
- [x] `stockView` — `distanceKnown: false` orders by store code and marks the list unranked · pure
- [x] `stockView` — a row with a null `distanceKm` renders blank and is **never dropped** · pure
- [x] `item-panel-drive.mjs` extension — a stock outage leaves the price on screen and intact; the
      price refusing leaves the store list intact · flow (Playwright)

`stock-view.test.ts` **21 pure** · `tools/item-panel-drive.mjs` **73/73** (was 31/31) · typecheck,
three lint gates, **720 pure** and build all green.

⚠ **There is no capture for this read and there deliberately never will be one on a test host**
(BackOffice 876): §11's captures are round trips against live services, and this read's second hop is
a remote stock service the host cannot reach — the only scenario it could record is an outage, and
committing that would freeze an outage as the contract's shape. Both the pure corpus and the drive's
stock answers are stubs written to §3.5's documented shape, and the drive says so in its own header.

## What shipped

`StockElsewhereResult` + `StockElsewhereStore` (`core/models/callcenter.ts`) · `stockElsewhere` and
its **own** `stockElsewhereKey` (`api.ts`) · `stock-view.ts` (new) · `StockBlock` + `StoreRow` inside
`ItemPanel.tsx` · the `panel.stock` i18n block · the drive's second half.

🚩 **The independence is built, not promised.** `StockBlock` is a **sibling** of every price state,
not a child of the quoted one, with its own query, its own cache key and its own model — so a stock
outage leaves the price byte-identical on screen and a price refusal leaves the store list whole,
both asserted on the wire. Two separate calls is itself asserted, because if one read ever served
both, the independence would be a coincidence.

🚩 **The three-way answer is three STATES, not three sentences a component picks.** `unknown` and
`none` are separate arms and only `listed` carries rows, so *we could not check* cannot be drawn as
*nobody has it* by a branch that got its predicate backwards — and `available` **outranks the rows**:
a partial list from a hop that has just reported failure is a claim the server itself withdrew.

🚩 **Read-only is asserted as an absence**: the drive counts `button`/`a`/`input` inside the whole
stock block and requires **nought**. The store-change path is named in one sentence, which is the
whole of what rule 1 permits.

**Two review findings moved real code.** (1) `truncated` was trusted verbatim, so a server answer
carrying `withStock: 23` with `truncated: false` would have printed *23 stores with stock* above
three rows — a claim about twenty stores the agent cannot name, made by the console. It is now the
**one** field reconciled rather than read, and only in the direction that can harm: a count line may
never out-claim its own list. (2) the unranked fallback sorted with `localeCompare`, whose collation
of real mixed codes (`BZ01` beside `1102` — dev-estate rows, 876's discharged deployment obligation)
is locale-dependent; *by store code* has to mean one sequence everywhere, so it is an ordinal
compare. `StockRow` also dropped the wire's `address`: §3.5 rule 7 names a store by
`plant` + `city` + `areaName`, and like `PriceQuote` the view type earns its existence by dropping
something rather than restating the wire.

🚩 **185's inherited assertion was narrowed on purpose, and this is the owner nod.** *The panel holds
no figure at all* on a refused price is now read over the **price half** (`priceHalfText`, which cuts
`[data-cc-stock]` out first). This panel now has a second region whose figures are **availability** —
an ATP count and a kilometre — neither of them money and neither a place an estimate could be
written; the unchanged half of the rule (*the estimate appears nowhere in the panel*) is still
asserted over the whole panel, so nothing was given up.

⚠ **Two accepted judgement calls.** The stock hop fires on **every** expand, not only when the
order's store is short — neither the ticket nor §3.5 gates it, and gating on the row's own `atp`
would make the agent's *who else has it* depend on a number the panel exists to go beyond. And
`refusalOf` is a second copy of the price half's shape rather than a shared helper: §3.4's five codes
and §3.5's three are contract sections that version independently, and one sentence per code per
section is what stops a stock refusal borrowing a price refusal's wording. A third read is the moment
to extract.

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
