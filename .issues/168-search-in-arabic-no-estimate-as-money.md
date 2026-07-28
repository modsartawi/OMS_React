---
status: done
spec: 160
blocked-by: 162
---

# 168 — searchingFindsItemsInArabicAndNeverQuotesAnEstimateAsMoney

## What to build

The box the agent types into while talking. `itemSearch` matches **part of a name in English or
Arabic** (`Description2` — WPF never searched it at all) or an item-number prefix; barcode is out.
Results are capped with a `truncated` flag and **no paging** — an agent retypes rather than pages.
Every row is addable in one action, because the server already filtered to what CC1's whitelist
allows the agent to sell.

Two ruled properties are this slice's real work:

🚩 **The estimate never enters the money column.** The row price is `Item.UnitPrice` — a
material-master column served as an **ex-VAT estimate**, and because VAT is a separate 15% condition
it reads **~13% under** the basket line beside it. An agent who quotes it raw under-quotes, mid-call,
out loud. So ([135](135-agent-console-prototype.md) amendment 1) it renders on the item's **second
line beside the item number**, where a price never otherwise appears, with `≈`, in the muted
register, and **no currency word** — `SAR` is reserved for engine money. The row's end edge carries
availability and *Add* only, and the panel keeps a standing header saying catalogue prices are
estimates and the basket price is what the caller pays.

**Availability renders three ways, and `unknown` is not `zero`** — a count, *none at store*, and
*? stock unknown* — differing in **ground, ink and wording**, because they are opposite decisions for
the agent. A degraded stock read is `atp: null` and never a non-200.

## Spine reach

api (`ItemSearch`, `AddItem`) · logic (pure availability classification; the search row's view model)
· component (search panel, result rows, add action) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [x] `availabilityHasThreeStatesAndUnknownIsNotZero` — pure: a positive count, zero, and `null` map
      to three distinct classifications with distinct words; nothing collapses `null` onto zero · pure
- [x] `theRowNeverPutsAnEstimateInTheMoneyColumn` — pure: the row view model places the estimate on
      the meta line and exposes **no money-formatted figure** — the estimate carries `≈` and no
      currency word, so a caller cannot render it as money by accident · pure
- [x] `searchingInArabicFindsAndAddsAnItem` — drive: an Arabic query returns rows carrying Arabic
      names, the estimate renders on the second line (never the end edge), all three availability
      states are visibly different, and *Add* puts the item in the basket · flow (Playwright, extends
      `tools/callcenter-drive.mjs`)

## Boundaries

**Endpoints:** `GET CallCenterWeb/ItemSearch` (BackOffice
[799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md)), `POST CallCenterWeb/AddItem`.
Codes: `ITEM_NOT_SELLABLE`, `ITEM_NOT_FOUND`, `NO_PRICE_AT_PLANT`, `QTY_INVALID`. The Arabic run is
wrapped with the **`dir`-pinned** bidi isolate — `@/core/ui/Ltr` already is `<bdi dir="ltr">`, which
is exactly 138's ruling; a bare `<bdi>` implies `dir="auto"` and flips the block. ⚠ **Adding beyond
availability** takes the confirm path, which is [169](169-below-availability-accepted.md)'s — this
slice covers the in-stock add only. Price check ([157](157-price-check.md)) and stock in other stores
([158](158-stock-in-other-stores.md)) are **out of scope**.

## Done when

An agent finds an item by typing part of its Arabic name, sees availability that cannot be misread
and an estimate that cannot be misquoted, and adds it to the basket in one action.

## Blocked by

[162](162-console-opens-an-order.md) — the search reads at the order's plant, so an order must exist.

## Built

`item-search.ts` is the pure module and it is where both rulings live, because both
are properties of the ROW and not of the panel:

- 🚩 **The estimate cannot enter the money column, structurally.** `SearchRowView` is
  four fields — `itemNumber`, `title`, `meta[]`, `availability` — and there is no
  money-column field to assign. The estimate is a `MetaPart` beside the item number,
  composed with `≈` and no currency word; an absent one is **dropped rather than
  drawn as `≈0.00`**, since a nought price on a row an agent quotes from is worse
  than no price. The drive proves it spatially rather than by class name: the
  estimate's box ends 400 px before the availability pill starts, it sits on the
  row's second line, and the end edge holds no `\d+\.\d{2}` at all.
- 🚩 **`availabilityOf` returns three classifications carrying `labelKey` AND
  `tone` separately**, so ground, ink and wording differ by construction — one
  `tone` would let a later edit distinguish them by colour alone, which is what
  135 ruled out. `null`, an absent field and a negative count are all answered
  honestly (unknown, unknown, none); nothing collapses onto zero.

The panel keeps the **standing** note above the input rather than as the results
box's caption (US28): a rule that arrives with the rows is read after the agent is
already looking at prices. Search is held until the term would be accepted
(`MIN_QUERY_LENGTH`, 3 — 799 answers 400 below it), settles for 250 ms, and is
keyed by **order + term**: the same words on a different order are a different
question, and a key without the order would answer this one with the previous
one's stock. `truncated` gets *narrow your search*, never a pager. The Arabic run
rides the meta line inside the **`dir`-pinned** isolate (138) — measured: the name
stays at the start edge instead of flipping the block.

`addItem` sends an item number and a quantity and **never a price** (law 1,
asserted on the wire), on a `requestId` minted once outside `runGuarded` so a busy
retry cannot become a second add of a real item.

⚠ **For [169](169-below-availability-accepted.md):** a `pendingConfirmation:
belowAtp` currently draws one sentence under the search box (`search.addBeyondAvailability`)
— the honest outcome of an add that did not land, standing in for the acceptance
sheet. 169 replaces it with the modal and should delete the key.

Proof: 17 pure (`item-search.test.ts`) + `callcenter-drive` 301/301; `typecheck`,
`lint` (3 gates), `build`, 421 unit tests green.

## Comments

**2026-07-28 — owner gap review #2: the panel could be typed into but not put away.**

Owner, driving the built console: *"after the products appear I can add an item but there is no x
button or the combo not disappear — I should delete the content from the text input so the
list/combobox disappears."* Both halves were real, and both were structural rather than cosmetic:

- The input had **no clear affordance at all** — no button, no `Escape`. Emptying it by hand was the
  only exit, and even that left the rows standing for the 250 ms settle.
- **A landed add did not put the question away.** The rows are gated on the settled term alone, so
  the results of a question the agent had finished asking stayed on screen over the basket line that
  had just appeared — on the console's most-pressed control, at call pace.

Fixed here rather than ticketed. Three things, and the third is the one with a rule in it:

1. A clear button at the input's end edge, from the **first** character rather than from the third
   (a one- or two-character term draws no rows but is still text in the way). It sets `term` as well
   as `query`, so the rows go at once instead of after the settle. Padding is reserved whether or not
   the button is there — a padding that appeared with the button would shift the text under the caret
   mid-word.
2. `Escape` **on the box only**, never a document listener: a modal is the one thing on this console
   that outranks the search, and a global handler would eat the key that closes it.
3. 🚩 **The panel clears on a *landing*, not on a success.** The page counts adds that actually
   reached the basket and the panel watches that counter. A below-availability **ask** carries the
   unchanged state (§5.2) — nothing was added — so the rows stay in front of the agent who is about
   to accept, and the guidance strip's scoped hand-off (172) survives untouched. Cleared, the caret
   stays in the box for the next item.

Proof: 15 checks in a focused drive over the four claims (X clears and refocuses, `Escape` clears,
a landing dismisses and empties, an ask does **not**), no page errors; all three lint gates green.
⚠ **`typecheck` and `vitest` could not be run against it** — the tree's fixture corpus was mid-revision
and both were already red before this change; the repo's own `callcenter-drive.mjs` could not load for
the same reason, which is why the drive here was a standalone one. See
[177](177-v1.2-captures-land-on-the-client.md).
