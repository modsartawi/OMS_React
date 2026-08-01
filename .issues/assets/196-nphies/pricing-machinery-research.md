# 197 — What pricing and deductible machinery already exists server-side

Research asset for map [196](../../196-nphies-to-web-map.md), ticket
[197](../../197-nphies-pricing-machinery.md). Every claim carries a `file:line`. Where nothing was
found, this file says **no evidence found** rather than inferring.

Sources read: `C:\Work\DMSCO\BackOffice\Sartawi.POS\Nphies\*`,
`C:\Work\DMSCO\BackOffice\Pricing\*`, `C:\Work\DMSCO\BackOffice\Services\SIS.Api\*`,
`C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\Pos\Services\CallCenter\*`,
`C:\Playground\oms-react\src\features\*`.

---

## The headline

**The money on an authorization line is not WPF's. It is the SIS.Pricing engine's, and the engine's
insurance pass is already reachable over HTTP.**

`POST Pricing/Simulate` (`C:\Work\DMSCO\BackOffice\Services\SIS.Api\Endpoints\Logistics\PricingEndpoints.cs:55`)
takes a request whose header carries `IsDeductibleApplicable` and a
`Dictionary<string, SimulateDeductibleDto> Deductibles` (`{ Percentage, Max }` per group), and whose
items carry `DeductibleGroup`, `InsuranceItemCategory` and `MaxPayerShare`
(`C:\Work\DMSCO\BackOffice\Pricing\SIS.Pricing.Services\Simulation\SimulateModels.cs:33`, `:38`,
`:41-45`, `:57-60`). Those are mapped straight onto the engine's `PcHeader` / `PcItem`
(`SimulationService.cs:119`, `:129`, `:131-146`, `:161-165`) and the engine runs its deductible pass
on them (`C:\Work\DMSCO\BackOffice\Pricing\Pricing.Core\Pricing\PricingCompleteCalculator.cs:123`
→ `PrepareDeductible()`, and `:265` → `CalculateDeductible()`).

The result already carries every per-line number the Nphies request needs:
`SimulationResultItem.NetPrice / NetValue / TaxValue / GrossValue / SalesDiscount /
PromotionDiscount / ReceivableValue / MaxPayerShare / PatientShare / CalculatedDeductible /
DeductibleValue`
(`C:\Work\DMSCO\BackOffice\Pricing\SIS.Pricing.Services\Simulation\Result\SimulationResultItem.cs:12-24`,
built at `Result\SimulationResultBuilder.cs:130-142`).

And those are exactly the engine fields WPF reads to fill the Nphies line. The mapping is one hop:

| Nphies line field | WPF reads | which was set from |
|---|---|---|
| `DeductibleG` | `detail.InsuranceDeductibleAmount` (`NphiesAuthRequestController.cs:1942`) | `Math.Abs(pcItem.CalculatedDeductible)` (`ItemLineViewModel.cs:1092`) |
| `ActualPatientShare` | `detail.InsuranceActualDeductibleAmount` (`:1936`) | `Math.Abs(pcItem.DeductibleValue)` (`ItemLineViewModel.cs:1093`) |
| `MaxCoverage` | `detail.InsuranceMaxCoverage` (`:1934`) | `pcItem.MaxPayerShare` (`ItemLineViewModel.cs:1094`) |

So the WPF client is a *transcriber* of engine output for the three insurance numbers, not their
author. "Rebuilding the POS pricing engine in the browser" (map, out-of-scope §) is not merely
undesirable — it is unnecessary.

**The one thing in the way:** `Pricing/Simulate`'s handler explicitly nulls the insurance summary
before returning — `result.InsuranceSummary = null;`
(`PricingEndpoints.cs:124`). The *per-item* deductible fields survive (they are on
`SimulationResultItem`, not on `InsuranceSummary`), so this is a header-level gap, not a line-level
one. See Q1 below.

---

## Q1 — What SIS.Api already exposes for pricing

### 1a. There are three distinct server-side pricing doors, and they are not interchangeable

| Route | Where | Needs an order? | Grant | Insurance-capable |
|---|---|---|---|---|
| `POST Pricing/Simulate` | `PricingEndpoints.cs:55` | **No** — header + items in the body | `BackOfficeScreen[PosSimulation,03]` via `PosSimulationGrantEndpointFilter` (`PricingEndpoints.cs:59`) | **Yes** (accepts `IsDeductibleApplicable` + `Deductibles` + `DeductibleGroup`) |
| `POST Pricing/Calculate` | `PricingEndpoints.cs:48` | No | API key only (`:50`) | Not investigated — legacy `PricingModel` shape |
| `GET CallCenterWeb/PriceCheck` | `CallCenterWebSessionEndpoints.cs:126`, `:385` | **Yes** — `transactionId` of an open engine session | `CallCenterGrantEndpointFilter` (`:438-443`) | **No, by construction** |

### 1b. How the call-centre order flow prices a basket

Two paths, and only one of them is a "price this item" question.

**Basket lines.** The console never sends a price. `addItem` sends `{ transactionId, requestId,
itemNumber, qty }` and gets the whole `SessionState` back with the money in it
(`C:\Playground\oms-react\src\features\callcenter\console\api.ts:641-649`, and the note at `:615-617`
— *"It sends an item number and a quantity, and never a price"*). Every mutating verb returns the
whole state; the pricing is the engine's, inside the session.

**Price check.** `GET CallCenterWeb/PriceCheck?transactionId=&itemNumber=` — and *nothing else*
(`api.ts:562-564`; server `CallCenterWebSessionEndpoints.cs:385-391`). The service resolves the
order, reads the article through the same `IArticleLookupService` the engine's own scan uses, and
runs a **throwaway, never-persisted pricing context**
(`C:\Work\DMSCO\BackOffice\Sartawi.Retail.Data\Modules\Pos\Services\CallCenter\CallCenterPriceCheckService.cs:61-102`;
pricer at `CallCenterPriceCheckPricer.cs:115-146`). It returns a `SimulationResult` — the same shape
`Pricing/Simulate` returns.

### 1c. Is that path reusable outside an order? **No.**

Three hard blocks, all deliberate:

1. **It requires an open engine transaction.** `PriceCheckAsync` starts with
   `_sessions.ResolveForPriceCheckAsync(caller, transactionId, ct)`
   (`CallCenterPriceCheckService.cs:70`). No transaction, no quote.
2. **Quantity is hard-coded to 1.** `public const decimal Quantity = 1m;`
   (`CallCenterPriceCheckPricer.cs:102`) — *"ALWAYS ONE UNIT … there is no quantity on the wire to
   make it anything else"*. The Nphies line needs an extended price at a real quantity.
3. **It is explicitly non-insurance.** `IsDeductibleApplicable = false` on the throwaway header, with
   the reason in the comment: *"A call-center order is never a deductible (insurance) document"*
   (`CallCenterPriceCheckPricer.cs:198-200`). The deductible pass therefore never runs on this route
   (`PricingCompleteCalculator.cs:123`, `:265` are both gated on that flag).

`Pricing/Simulate` **is** reusable outside an order — no transaction id, no session, no POS state,
a plain request body — and the web client already calls it
(`C:\Playground\oms-react\src\features\pricing\simulation\api.ts:31-33`). The web's own model of the
request/result, however, carries **no deductible fields at all**
(`C:\Playground\oms-react\src\core\models\simulation.ts` — a grep for `deductible|maxPayerShare|
patientShare` returns nothing; the money fields present are `netPrice`, `taxValue`, `salesDiscount`,
`receivableValue` at `:77`, `:81`, `:84`, `:127-132`). So the *server* is capable today; the *client
contract* is not, and the route's grant is the pricing-analysis screen's, not an insurance screen's.

**Server work implied by Q1: a route/grant decision plus a request+response contract that carries
the deductible fields the engine already accepts and already returns. Not an engine change.**

---

## Q2 — What `NphiesDeductibleManager` actually does

File: `C:\Work\DMSCO\BackOffice\Sartawi.POS\Nphies\Eligibility\NphiesDeductibleManager.cs` (174
lines). It holds **two overloads of `UpdateDeductible`, and they differ in exactly the way this
ticket cares about.**

### The algorithm (identical in both overloads)

Input is one `NphiesEligibilityCoverageResponse` — the coverage picked off an eligibility check. Its
two relevant collections are `Items` and `TableOfBenefits`
(`Sartawi.Retail.Data\Modules\Nphies\Services\Models\Eligibility\NphiesEligibilityCoverageResponse.cs:28-29`).

**Generic bucket (G1).** `coverage.Items.FirstOrDefault(c => c.Category == "66")` (`:27` / `:107`).
- `generic.CopayPercent`, with `"%"` and `"SAR"` stripped, `decimal.TryParse`d →
  `InsuranceGenericDeductible` / `request.DeductibleG1` (`:30-32` / `:110-112`).
- `generic.CopayMaximum`, same cleaning → `InsuranceGenericDeductibleMax` / `DeductibleG1Max`
  (`:33-35` / `:113-115`).

**Brand bucket (G2).** `coverage.Items.FirstOrDefault(c => c.Category == "57")` (`:39` / `:119`).
- `brand.CopayPercent` → `InsuranceBrandDeductible` / `DeductibleG2` (`:42-44` / `:122-124`).
- ⚠ **`brand.CopayMaximum` is parsed into a statement terminated by a stray semicolon** —
  `if (decimal.TryParse(brand.CopayMaximum…, out var brandMax)) ;` (`:45-46`, and identically
  `:125-126`). The `if` body is empty, so the parse result is *discarded as a branch* but `brandMax`
  still holds the parsed value (C# `out` assigns regardless). The net behaviour is "assign whatever
  parsed, or 0", i.e. the missing-max case is not distinguished from a zero max. This is present in
  **all three copies** of the code (see `FillCoverage` below) and is worth flagging as a latent bug
  rather than reproducing blindly.
- Then the one genuine rule in the whole file: `if (brandPercentage > 0 && brandMax == 0)
  brandMax = 9999m;` (`:48-51` / `:128-131`) — *a brand copay percentage with no stated ceiling
  means effectively no ceiling.*
- → `InsuranceBrandDeductibleMax` / `DeductibleG2Max` (`:53` / `:133`).

**Non-medical bucket (G3).** From `TableOfBenefits`, by `Code`, with a fallback chain (`:71-95` /
`:138-162`):
- `Code == "copaypct"` → `InsuranceNonMedDeductible` / `DeductibleG3` (`:73-77` / `:140-145`);
- **else** `Code == "copay"` → the same target (`:81-87` / `:147-153`). Note this is a *fallback*,
  not a second field: a flat `copay` amount is written into the same slot a *percentage* would
  occupy. Nothing downstream distinguishes them.
- `Code == "maxcopay"` → `InsuranceNonMedDeductibleMax` / `DeductibleG3Max` (`:89-93` / `:156-160`).

**Policy period.** `coverage.PeriodStart` / `PeriodEnd`, `.ParseDate()` →
`InsurancePolicyStartDate` / `EndDate` or `request.PolicyStartDate` / `PolicyEndDate`
(`:97-100` / `:164-167`).

### Purity — the answer that decides whether this can be lifted server-side

**Overload A, `UpdateDeductible(coverage, POSController controller)` (`:16-101`) — IMPURE.**
It writes into `controller.Model.*` and does two extra things that have nothing to do with
deductibles:
- it rewrites `controller.Model.CustomerType` from a **hard-coded `SubscriberId` switch** —
  `"32559700" => Sabic`, `"45140200" => Aramco` (`:18-23`);
- it looks for `Category == "13" && Term.ToLower() == "day"`, parses `Benefit`, and promotes the
  customer to `Elite` when the per-day benefit is ≥ 10 000 **and** `controller.Model.IsBupaCustomer()`
  (`:57-68`). That last predicate is a read of POS model state, so this overload is not a function of
  its coverage argument alone.

**Overload B, `UpdateDeductible(coverage, NphiesAuthRequest request)` (`:103-171`) — PURE.**
Coverage in, an `NphiesAuthRequest` with `DeductibleG1/G2/G3` + their `Max` + the policy dates out.
No `POSCommon`, no `POSController`, no `Model`, no static ambient state, no I/O. It does **not**
carry the `SubscriberId`→CustomerType switch or the Elite promotion.

**This is the finding that most changes the estimate.** The exact code that produces the header
deductible buckets a web-raised authorization needs is already a pure static function whose only
input is a DTO the eligibility response already carries. It compiles today inside
`Sartawi.Retail.Data`, which is the assembly SIS.Api already references. Lifting it server-side is a
move, not a rewrite. Its one caller is
`NphiesEligibilityController.cs:1338` — `NphiesDeductibleManager.UpdateDeductible(eligibility.SelectedCoverage, authRequest)`.

### Cross-read: `FillCoverage()` (`NphiesAuthRequestController.cs:865-942`)

It is **overload A's body, copy-pasted, minus the CustomerType and Elite branches**: same `"66"` /
`"57"` categories (`:874`, `:886`), same `%`/`SAR` stripping (`:877`, `:889`), the same stray-
semicolon `brandMax` parse (`:892-893`), the same `9999m` rule (`:895-898`), the same
`copaypct`→`copay` fallback and `maxcopay` (`:907-927`). It writes into
`POSCommon.CurrentPOSController.Model` (`:871`) and sets the controller's own `PolicyFrom`/`PolicyTo`
+ `PolicyReadOnly` (`:933-940`), and it **early-returns for Bahrain** (`:867-870`) — the one
behavioural difference from the manager.

So the algorithm exists in **three near-identical copies**. A server-side lift should collapse them
to one; that is a simplification, not extra work.

### The other half: how the buckets reach the engine

The buckets are *not* passed to Nphies-only. WPF also pushes them into the pricing engine as the
`Deductibles` dictionary, and that construction is the second thing worth lifting:
`BuildDeductibleGroupsFromModel()`
(`C:\Work\DMSCO\BackOffice\Sartawi.POS\NewPos\Deductible\POSController.NewPos.Deductible.cs:183-221`)
builds `G1 = {Generic%, GenericMax − GenericPaidOutside}`, `G2 = {Brand%, BrandMax − BrandPaidOutside}`,
`G3 = {NonMed%, NonMedMax − PaidOutside}`, each Max clamped to `999_999m` when paid-outside already
exceeds the cap (`:192-194`, `:202-204`, `:209-211`, `:216-218`), collapsing to a **single G1 group
carrying the NonMed rates** when `Model.InsuranceOneCopayment` is set (`:187-196`).

Per line, the group is resolved by `ResolveDeductibleGroupForLine`
(`POSController.NewPos.Deductible.cs:165-176`): `InsuranceOneCopayment` → `"G1"`; else
`InsuranceItemCategory` ∈ {Generic, BrandIR} → `"G1"`, `Brand` → `"G2"`, **anything else or missing →
`"G3"`**. Both functions read only `Model` scalars and the line's own category — they are pure in
substance, impure only in that they read `Model` rather than take a parameter.

---

## Q3 — Does the Nphies REST backend itself price?

**No evidence that it does. Clear evidence that it does not need to.**

- The Nphies REST service's source is **not in this repository.** A repo-wide search for `fhir`
  across `*.cs`/`*.csproj` returns exactly one hit, and it is a payer *code literal* in the WPF
  client — `SelectedPayer = Payers.FirstOrDefault(c => c.PayerCode == "INS-FHIR");`
  (`NphiesAuthRequestController.cs:826`). Everything below is therefore inference **from the wire
  contract only**, and is labelled as such.
- `NphiesService.cs` is `HttpClient` calls and nothing else — base address
  `http://172.23.27.40:8065/` (`:51`, staging `:48`, dev `:43`), assigned at `:92`. `Auth/Auth` is a
  single `PostAsJsonAsync("Auth/Auth", model)` (`:490`).
- **`core/*` carries no item or price data.** The observed `core` routes are `core/payers` (`:102`),
  `core/payerPolicyType` (`:122`), `core/providers` (`:142`), `core/diagnoses` (`:181`),
  `core/diagnosis/{code}` (`:200`), `core/morphs` (`:220`, `:235`), `core/codeSystem` (`:255`). All
  are reference/code-system reads. **No `core/items`, no `core/prices`, no tariff endpoint.**
- **`auth/ClinicalEditValidate` carries no money at all.** Its request is
  `{ ServiceDate, PatientBirthDate, PatientGender, Diagnoses[] }`
  (`Sartawi.POS\Nphies\ClinicalEdits\Models\ClinicalEditRequest.cs`, whole file). The only
  pre-submit validation the backend offers the client is clinical, not financial.
- **The response echoes the money back rather than replacing it.** `NphiesAuthLineDto` carries the
  submitted `UnitPrice, ExtendedPrice, Factor, DiscountPercentage, DiscountAmount, Amount, Vat,
  NetAmount, ActualPatientShare, DeductibleG, DeductibleGroupName`
  (`Sartawi.Retail.Data\Modules\Nphies\Services\Models\AuthView\NphiesAuthLineDto.cs:16-24`, `:60-61`)
  **alongside a separate set of payer-adjudicated figures** — `Eligible, Copay, Benefit,
  BenefitReason, ApprovedQuantity, Submitted, Deductible, UnallocDeduct, Tax, Rejected, PatientShare,
  Discount` (`:28-43`). Two disjoint field families on one row is the shape of *"what we sent"* beside
  *"what the payer decided"*. The payer adjudicates; the backend relays.
- `Auth/UpdateAuthFromEligibility` exists (`NphiesService.cs:508-511`) and returns a
  `NphiesAuthHeaderDto` — so the backend does hold eligibility state and can enrich a request header
  from it. **Whether it touches the deductible buckets there: no evidence found** (the endpoint's
  server side is not in this repo, and no caller in the WPF client inspects the returned header's
  money fields).
- The immediate `NphiesAuthResponse` is status-only — `Id, EligibilityId, ProviderCode, PayerCode,
  PatientId, ActionDateTime, ErrorMessage, HidpReference, Outcome, Disposition, ProcessNote,
  AdjudicationOutcome, Success, StatusCode`
  (`Models\AuthRequest\NphiesAuthResponse.cs`, whole file). **No money on it whatsoever.** If the
  backend recomputed anything, the recomputation is not surfaced on the submit response.

---

## Q4 — Does the Nphies backend validate the money it is sent?

**No evidence found, in either direction.**

What can be said from the client side:

- The client's error handling is undifferentiated. `AuthRequest` treats *any* non-2xx identically:
  read the body as a string, prepend `"Error !"`, `throw new Exception(...)`
  (`NphiesService.cs:499-504`). There is no branch on an error code, no financial-validation code
  matched anywhere, and no retry-with-corrected-totals path. If the backend did reject inconsistent
  totals, the client has no code that would recognise it as such.
- `NphiesValidation.cs` is 40 lines and contains **no** occurrence of `Amount`, `Price`, `Vat` or
  `Total` (grep returns nothing) — the WPF client does no self-consistency check on the money before
  sending either.
- `BuildAuthRequestForSubmit`'s validations are all non-financial: days-supply range
  (`NphiesAuthRequestController.cs:1771-1786`), advanced-prior-auth quantity ≤ authorized quantity
  (`:1788-1797`), then `ValidateForBahrain() / GeneralValidation() / ValidatePatient() /
  ValidateDuplicateItems()` (`:1799-1803`).

**Conclusion for the map: unknown, and it is a live risk.** The safe planning assumption is that a
web-raised line must be *internally consistent* (`ExtendedPrice = UnitPrice × Quantity`,
`Amount = ExtendedPrice − DiscountAmount`, `NetAmount = Amount + Vat`) because that is what WPF
sends, not because the backend is known to check. Settling this needs a probe against the staging
service (`:8077`) or the Nphies service's own repository — neither is in scope of this ticket, and
**this is the single cheapest de-risking action available before sizing.**

---

## Q5 — What `NItemFinder` resolves, and whether a web picker needs it

File: `C:\Work\DMSCO\BackOffice\Sartawi.POS\Nphies\NItem\NItemFinder.cs` (73 lines). Constructor
takes `(itemNumber, code1, code2)` (`:15-20`). `Find()` (`:22-71`):

1. **First attempt** — `ItemRetailDetectorFactory.CreateForCurrentInvoice(_itemNumber ?? _code1.ToLong().ToString())`,
   then sets `StoreCode = POSCommon.Store.StoreCode`, `ScannedBarcode = _itemNumber ?? _code1`,
   `Quantity = 1`, and calls `Detect()` (`:26-31`). So `Code1` is a **fallback barcode/number**
   (numeric — note the `.ToLong()`).
2. **On any exception**, if `Code2` is empty → fail with *"The code {x} is unidentified, contact
   insurance department!"* (`:35-42`).
3. **Otherwise** open a fresh NHibernate session and look `Code2` up as either an item number **or an
   SFDA code** — `session.Query<ItemInfo>().FirstOrDefault(c => c.ItemNumber == _code2 || c.SfdaCode == _code2)`
   (`:46-48`) — then re-run the detector on the canonical `itemInfo.ItemNumber` (`:58-63`).

So `NItemFinder` is a **three-key resolver onto one canonical SKU**: our item number → a numeric
alternate code → an item number *or SFDA code*. It reaches POS global state (`POSCommon.Store`) and
the database directly, and `Detect()` is the retail detector, which resolves the item **and its
retail price** — the caller comment confirms it: *"NItemFinder.Find runs ItemRetailDetector.Detect,
which resolves the canonical SKU on the ItemRetailDetector.Item entity (independent of which of
ItemNumber/Code1/Code2 hit)"* (`POSController.NewPos.Nphies.cs:118-120`).

**Does a web item picker need the same resolution? For raising an authorization — no.**

Every call site is on the **response → dispense** path, never the request-build path:
- `POSController.cs:11985` — `new NItemFinder(authLine.ItemNumber, authLine.Code1, authLine.Code2)`;
- `POSController.NewPos.Nphies.cs:110` — same, inside `PrescribeNphiesLineUsingNewPos`;
- `NphiesAuthResponsesController.cs:1088` — validating an approved authorization's lines before
  dispensing.

`Code1`/`Code2` appear **only on `NphiesAuthLineDto`** (`NphiesAuthLineDto.cs:13-14`); a grep for
`Code1|Code2` across the whole of `NphiesAuthRequestController.cs` (2508 lines) returns **nothing**,
and `NphiesAuthItemRequest` has no such fields (`NphiesAuthItemRequest.cs`, whole file — `ItemNumber`
only, `:9`). The request is raised from *our* catalogue, so the picker resolves nothing; the payer's
`Code1`/`Code2` are what come *back*.

Since dispensing is explicitly out of scope for the map, the web needs **no** equivalent of
`NItemFinder` in v1. It becomes required the moment an approved authorization's lines have to be
matched back to SKUs on the web — which is the boundary the map already drew.

---

## The required output: the fifteen line fields, classified

Legend — **(a)** obtainable today with no new server work · **(b)** needs a new endpoint or a server
change · **(c)** no known source at all.

### Line fields (`NphiesAuthItemRequest`, built at `NphiesAuthRequestController.cs:1921-1945`)

| # | Field | Class | Source, and what the classification rests on |
|---|---|---|---|
| 1 | `UnitPrice` | **(b)** | Engine `SimulationResultItem.NetPrice` (`SimulationResultItem.cs:12`). Data exists today; `Pricing/Simulate` is gated on `BackOfficeScreen[PosSimulation,03]` (`PricingEndpoints.cs:59`) and its web contract omits nothing here — so this is a **route/grant** change, not an engine one. ⚠ WPF's `UnitPrice` is `itemDetector.OriginalUnitPrice` (`POSController.cs:13625`), the pre-discount list price; confirm `NetPrice` is the same figure before relying on the equality. |
| 2 | `Quantity` | **(a)** | The picker's own input. `detail.Quantity` (`:1925`). |
| 3 | `ExtendedPrice` | **(a)** | `(UnitPrice × Quantity).RoundCurrency()` (`POSController.cs:13655`) — pure arithmetic over 1 and 2. Also available as engine `NetValue`. |
| 4 | `Amount` | **(a)** | `ExtendedPrice − DiscountAmount` (`POSController.cs:13656`) — arithmetic over 3 and 8. |
| 5 | `NetAmount` | **(a)** | `detail.GrossAmount` = `Amount + VatAmount` (`ItemLineViewModel.cs:1090`) — arithmetic over 4 and 6. Also engine `GrossValue`. |
| 6 | `Vat` | **(b)** | Engine `SimulationResultItem.TaxValue` (`SimulationResultItem.cs:14`). Same route/grant dependency as 1. **Must not be computed client-side** — VAT is a determined condition (`TaxDeterminationService.cs`), not a fixed 15 %. |
| 7 | `DiscountPercentage` | **(b)** | WPF reads the *first* line condition whose `MainConditionType == "DSCT"` and takes `CondValueP` (`NphiesAuthRequestController.cs:1909-1916`; constant at `Sartawi.Retail.Data\Constants\_Constants.cs:10`). `SimulationResultCondition` carries `ConditionType`, `ConditionRate`, `ConditionCategory` — but **not `MainConditionType`** (`SimulationResultCondition.cs`, whole file), so *which condition is the discount* is not answerable off today's projection. Needs the main-condition-type projected, or an agreed condition-type list. |
| 8 | `DiscountAmount` | **(b)** | `Math.Abs(discountCond.CondAmount)` (`:1916`). Engine `SalesDiscount` + `PromotionDiscount` are on the result (`SimulationResultItem.cs:17-18`) but are **sums**, whereas WPF takes one condition — a fidelity decision, plus the same identification gap as 7. |
| 9 | `Factor` | **(b)** | `1 − DiscountPercentage/100` (`:1918`) — arithmetic, but entirely downstream of 7. Defaults to `1` when there is no discount condition (`:1908`). |
| 10 | `MaxCoverage` | **(a)** | `detail.InsuranceMaxCoverage` (`:1934`). On a **freshly raised** authorization there is no automatic source: it is either the pharmacist's Max Coverage dialog (`POSController.cs:20328`) or a *prior* auth line's `Benefit` (`POSController.cs:12042`, `POSController.NewPos.Nphies.cs:251`). On the web it is an **optional operator input defaulting to 0** — no server work, but also no server answer. |
| 11 | `ActualPatientShare` | **(b)** | `Math.Abs(pcItem.DeductibleValue)` (`ItemLineViewModel.cs:1093`) → engine `SimulationResultItem.DeductibleValue` (`SimulationResultItem.cs:24`). **The engine computes it and the result type carries it** — but only when the request sets `IsDeductibleApplicable` + `Deductibles` + per-item `DeductibleGroup`, which `SimulateRequest` accepts (`SimulateModels.cs:33`, `:38`, `:57`) and the web's own model does not yet express. |
| 12 | `DeductibleG` | **(b)** | `Math.Abs(pcItem.CalculatedDeductible)` (`ItemLineViewModel.cs:1092`) → engine `CalculatedDeductible` (`SimulationResultItem.cs:23`). Same conditions as 11 — one contract change buys both. |
| 13 | `DeductibleGroupName` | **(b)** | `detail.InsuranceItemCategory` (`:1943`), an **item-master** field. Server-side it is already read: `ArticleLookupService.cs:88` puts `InsuranceItemCategory` on `ArticleInfo`. It is simply **not projected onto any web-reachable response today** (no hit anywhere under `Services\SIS.Api`). Needs projecting onto whatever the web item picker reads. |
| 14 | `DaysSupply` | **(a)** | `detail.DaysSupply` (`:1940`), defaulted from the form's `DailySupply` when ≤ 0 or > 90 (`:1771-1776`), itself seeded from a prior response or 30 (`:781`). Pure operator input + a client-side rule. |
| 15 | `SelectionReason` | **(b)** | `detail.PharmacistSelectionReason` (`:1941`). Auto-derived from `InsuranceItemCategory` on scan — Generic → `DefaultSelectionReasonForGeneric`, BrandIR → `…ForBrandIr`, else `…ForBrand` (`POSController.cs:13631-13645`) — and pharmacist-overridable. The derivation is trivial client-side arithmetic; it is **(b)** solely because it depends on 13. The code list itself is already reachable: `core/codeSystem` (`NphiesService.cs:255`). |

**Summary: (a) 5 · (b) 10 · (c) 0.** No line field has *no known source*. Nine of the ten **(b)**
fields collapse into **two** server changes:

- **Change 1 — an insurance-capable pricing call the web may make** (fields 1, 6, 11, 12, and the
  data behind 7/8/9). The engine already does all of it; what is missing is a route+grant the Nphies
  screen may use and a request/response contract carrying `IsDeductibleApplicable`, `Deductibles`,
  `DeductibleGroup` and the per-item deductible outputs.
- **Change 2 — `InsuranceItemCategory` on the item picker's response** (fields 13, 15, and the
  `DeductibleGroup` input Change 1 needs). It is already loaded server-side at
  `ArticleLookupService.cs:88`.

### Header buckets (`NphiesAuthRequest`, filled at `NphiesAuthRequestController.cs:1827-1835`)

| Field | Class | Source |
|---|---|---|
| `DeductibleG1` / `G1Max` | **(b)** | `coverage.Items[Category=="66"].CopayPercent` / `.CopayMaximum` — computed by the **pure** `NphiesDeductibleManager.UpdateDeductible(coverage, request)` (`:107-116`). Eligibility itself is already proxied by SIS.Api (`NphiesEndpoints.cs:28`, `POST Nphies/CheckEligibility`) and the coverage response already carries `Items` + `TableOfBenefits` (`NphiesEligibilityCoverageResponse.cs:28-29`). The **(b)** is only *where the pure function runs* — client-side reimplementation is possible but would be a fourth copy of an algorithm that already has three. |
| `DeductibleG2` / `G2Max` | **(b)** | `Category == "57"`, plus the `brandPercentage > 0 && brandMax == 0 → 9999m` rule (`:119-135`). Same reasoning. ⚠ carries the stray-semicolon parse (`:125-126`). |
| `DeductibleG3` / `G3Max` | **(b)** | `TableOfBenefits` `copaypct` → else `copay` → `DeductibleG3`; `maxcopay` → `DeductibleG3Max` (`:138-162`). Same reasoning. |
| `DeductibleG1Paid` / `G2Paid` / `G3Paid` | **(a)** | `model.Insurance*PaidOutside` (`:1829`, `:1832`, `:1835`), which are only ever set from a **prior authorization response's** own paid figures (`NphiesAuthRequestController.cs:1694`, `:1698`, `:1702`; `NphiesAuthResponsesController.cs:1134`, `:1138`, `:1142`). On a freshly raised authorization there is no prior response, so they are **0** — no server work and no source needed. |
| `PolicyStartDate` / `PolicyEndDate` | **(a)** | `coverage.PeriodStart` / `PeriodEnd` off the same eligibility response (`NphiesDeductibleManager.cs:164-167`). Straight field copy. |

---

## The three facts that most change the estimate

1. **The engine's insurance pass is already an HTTP-reachable feature, request *and* response.**
   `SimulateRequest` accepts `IsDeductibleApplicable` + `Deductibles` + per-item `DeductibleGroup` /
   `InsuranceItemCategory` / `MaxPayerShare` (`SimulateModels.cs:33`, `:38`, `:57-60`) and
   `SimulationResultItem` returns `CalculatedDeductible`, `DeductibleValue`, `PatientShare`,
   `MaxPayerShare` (`SimulationResultItem.cs:21-24`) — which are *precisely* the three engine fields
   WPF transcribes onto the Nphies line (`ItemLineViewModel.cs:1092-1094`). The money question is a
   **contract-and-grant** question, not an engine question.

2. **The header-bucket algorithm is already a pure function.**
   `NphiesDeductibleManager.UpdateDeductible(coverage, NphiesAuthRequest)` (`:103-171`) takes a
   coverage DTO and returns the filled request. No `POSCommon`, no controller, no I/O — unlike its
   sibling overload (`:16-101`), which reaches into `controller.Model` and even rewrites
   `CustomerType` off a hard-coded `SubscriberId` switch (`:18-23`). It can be lifted server-side
   verbatim, and doing so also collapses the three copies of the algorithm
   (`NphiesDeductibleManager` ×2, `FillCoverage` at `NphiesAuthRequestController.cs:865-942`) into one.

3. **The call-centre price-check path is *not* reusable, and knowing why saves a wrong turn.**
   It needs an open engine transaction (`CallCenterPriceCheckService.cs:70`), it is hard-wired to
   quantity 1 (`CallCenterPriceCheckPricer.cs:102`), and it sets `IsDeductibleApplicable = false`
   with a comment saying a call-centre order is never an insurance document
   (`CallCenterPriceCheckPricer.cs:198-200`). `Pricing/Simulate` is the reusable door — order-free,
   session-free, POS-state-free — and the web already calls it
   (`src\features\pricing\simulation\api.ts:31-33`). Its one insurance-shaped omission is that the
   handler nulls `InsuranceSummary` before returning (`PricingEndpoints.cs:124`); the **per-line**
   deductible fields survive that, so the gap is header-level only.

**And the one unresolved risk:** Q4 has **no evidence in either direction**. Whether the Nphies
service rejects internally inconsistent totals is unknown from this repository, and the WPF client
could not tell the difference if it did (`NphiesService.cs:499-504` collapses every non-2xx into one
`Exception`). A single probe against staging (`:8077`) would settle it and is the cheapest
de-risking action available before this map is sized.
