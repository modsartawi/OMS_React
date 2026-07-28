---
type: wayfinder-ticket
wayfinder: grilling
map: 126
status: done
blocked-by: —
---

# 157 — Price check: what an item costs, without adding it

## Question

**Owner-added scope, 2026-07-27 — ruled into phase 1.** An agent needs to answer *"how much is X?"*
mid-call without putting X in the basket. Today this is a **till** feature, not a call-center one:
`ItemInfoLookupController` renders `UnitPrice` + `Stock` columns and is constructed in exactly one
place — `POSController.cs:16403`. Neither CC1 nor CC2 reaches it. So this is **new**, not a port.

🚩 **The whole difficulty is [131](131-item-search-endpoint.md)'s note 9, made worse.** The item
search row carries `estimatePriceExVat` — an ex-VAT estimate off the material master, which reads
**~13% under** what the caller pays (`MWST` is a separate 15% condition). That is tolerable on a
search row because the agent is *choosing* an item. It is **not** tolerable here: a price check
exists to be **read out loud**, and an under-quote said aloud is the exact harm 135 amendment 1 was
written to prevent — this time with no basket line beside it to contradict it.

So the question is not "where does the button go", it is **what number a price check may return**:

- **Engine truth or estimate?** A real answer means pricing the item at the order's plant — which is
  what the engine does when you add it. Is there a price-without-add path (a throwaway simulation, a
  `Pricing/Simulate` call, a condition read), and what does it cost under resume-per-request?
  [130](130-potential-bby-prerequisites.md) found `BuildSimulationResult` projects a live transaction
  with no re-price; establish whether an equivalent exists for an item *not* in the basket.
- **VAT-inclusive, always.** Whatever the source, the answer the agent reads must be what the caller
  pays. If only an ex-VAT figure is reachable, the honest surface must say so in words — and per 135
  amendment 1, a figure that is not engine money may not be formatted as money.
- **Does a price check see promotions?** *"How much is X"* has a different answer when X's second
  piece is 70% off. A number that ignores the offer the console is simultaneously advertising
  ([138](138-near-miss-guidance-design.md)) is a contradiction on one screen.
- **Plant-dependency.** The price is the *order's* plant's price. Before a store is bound (154's
  pickup case, or an unattached caller) there may be no plant to price at — say so rather than
  quoting the national price, which is the silent-wrong-price failure 129 found in `ResumeAsync`.
- **Where it lives** in 135's three columns, and whether it is the same surface as
  [158](158-stock-in-other-stores.md) — both are "tell me about this item" and both come off the
  same till controller.

Deliverable: the ruling on the number, the console surface, and any BackOffice contract it needs.

## Answer

**The number is engine truth, and the engine already knows how to give it without a transaction.**
Contract **v1.6 §3.4**, additive; server work minted as BackOffice
[875](C:\Work\DMSCO\BackOffice\.issues\875-cc-price-check-endpoint.md).

### The finding that settled it

The ticket was written expecting the hard part to be *"is there a price-without-add path at all, and
what does it cost under resume-per-request?"* There is, it ships today, and it costs **nothing** on
the concurrency axis. `SimulationService.Simulate`
(`Pricing/SIS.Pricing.Services/Simulation/SimulationService.cs:15`) builds a throwaway
`PricingContext` named `SIM_<guid>`, runs `CalculateAllItems` + `CalculateBonusBuy`, projects
`BuildSimulationResult` and calls `session.RemoveContext`. No `TryClaimAsync`, no `ResumeAsync`, no
`SaveAsync`, no persistence, no transaction of any kind.

That gives the price check a property nothing else on this map has: **it cannot collide with the
agent's own basket.** Every other verb serialises behind 127's 15-second strict claim; this one is a
pure read, so *"how much is that?"* never pauses order entry. The question the ticket feared —
*"what does it cost under resume-per-request"* — turns out not to apply.

And it is real money. `PricingEnrichmentService.EnrichItem` overwrites `TaxClassificationMaterial`
from the material master (`Services/PricingEnrichmentService.cs:70-74`), so `MWST` determines
properly and the result carries VAT. **The ex-VAT estimate never has to be the thing an agent reads
out loud** — which was the whole anxiety of the ticket.

### The rulings

| | |
|---|---|
| **The number** | Engine truth, item alone at **qty 1**, priced at the order's own plant / origin / customer / loyalty. VAT-inclusive, therefore §2.1 money, therefore `SAR` in a money column. `unitPrice.gross` **must equal the basket line's** for the same item under the same header — that equality is the ticket |
| **Promotions** | The number **and** the offers on that item, in 138's promise language: definition, `progress`, `isReady`. No `wouldSave`, and no figure formatted as money anywhere in the region. A price quoted beside a strip advertising an offer the price ignores is a contradiction on one screen |
| **The surface** | The deliberate expansion of a **search row** — one *"about this item"* panel, shared with [158](158-stock-in-other-stores.md). The agent already types the item into 131's search; this answers the question in the act they are already performing, and it puts truth exactly where the estimate bites. One engine call per expand, never per keystroke |
| **No plant yet** | **Refused**, on `canAddItem`'s own predicate, projected as `capabilities.canPriceCheck`. Quoting at a store nobody chose is [797](C:\Work\DMSCO\BackOffice\.issues\797-resume-drops-pcheader-plant.md)'s silent wrong price said out loud |
| **Quantity** | Always one unit. Quantity-scaled conditions and tier offers that only bite higher up are deliberately invisible rather than paying a second control on a panel opened mid-call |
| **The estimate** | Stays exactly where [168](168-search-in-arabic-no-estimate-as-money.md) put it — the `≈` on every row's meta line. Truth lives in the panel. No row ever changes shape mid-list, and the two numbers never swap places |

### 🚩 Two findings, both about what the client may be trusted with

**1. `Pricing/Simulate` must not be reused — the route *or* its body.** The obvious build is "point
the console at the endpoint that already exists". Both halves of that are wrong:

- The route is grant-gated on `BackOfficeScreen[PosSimulation,03]`
  (`SIS.Api/Endpoints/Logistics/PricingEndpoints.cs:55-59`) — the pricing-analysis screen's grant. No
  call-center agent holds it, and giving it to them admits them to a different screen entirely.
- The **body is a price-affecting input**. `SimulateRequest.ManualConditions` maps straight to
  `ConditionOriginConstants.Manual` (`SimulationService.cs:32-58`), and `EnrichHeader` fills
  `SalesOrganization` / `DistributionChannel` / `DepartureCountry` **only when empty** — a
  caller-supplied value wins (`PricingEnrichmentService.cs:25-42`). Exposing that to the console
  hands an agent precisely the power map note 4 removed, on **the one number that gets spoken aloud**
  and that the caller has no way to check. So: a sibling read on the `CallCenterWeb/*` door, the
  server composes the entire request from the order's own `PcHeader`, and the wire carries
  `transactionId` + `itemNumber` and nothing else. Map note 3 is enforced by the request having no
  other field.

**2. `EnrichItem` does not fill `MaterialGroup`, and `MaterialGroup` is a BBY grouping key.** This is
the one that would have shipped silently and only broken the offers half:

- `EnrichItem` fills description, `ACode`…`ECode`, `IsBatchManaged`, tax classification and UoM —
  and stops (`PricingEnrichmentService.cs:62-90`).
- `BbyModelExtensions.cs:137` yields `MaterialGroup` beside `ACode`/`BCode`/`CCode` when matching an
  item to a grouping.
- The engine's own scan path **does** set it — `PosTransaction.cs:6768` and `:4485`,
  `MaterialGroup = article.MaterialGroup`.

So a simulation that leaves it null loses a grouping key **the basket line has**: an offer keyed on
material group appears on the line and not on the price check. That is exactly the contradiction the
offers ruling exists to prevent, arriving through the back door. 875 reads it from the same article
source `ScanAsync` uses, and carries the regression test. The neighbouring fields are a non-problem
and worth recording so nobody re-derives it: `MaterialPricingGroup` and `MaterialCategory` are
declared on `PcItem` and **read nowhere** in `SIS.Pricing.Core` or `SIS.Pos`; `DeductibleGroup` is
insurance-only and out of the CLCN cut.

⚠ The same blind spot exists on the POS Simulation screen's own use of `Pricing/Simulate`. Named in
875's Out of scope — it is that screen's question, not this map's.

### What ships blind, and says so

`offersComplete: false` while [787](C:\Work\DMSCO\BackOffice\.issues\787-web-cc-promotion-guidance-engine.md)-C
is outstanding. A one-item pricing run of a *"buy X get Y"* whose X is the priced item never loads
the promotion at all — [130](130-potential-bby-prerequisites.md)'s discovery blocker, inherited whole
and unavoidably, because a price check is by construction the one-item case. Owner ruling: ship it
with the flag, so the panel says *offers were not fully checked* rather than letting silence read as
*no offer exists*. It flips to `true` when 787-C lands, with **no client change**.

### Consequences for other tickets

- **[158](158-stock-in-other-stores.md) now shares a surface it did not have.** The *"about this
  item"* panel is one panel; 158 keeps its own read, its own contract question and — critically — its
  own **read-only vs rebind-entry** ruling, which this ticket does not pre-judge. Noted on 158.
- **Nothing on the console may derive this number.** Same rule as
  [156](156-delivery-fee-shared-rule.md)'s `waivedReason`: a client that computes VAT onto
  `estimatePriceExVat` to fake a price check has recomputed a server rule and will be wrong the first
  time a condition other than `MWST` applies.

🚩 **The pattern worth keeping.** The ticket's own framing — *"the whole difficulty is 131's note 9,
made worse"* — pointed at the estimate as the problem to solve. The estimate was never the problem;
it was the only answer anybody had looked for. The engine had a truthful, cheaper, lock-free answer
sitting in a route the map had already used for a different screen. Reading what the adjacent screen
already calls, before designing what this one needs, is what turned a hard ruling into a small one.
[156](156-delivery-fee-shared-rule.md) recorded the same pattern two tickets ago.
