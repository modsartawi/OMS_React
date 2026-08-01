---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: —
---

# 205 — Who computes the money on a web-raised authorization line

## Question

[197](197-nphies-pricing-machinery.md) removed the fear this ticket was charted under. The money is
not the till's — it is the **SIS.Pricing engine's**, and the engine's insurance pass is already
reachable over HTTP in both directions: `POST Pricing/Simulate` takes `IsDeductibleApplicable`, a
`Deductibles` group dictionary and per-item `DeductibleGroup` / `InsuranceItemCategory` /
`MaxPayerShare`; `SimulationResultItem` gives back `CalculatedDeductible`, `DeductibleValue`,
`PatientShare`, `MaxPayerShare`. Ten of the fifteen line fields need a server change, and nine of
those ten collapse into **two** changes. This ticket decides what those two changes are, and who
owns each.

Decide:

1. **Which door the Nphies screen knocks on.** Reuse `Pricing/Simulate` with the deductible inputs
   filled in, or mint a purpose-named endpoint (`Nphies/PriceAuthLines`) that wraps it? The reuse
   argument: the engine contract already exists and oms-react already calls it
   (`features/pricing/simulation/api.ts:31`). The wrapper argument: the caller would otherwise have
   to assemble the deductible group dictionary from an eligibility coverage in the browser — which
   is the algorithm question below, leaking client-side. Note the header gap either way:
   `PricingEndpoints.cs:124` nulls `InsuranceSummary` on the way out, and the header buckets
   (`DeductibleG1/G2/G3` + `Max`) are what that summary would carry.
2. **Where the coverage→buckets algorithm runs.** `NphiesDeductibleManager.UpdateDeductible(coverage,
   NphiesAuthRequest)` is already pure — coverage in, buckets out, no POS state — so it can be lifted
   as-is. Server-side (one implementation, three WPF copies collapse into it) or re-expressed in
   TypeScript (no backend change, but a fourth copy of an algorithm that already carries a latent
   parse bug in all three existing ones)? A recommendation is expected, not a survey.
3. **How the item picker learns `InsuranceItemCategory`.** It decides generic (`66`) vs brand (`57`)
   vs non-medical, so it decides which bucket a line lands in. `ArticleLookupService.cs:88` already
   loads it — this is a projection, not a lookup. Confirm it is that cheap, and that the picker's
   response is the right place for it.
4. **The five fields that are not the engine's.** `MaxCoverage` (operator input, defaults to 0),
   `SelectionReason`, `Factor`, `DeductibleGroupName`, `DaysSupply` — say for each whether the web
   screen asks the operator, defaults it, or omits it, and what the payer does with the answer.
5. **Whether the web ever sends money the engine did not compute.** If the operator can override a
   price or a patient share, say so now — it changes both the contract and what
   [206](206-nphies-does-the-service-check-the-money.md) is checking for.

The output is a **contract sketch plus an owner per field**, precise enough that
[204](204-nphies-the-estimate.md) can put a figure on the backend work.

## Comments

**2026-07-31, from [203](203-nphies-screen-shape.md) — the shape asks one question of this ticket,
and answers half of another.**

Re-reading `UpdateDeductible`'s pure overload while prototyping the item grid: **it never touches
`request.Items`.** It reads the coverage and writes only header fields — `DeductibleG1/G1Max` from
category `66` (generic), `G2/G2Max` from `57` (brand), `G3/G3Max` from `TableOfBenefits`
(`copaypct` ?? `copay`, `maxcopay`), plus `PolicyStartDate/EndDate`. So deductibility is **two
things on two different clocks**:

- **The rates** are a projection of the *coverage*, fully known the moment the coverage is picked on
  the eligibility — before any item exists. They arrive on 203's `?from=<eligId>` seam. 203 therefore
  renders them as a **read-only rate block** on the auth form, beside the policy block: without it,
  a per-line deductible is a number with no visible cause.
- **The per-line amounts** (`CalculatedDeductible`, `PatientShare`, `MaxPayerShare`, `DeductibleG`,
  `DeductibleGroupName`) are the engine's, and need the rates plus `InsuranceItemCategory` — this
  ticket's Q3.

**The question handed here, which 203 deliberately did not decide:** `DeductibleG1/G2/G3Max` are
**caps across the request**, not per line, and `DeductibleG1/G2/G3Paid` exists to track their
consumption. A cap can therefore bind *across* lines — so adding, removing or re-quantifying one
item can change the money on items already priced. **Is the pricing call per-line or whole-basket?**
203's grid prices each line as it lands, which is the right *feel*; if the answer is whole-basket,
the grid re-prices every row on every change and the interaction is the same but the call is not.
This is a contract question, so it belongs here, and it should be answered explicitly rather than
falling out of whichever endpoint Q1 picks.

**2026-07-31 — "do we use a `PosTransaction`, like call centre did?" Evidence says no, and it
answers the cap question above.**

Asked while reviewing 203. Checked at source rather than inferred: `SimulationService(IPricingSession
session)` calls `session.CreateContext(header)` and `session.RemoveContext(docNumber)`
(`SimulationService.cs:14,21,74`) — an **in-memory pricing context created and torn down inside the
call**. No `PosTransaction`, no retail document, no persistence, no transaction id on the wire.

**The contrast with call centre is the reason, and it is not an accident.** Call centre needs a
transaction because it *is* building an order — a persisted document with a session, resumed per
request — and its price-check piggy-backs on that open transaction, which is why
[197](197-nphies-pricing-machinery.md) ruled the path unusable here (transaction required at
`CallCenterPriceCheckService.cs:70`, qty hard-wired to 1, and `IsDeductibleApplicable = false` with
the comment *"a call-center order is never a deductible (insurance) document"*). The Nphies screen
is not building an order; it is assembling a request to a payer. It wants the engine **without the
document around it**.

**Nothing is lost by skipping the transaction.** Simulate maps onto the engine's own `PcHeader` /
`PcItem` (`SimulationService.cs:101`, `:148`), carrying `IsDeductibleApplicable` (`:119`) and the
`Deductibles` dictionary as `PcDeductible { Percentage, Max }` (`:125`, `:137`), and runs
`PricingCompleteCalculator` — deductible pass at `:123` (`PrepareDeductible`) and `:265`
(`CalculateDeductible`). Same calculation engine, same deductible engine, same insurance pass. The
transaction was never where that logic lived.

**This resolves the per-line-vs-whole-basket question above: whole-basket, by construction.** The
caps live on the *header* dictionary, not per line, so one Simulate call carries the whole item list
and the engine applies the caps across it. 203's grid keeps its feel (each row fills in as it
lands) but the call re-simulates the full basket on every add / remove / quantity change, and **no
cap-tracking is written on our side**.

Still open here, and unaffected: the `InsuranceSummary` header gap (`PricingEndpoints.cs:124`) and
the route/grant fork in Q1 — Simulate is gated on `BackOfficeScreen[PosSimulation,03]`, the
pricing-analysis screen's grant, not an insurance screen's.

**⚠ 2026-07-31, same day, superseded in part — this ticket is now blocked by
[208](208-nphies-the-auth-is-an-engine-document.md).** The comment above answered *"do we need a
`PosTransaction` to price?"* — correctly, no. It then treated that as the whole question, which it is
not. The requester's correction: the new POS already opens a real `PosTransaction` under a seeded
`NphiesAuth` doc type, **`AllowsSubmission = true` and `IsSimulation = false`**, precisely *because*
the agent can modify the deductible and swap items and the business must be able to reconstruct
later what the engine landed versus what the agent changed. A simulation leaves no audit trail, so
the catalog row rejects simulation by design (`DocumentTypeCatalogNphiesAuthTests.cs:40-52`).

So Q1's "which door" is downstream of a bigger question: **does the web book engine lines on a real
transaction like the till does?** If it does, the money arrives the way the till's does and Q1/Q2
largely dissolve. 208 decides that first. The whole-basket finding above still holds either way —
caps are header-level in both models.

**2026-07-31, same day — [208](208-nphies-the-auth-is-an-engine-document.md) is resolved and this
ticket is unblocked and SMALLER. Read 208 before starting.**

The answer was **yes**: the web opens a live `NphiesAuth` engine transaction and books every item as
an engine line (`ScanAsync` / `ChangeQty` / `VoidLine`). So:

- **Q1 (which pricing door) largely dissolves.** There is no door to choose — the money arrives the
  way the till's does, from lines on a real transaction priced at the plant. `Pricing/Simulate`, the
  grant fork, and the `InsuranceSummary` gap all drop out with it.
- **Q2 (where the coverage→buckets algorithm runs) dissolves.** The buckets ride on the engine
  transaction header, so the pure `UpdateDeductible` runs server-side by construction. No fourth
  TypeScript copy was ever on the table.
- **Q5 is half-answered.** The agent may override the **header deductible rates** (G1/G2/G3 + caps)
  and the **line quantity**, and may **void** a line — never a unit price, a discount, or an item
  swap. What remains here is what *records* the override and how the audit distinguishes
  engine-landed from agent-changed.
- **Q3 (`InsuranceItemCategory` on the picker) and Q4 (the five non-engine fields) are untouched**
  and are now most of this ticket.

One input 208 added: the **plant is the agent's acting store**, bound once at open — so it prices
every line, and the money depends on a store choice made before the first item.

## Answer

**Nobody computes money on the web. The engine computes all of it, and the agent supplies five
inputs to the computation** — header deductible rates, header paid-outside, line quantity, line
Max Coverage, line Days Supply — plus Selection Reason, which is a code and not an amount. Every
other field on the line is derived and read-only.

Q1 and Q2 were already dissolved by [208](208-nphies-the-auth-is-an-engine-document.md). **Q3
dissolves too, and Q4 turned out to be two fields fewer than it was written with.** What is left is
a per-field owner table, three new session verbs, and one schema column.

### 1 · Q3 dissolves — the picker learns nothing, because the engine already knows

`InsuranceItemCategory` never has to reach the item picker. It rides on the **engine line**
(`PosTransactionLine.InsuranceItemCategory`, `001_create_pos_mvp.sql:110`), stamped at scan from
the item master (`POSController.NewPos.cs:3052`) with a per-payer `ItemCustomer` override
(`POSController.cs:12963-12974`) — a projection that is already server-side and already persisted.

The category→bucket decision is server-side with it:
`ResolveDeductibleGroupForLine` (`POSController.NewPos.Deductible.cs:165-176`) maps
`Generic`/`Brand-IR` → **G1**, `Brand` → **G2**, everything else → **G3** (or **G1** for everything
when `InsuranceOneCopayment`), and writes it via `UpdateLineInsuranceAsync(ln, c =>
c.DeductibleGroup = grp)`. The `999_999` sentinel and the `Max − PaidOutside` arithmetic sit beside
it in `BuildDeductibleGroupsFromModel` (`:183-221`).

So 197's *"`InsuranceItemCategory` on the item picker"* — one of the **two** server changes it said
nine of the ten fields collapsed into — **costs nothing at all**. The picker response is unchanged.
If the grid wants to show the category it comes back on the line state, not the lookup.

### 2 · `DeductibleGroupName` **is** `InsuranceItemCategory` — Q3 and Q4 were one question

`NphiesAuthRequestController.cs:1943`: `DeductibleGroupName = detail.InsuranceItemCategory`. Same
value, two names, and it carries the category string (`Generic` / `Brand` / `Brand-IR` / `NonMed`,
`InsuranceDeductibleItemCategoryConstants.cs:11-14`) — **not** the `G1`/`G2`/`G3` bucket it reads
like. Nothing to decide: engine-owned, sent as-is.

### 3 · Three of the four "money" fields never reach NPHIES

Checked against the FHIR mapper, not assumed. `Extensions.cs:298-341` builds `Claim.ItemComponent`
from `Sequence`, `ProductOrService`, `Factor`, `Serviced`, `Quantity`, `UnitPrice`, `Net`, plus
extensions for tax, **patient-share**, package, selection-reason, and the days-supply /
diagnosis index lists. `MaxCoverage`, `DeductibleG` and `DeductibleGroupName` appear **nowhere** —
they are stored on `NAuthLine` (`AuthService.cs:442-445`) and stop there.

**Their audience is the dispensing till, not the payer.** The till reads them back off
`auth/AuthResponse/{id}` to price the dispense the same way the request was priced. This matters to
the estimate: getting them wrong is not a rejected claim, it is a mispriced dispense later —
still wrong, but a different failure and a different test.

Of the per-line money, only **`ActualPatientShare`** (engine `DeductibleValue`) is adjudicated.

### 4 · `Factor` is not ours — omit it

`AuthService.cs:450` overwrites it unconditionally, immediately after mapping it in:

```csharp
Factor = authItemRequest.Factor,   // :435
...
line.Factor = line.Amount / line.ExtendedPrice;   // :450
```

WPF's careful derivation from the line's discount condition (`NphiesAuthRequestController.cs:
1906-1919`) is dead code the moment it lands. The web sends nothing and loses nothing.

### 5 · The five decisions (requester, 2026-07-31)

**Q4's `MaxCoverage` premise was wrong.** It is the engine's `MaxPayerShare`
(`ItemLineViewModel.cs:1094`), not an operator field defaulting to 0 — but there *is* an operator
override on top of it, and 208's list of what the agent may change was short by three.

| # | Decision | Ruling |
|---|---|---|
| 1 | Per-line **Max Coverage** override | **Keep, editable cell.** Writes `MaxPayerShare` through `UpdateLineInsuranceAsync` so the deductible stays derived; can re-bucket sibling lines because per-group caps share a pool. Inside 208's principle — the agent corrects the *insurance* terms, never the merchandise. |
| 2 | Per-line **Selection Reason** picker | **Keep, exactly the WPF rule** — a select disabled on `Generic` lines **only** (`POSController.cs:19868-19872` tests `Generic` and nothing else). Codes from the already-proxied `core/codeSystem` / `ValueSetConstants.SelectionReason`. |
| 3 | **Days Supply** | **Both levels, one range.** Header default 30 stamps each line as it lands; per-line editable cell; **1–100 validated at entry**, replacing WPF's three ranges (180 / 90 / 100). |
| 4 | **Paid-outside** | **Include** — three fields inside 208's editable rate block. |
| 5 | Persisting paid-outside | **Add `PaidAmount DECIMAL(18,2) NOT NULL DEFAULT 0`** to `PosTransactionDeductibleGroup`; store the coverage's own cap in `MaxAmount`. |

**On decision 2, a quirk carried deliberately.** On a `Brand-IR` line the agent may pick a reason
and the Nphies service overwrites it at submit with `"innovative-noGeneric"`
(`AuthService.cs:418-421`); it also blanks the field entirely when `nItem.RemoveSelectionReason`.
WPF behaves identically. The spec should say so, or someone will "fix" it and change what reaches
the payer.

**On decision 3, what it buys.** WPF sweeps out-of-range values at *submit*, silently resetting
them to the header value and then listing them in a warning
(`NphiesAuthRequestController.cs:1771-1786`). Validating at the cell means the value can never
exist, so the sweep and its dialog are **deleted, not ported** — and the web can never hand the
service a `DaysSupply` it throws on (`AuthService.cs:405-409`). Same instinct as 203's morphology
block and 208's duplicate-scan refusal: state the rule where it applies.

**On decisions 4 and 5, why the column.** The engine receives a cap already reduced by paid-outside
(`POSController.NewPos.Deductible.cs:199-219`), and `PosTransactionDeductibleGroup` stores only
`Percentage` and `MaxAmount` (`015_create_pos_transaction_insurance.sql:11-20`). A stored
`MaxAmount` of 300 cannot distinguish *a 300 cap* from *a 500 cap with 200 already spent* — and the
agent's input is precisely the part that vanishes. That is a direct hit on 208's whole rationale.
The till has the same gap, but the till's paid-outside is a cashier's in-the-moment adjustment on a
sale; ours is an input to a request a payer will be asked about later. One column on a table two
tickets old with no production history to migrate; the arithmetic does not move.

### 6 · The contract — one owner per field

The line as WPF actually builds it (`NphiesAuthRequestController.cs:1921-1945`) is **19 fields**,
not the fifteen 197 counted before the builder was read.

| Field | Owner | Note |
|---|---|---|
| `ItemNumber`, `Sequence` | session | engine line identity |
| `Quantity` | **agent** | `ChangeQty` |
| `UnitPrice`, `ExtendedPrice`, `Amount`, `NetAmount`, `Vat` | engine | priced at the plant = acting store (208 §4) |
| `DiscountPercentage`, `DiscountAmount` | engine | never agent-set |
| `Factor` | **omit** | service recomputes (§4) |
| `ActualPatientShare` | engine | `DeductibleValue` — **the only per-line money the payer sees** |
| `DeductibleG` | engine | `CalculatedDeductible` — ours only |
| `DeductibleGroupName` | engine | == `InsuranceItemCategory` — ours only |
| `MaxCoverage` | engine, **agent-overridable** | `MaxPayerShare` — ours only |
| `ServiceDate`, `Diagnosis` | header | stamped down onto every line |
| `DaysSupply` | **agent** | header default + per-line, 1–100 — **on the wire** as `days-supply` supporting-info, referenced by `InformationSequence` (`AuthService.cs:354-371`, `:497-499`) |
| `SelectionReason` | derived, **agent-overridable** | **on the wire** as `extension-pharmacist-Selection-Reason` |

### 7 · What this costs — three verbs and one column

**Session verbs grow from 208's eight to eleven:**

```
+ Nphies/Session/SetInsurance      group rates + caps + paid-outside  → SetInsuranceAsync
+ Nphies/Session/UpdateLineInsurance   DeductibleGroup at scan; MaxPayerShare on override
+ Nphies/Session/UpdateLineMeta        DaysSupply, PharmacistSelectionReason
```

**Everything else already has a home, unchanged.** Migration 015 created
`PosTransactionInsurance` — a 1:1 companion to the transaction header carrying `PatientId`,
`MemberId`, `EligibilityId`, `PayerCode`, `ActionType`, `Diagnosis`, `DaysSupply`, `VisitReason`,
`ChiefComplaint*`, `PolicyStartDate`/`EndDate`, `AuthorizationId`, `OneCopayment` — and
`PosTransactionDeductibleGroup` for the per-group rates. `DaysSupply` and
`PharmacistSelectionReason` are already `PosTransactionLine` columns
(`001_create_pos_mvp.sql:113,115`). **The auth header was already modelled on the transaction
before this ticket asked for it.**

So the backend work this ticket decides is: **three session verbs and one schema column.** 197's
second server change (`InsuranceItemCategory` on the picker) is priced at **zero** and dropped.

### 8 · What the audit actually records — Q5's tail

Three tiers, and it is worth being honest about which is which:

1. **Engine events** — `UpdateLineInsuranceAsync` emits an `UpdateLineInsurance` audit event
   (`POSController.NewPos.Deductible.cs:112-115`), and the transaction's event history rides the
   `POS_TRANSACTION_EVENT` sync stream to the server. Max Coverage and bucket assignment are
   before-and-after recorded. So are add / change-qty / void.
2. **Columns** — `DaysSupply` and `PharmacistSelectionReason` persist their **final value only**.
   An agent who changed Days Supply from 30 to 7 leaves a 7, not a change.
3. **Nothing** — paid-outside, until decision 5's column lands.

Tier 2 is a real limit on 208's promise, and it is the honest answer to *"how does the audit
distinguish engine-landed from agent-changed"*: **for the money, completely; for the two line-meta
codes, only by inference from the defaults.** Since both defaults are deterministic (30, and the
category→reason map), a reader *can* infer a change — but that is inference, not a record. Priced
at zero here on the reasoning that neither is money; flagged so 204 prices the alternative if the
owner disagrees.

### 9 · Three defects found, reported not fixed

- **`AuthService.cs:450` divides by zero** on any line with `ExtendedPrice == 0` (a free item, a
  zero-priced sample). `decimal` division by zero throws, so the whole submission fails with an
  unhandled exception rather than a business refusal. WPF cannot reach it today only because a
  zero-price line is rare on an auth basket.
- **`NphiesDeductibleManager.cs:46` and `:126`** — `if (decimal.TryParse(...)) ;` — a stray
  semicolon makes the guard a no-op. It happens to behave correctly because `brandMax` is assigned
  by `TryParse` either way and used unconditionally two lines later, but the brand branch therefore
  overwrites with `0` where the generic branch leaves the prior value. This is the latent parse bug
  197 flagged, in both copies.
- **SIS.Pos 26.4.64 ignores `MaxPayerShare <= 0`** in `UpdateLineInsuranceInternalAsync`, so the
  till's `AllowZero = true` semantics ("0 clears the cap") silently do nothing under the new engine
  — the WPF glue papers over it with a status message
  (`POSController.NewPos.Deductible.cs:117-122`). The web inherits the same asymmetry and should
  say so in the cell rather than accept a value that will not apply.

### What this hands forward

- **To [203](203-nphies-screen-shape.md):** the rate block gains **three paid-outside fields**, and
  the item grid gains **three editable cells** — Max Coverage, Days Supply, Selection Reason
  (disabled on `Generic`) — on top of quantity and void. Commented there.
- **To [198](198-nphies-proxy-contract.md):** the session surface is **eleven verbs, not eight**.
  Commented there.
- **To [204](204-nphies-the-estimate.md):** this ticket's backend cost is **three session verbs and
  one schema column**; 197's picker change is **zero**. The riskiest line is not here — it is 206,
  which asks whether the service checks the money at all.
- **To the WPF/Nphies-service owners:** the three defects in §9.
