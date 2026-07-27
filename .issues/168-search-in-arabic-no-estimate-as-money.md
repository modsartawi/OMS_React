---
status: open
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

- [ ] `availabilityHasThreeStatesAndUnknownIsNotZero` — pure: a positive count, zero, and `null` map
      to three distinct classifications with distinct words; nothing collapses `null` onto zero · pure
- [ ] `theRowNeverPutsAnEstimateInTheMoneyColumn` — pure: the row view model places the estimate on
      the meta line and exposes **no money-formatted figure** — the estimate carries `≈` and no
      currency word, so a caller cannot render it as money by accident · pure
- [ ] `searchingInArabicFindsAndAddsAnItem` — drive: an Arabic query returns rows carrying Arabic
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
