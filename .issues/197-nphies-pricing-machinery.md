---
type: wayfinder-ticket
wayfinder: research
map: 196
status: done
blocked-by: —
---

# 197 — What pricing and deductible machinery already exists server-side

## Question

An authorization line sent to NPHIES is not a bare item number and quantity. `NphiesAuthItemRequest`
(built at `NphiesAuthRequestController.cs:1921`) carries: `UnitPrice`, `Quantity`, `ExtendedPrice`,
`Amount`, `NetAmount`, `Vat`, `DiscountPercentage`, `DiscountAmount`, `Factor`, `MaxCoverage`,
`ActualPatientShare`, `DeductibleG`, `DeductibleGroupName`, `DaysSupply`, `SelectionReason`. The
header additionally carries three deductible buckets — `DeductibleG1/G2/G3` plus their `Max` and
`Paid` companions (generic / brand / non-medical).

In WPF every one of those comes free, because the line **is** a POS transaction line: the pricing
engine has already applied conditions and VAT, and `NphiesDeductibleManager.UpdateDeductible` has
bucketed the copay off the eligibility coverage. The web has decided on a **standalone item picker**
— so none of it comes free.

**This ticket does not decide anything.** It establishes what already exists, so the decision that
follows is made against facts rather than guesses. Find out:

1. **What does SIS.Api already expose for pricing?** Is there an endpoint that, given an item number,
   quantity and a customer/payer, returns unit price, extended price, VAT and any discount
   conditions? The call-centre order work on `main` prices a basket — find how, and whether that
   path is reusable outside an order. Start from `src/features/callcenter/` and the SIS.Api
   endpoints it calls.
2. **What is `NphiesDeductibleManager` actually doing?**
   `C:\Work\DMSCO\BackOffice\Sartawi.POS\Nphies\Eligibility\NphiesDeductibleManager.cs` (174 lines).
   Record the algorithm: which coverage fields feed which bucket, how `Category == "66"` (generic)
   and `"57"` (brand) and the `TableOfBenefits` `copaypct`/`copay`/`maxcopay` codes map onto
   `InsuranceGenericDeductible`, `InsuranceBrandDeductible`, `InsuranceNonMedDeductible`. Cross-read
   `NphiesAuthRequestController.FillCoverage()` (line 865), which does part of the same job inline.
   Note whether the algorithm is pure (coverage in, numbers out) or reaches into POS state.
3. **Does the Nphies backend itself price?** The service at `172.23.27.40:8065` already receives
   fully-priced lines, so probably not — but check whether `Auth/Auth` tolerates or recomputes
   anything, and whether `core/*` carries item or price data. Evidence only; do not assume.
4. **Does the Nphies backend validate the money it is sent?** If it rejects inconsistent totals,
   that constrains every option downstream.
5. **What is `NItemFinder`** (`NItem\NItemFinder.cs`, 73 lines) resolving, and does the web picker
   need the same resolution (item number + `Code1` + `Code2`)?

Write findings as a linked asset under `.issues/assets/196-nphies/`. The output this map needs is a
plain statement of **which of the fifteen line fields can be obtained today without new server work,
which need a new endpoint, and which have no known source at all.**

## Answer

Findings, with a `file:line` behind every claim:
[pricing-machinery-research.md](assets/196-nphies/pricing-machinery-research.md).

**The headline: the money is not WPF's, it is the SIS.Pricing engine's — and the engine's insurance
pass is already reachable over HTTP, request *and* response.** `POST Pricing/Simulate`
(`SIS.Api/Endpoints/Logistics/PricingEndpoints.cs:55`) accepts `IsDeductibleApplicable`, a
`Deductibles` group dictionary, and per-item `DeductibleGroup` / `InsuranceItemCategory` /
`MaxPayerShare` (`SimulateModels.cs:33,38,57-60`); `SimulationResultItem` returns
`CalculatedDeductible`, `DeductibleValue`, `PatientShare`, `MaxPayerShare`
(`SimulationResultItem.cs:21-24`) — the exact engine fields WPF transcribes onto the Nphies line
(`ItemLineViewModel.cs:1092-1094`). So this is a **contract-and-grant question, not an engine
question**. The one insurance-shaped gap is header-level: `PricingEndpoints.cs:124` nulls
`InsuranceSummary` on the way out; the per-line fields survive.

**Classification of the fifteen line fields — (a) 5 · (b) 10 · (c) 0.** Nothing has no known source.

- **(a) free today:** `Quantity`, `ExtendedPrice`, `Amount`, `NetAmount`, `DaysSupply`; header
  `DeductibleG1/G2/G3Paid` (always 0 on a fresh auth) and `PolicyStart/EndDate`. `MaxCoverage`
  lands here as an *optional operator input defaulting to 0* — on a freshly raised authorization
  WPF has no automatic source for it either.
- **(b) needs a server change:** `UnitPrice`, `Vat`, `DiscountPercentage`, `DiscountAmount`,
  `Factor`, `ActualPatientShare`, `DeductibleG`, `DeductibleGroupName`, `SelectionReason`; header
  `DeductibleG1/G2/G3` + their `Max`.
- **(c) no known source:** none.

Nine of the ten (b) fields collapse into **two** server changes: an insurance-capable pricing call
the Nphies screen may make, and `InsuranceItemCategory` projected onto the item picker's response
(already loaded at `ArticleLookupService.cs:88`).

**`NphiesDeductibleManager` has two overloads and the second is already pure.**
`UpdateDeductible(coverage, NphiesAuthRequest)` (`:103-171`) is coverage in, buckets out — no
`POSCommon`, no controller, no I/O. The POSController overload (`:16-101`) is the impure one, and
its extra work is unrelated to deductibles (a hard-coded `SubscriberId`→CustomerType switch at
`:18-23`, a BUPA "Elite" promotion at `:57-68`). Lifting the pure one server-side is a **move, not a
rewrite**, and it collapses three near-identical copies of the algorithm — `FillCoverage()`
(`NphiesAuthRequestController.cs:865-942`) is the third — into one. A latent bug rides in all three:
a stray semicolon terminates the brand `CopayMaximum` parse (`:45-46`, `:125-126`, `:892-893`).

**The call-centre price-check path is not reusable**, for three explicit reasons: it requires an open
engine transaction (`CallCenterPriceCheckService.cs:70`), is hard-wired to quantity 1
(`CallCenterPriceCheckPricer.cs:102`), and sets `IsDeductibleApplicable = false` with a comment
saying a call-centre order is never an insurance document (`:198-200`). `Pricing/Simulate` is the
reusable door, and oms-react already calls it (`features/pricing/simulation/api.ts:31`) — though its
web model carries no deductible fields yet.

**`NItemFinder`** is a response→SKU resolver used **only on the dispense path**; `Code1`/`Code2`
never appear on the request side. A web picker needs no equivalent in v1.

**Q3/Q4 — does the Nphies service price, or validate the money it is sent?** No evidence in either
direction, and the client could not tell if it did: `NphiesService.cs:499-504` collapses every
non-2xx into one bare `Exception`. This is now [206](206-nphies-does-the-service-check-the-money.md).
