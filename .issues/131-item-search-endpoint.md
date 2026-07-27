---
type: wayfinder-ticket
wayfinder: task
map: 126
status: done
blocked-by: —
---

# 131 — The item search the agent actually types into (owner supplies the SQL)

## Question

**HITL — this ticket starts by the owner handing over the raw SQL.** Agents do not scan; they
search by description while the customer talks. Note 9: results carry catalogue + ATP + **price on
every row**.

Facts established while charting:

- **SIS.Api has no item-search endpoint.** `Endpoints/` holds `Stock`, `Sd`, `CallCenter`, `Loy`,
  `Gs1` and no item/material search. This is net-new.
- The WPF equivalent filters a **client-side item collection** by description, then `FillStock`
  batches `StockV2Service.GetCurrentStock(itemNumbers, [POSCommon.StockStore])` over the visible
  rows — gated `if (!POSCommon.POSMachine.CallCenter) return;`. Stock-on-search-results is already
  a call-center-only behaviour; it is just trapped in a WPF window.

To settle:

- **The query.** Owner-supplied SQL is the starting point; the endpoint is built around it rather
  than a guessed one.
- **Search axes.** Description (Arabic *and* English), item number, barcode. Prefix, contains, or
  token matching — and whether a `LIKE '%…%'` over the full material master holds up at
  call-center pace or needs an index. State a latency target.
- **Price semantics.** A row price is a **store list price at the order's plant**, not the
  basket-aware promoted price. Decide where it comes from (the price-inquiry path,
  `PosPriceInquiryService`, or the query itself) and how the UI must label it so an agent never
  quotes a number that changes on add.
- **ATP annotation** at the order's store, and behaviour when the stock service is down (Note 8:
  degrade to unknown, never fail the search).
- **Assortment and eligibility filtering** — blocked, inactive, controlled, or not-sold-at-this-store
  items. Does the agent see them greyed, or not at all?
- **Paging** and what a result row must carry for the basket to add it in one click.

Deliverable: the endpoint contract, minted as a BackOffice issue (Note 14).

## Answer

**The contract is minted as BackOffice
[799](C:\Work\DMSCO\BackOffice\.issues\799-cc-item-search-endpoint.md).** Owner supplied the base
query and ruled the three behaviours that the query alone did not settle (VAT, eligibility, search
axes). Everything below is the reasoning; 799 is the buildable form.

### The endpoint

`GET CallCenter/ItemSearch?term=&plant=&take=` — behind the web call-center door
[137](137-callcenter-web-door.md), not `ApiKeyEndpointFilter`. Scoped under `CallCenter/` rather
than a generic `Item/` because ATP-on-search-results is a call-center-only behaviour today (the WPF
`FillStock` gate below), and it keeps the blast radius to the door 137 already opens.

### The query — owner-supplied, plus three added predicates

```sql
SELECT ItemNumber AS MaterialNumber, Description AS DescriptionEn, Description2 AS DescriptionAr,
       UnitPrice AS EstimatePrice, SalesCategory1 AS OtcList, SalesCategory2 AS Brand,
       SalesCategory3, SalesCategory4 AS MaterialType, SalesCategory5 AS MaterialStatus,
       SalesCategory6 AS MaterialGroup
FROM  Item
WHERE (ItemType = 0)
```

It goes to the same `Item` master the WPF lookup uses — no SAP-side view, nothing plant-scoped. Its
value is the **projection**: it names six `SalesCategory` columns that were anonymous, and one of
them turns out to be load-bearing (below).

🚩 **`Client` is missing and must be added.** `Item`'s key is composite `(Client, ItemNumber)`
(`Sartawi.Repository\Inventory.Data\IV\Mapping\Item.hbm.xml`). Every existing call gets `Client`
implicitly from the NHibernate session; a raw Dapper endpoint does not, and without it the result
set is wrong. This is the kind of defect that only shows up in a multi-client environment, i.e. not
on a dev box.

### Search axes — description (En + Ar) + item number 〔owner ruling〕

Token-AND: split the term on whitespace, every token must appear in `Description` **or**
`Description2`; a wholly-numeric term additionally matches `ItemNumber` by prefix. Barcode is
deliberately out — it is a scan key, not something an agent types, and the join to the `Barcodes`
set duplicates rows per barcode.

Worth recording what this fixes: **the WPF search never looked at `Description2` at all**
(`ItemLookupController.cs:54-57` matches `Description` only, via `StartsWith(Text)` AND
`Contains(Text2)`). Arabic description search is new, not a port — and for an Arabic-speaking call
center that is a substantive gap being closed, not a nicety.

### Eligibility — CC1's own whitelist 〔owner ruling〕

The charting question asked whether ineligible items are greyed or hidden. Answer: **hidden**, using
the whitelist CC1 already applies at `POSOrderController.cs:336-343`:

```
SalesCategory5 IN ('AVAILABLE','TEMPORARY','NON AVAILABLE','DIRECT & WAREHOUSE','non performing items')
```

Excluded: `DISCONTINUED`, `Under Processing`, and bare `DIRECT` (which `POSOrderController` treats
as its own order type at `:367-372`). The agent never sees a row they cannot add — no dead ends
mid-call.

🚩 **The WPF item lookup applies none of this.** Its only filter is `ItemType == 0`; it does not even
read `Item.IsBlocked`, which exists. So the WPF search can and does surface items an order will then
refuse. Filtering is an upgrade over WPF, not a port of it.

⚠ The values are **free-text with inconsistent casing** (`'non performing items'` lowercase, the rest
upper) — there is no lookup table. Match case-insensitively.

`MaterialStatus` still ships on every row, so the console can say *why* a row is what it is.

### Price — ex-VAT estimate, labelled, not grossed up 〔owner ruling〕

**This amends map note 9.** The note said a row price is "a store list price at the order's plant".
It is not, and the owner has ruled it should not become one: the column is `Item.UnitPrice`, a
**material-master** column — not plant-scoped, not engine-priced — and it is an estimate "just to
give the agent an idea", **before VAT**.

🚩 The reason this needs a hard label rather than a soft one: **`MWST` is a separate condition (class
`T`, 15%) applied on top of the `VKP0`/`ZVKP` net** —
`SIS.Pricing.Tests\Pos\CcQuoteParityHarnessTests.cs:413` calls "VKP0 base price + MWST" the true CC
pricing path. The basket line the agent reads to the customer is therefore VAT-inclusive while the
search row is not, so **a search row sits ~13% below what the customer actually pays** and the
failure mode of quoting it raw is *under*-quoting. The wire field is named `estimatePriceExVat` so
the omission cannot be silent, and the console must carry the label — this lands on
[135](135-agent-console-prototype.md).

Grossing up server-side was offered and declined. One good consequence: `POSCommon.VatRate(date)` is
WPF-only, the same problem class as the delivery-fee rule
[133](133-submission-path-server-side.md) flagged — and under the ex-VAT ruling this path **never
needs it**, so that shared-code risk does not arise here.

Note also that WPF has *always* shown this same `Item.UnitPrice`, so CC agents have been quoting a
national ex-VAT estimate all along. This is the first time it gets labelled honestly.

### ATP — no new endpoint, server-side, degrades to unknown

`GET Stock/ItemPlant?itemNumbers=…&plants=…` **already exists**
(`Services\SIS.Api\Endpoints\Stock\StockEndpoints.cs:28`) and resolves through
`StockService.GetStockByItemsPlant` → `stockHttpService.GetCurrentStock` → `AtpQuantity` — the *same*
underlying read the WPF `StockV2Service.GetCurrentStock` performs. So the ticket's ATP question needs
no new contract at all; it rides on door 137 with the search.

Folded in **server-side** for the result page at the **order's** plant (`PcHeader.Plant`, bound at
open per note 6 — *not* the agent's switcher store), so the client makes one round trip and the
degrade rule lives in one place. It is a remote HTTP hop, so it is never joined into the SQL. On
failure every row returns `atp: null` with `atpAvailable: false` and the search still returns `200`
— note 8's rule, preserving 287's. `null` means *unknown* and must render differently from `0`.

This is also where [130](130-potential-bby-prerequisites.md)'s "ATP filtering ruled into SIS.Api
beside 131's read" lands concretely: same helper, same plant, same degrade rule.

### Paging — there is none, by design

An agent scanning results at call pace retypes; they do not page. Keyset paging over a
relevance-ordered set is unstable under re-ranking anyway. So: `take` default 50, hard cap 200 (the
WPF cap), plus a `truncated` flag whose console affordance is "narrow your search".

### Row shape for one-click add

`materialNumber` is the whole requirement — the client sends `{itemNumber, qty}` and never a price
(note 3). Everything else on the row is display: both descriptions, `estimatePriceExVat`, `atp`, and
the six facets.

`SalesCategory3` came through the owner's SQL **unaliased**. It passes through under its raw name;
nobody should invent one.

### 🚩 Left open deliberately: the latency of a non-sargable match

`LIKE '%…%'` cannot use an index, so a token-AND over two description columns is a scan of `Item` per
request. WPF partly escaped this because its *first* box was a sargable `StartsWith` and only the
second was `Contains`.

Nobody has measured it and this session could not — it needs production-sized data. 799 carries it as
a build obligation: measure p95 for a 3-char and a 2-token term, target **≤ 500 ms** (the agent is
typing while a customer waits), and fall back to a SQL Server full-text index — which also tokenizes
Arabic better than `LIKE` — only if the measurement misses. Deliberately not pre-solved.

This is a **second, independent latency surface** on the same screen as the map's existing open
question, which is about the resume-per-request round trip. Both are recorded there.
