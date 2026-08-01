# Does the Nphies service check the money it is sent?

Findings for [206](../../206-nphies-does-the-service-check-the-money.md), map
[196](../../196-nphies-to-web-map.md). Answered **from source, not by probe** — the service's own
code is on disk at `C:\Work\DMSCO\nphies\Service\NphiesService\NphiesService\`. Line references are
to that tree.

## Verdict

**No. The service does not check money — not one of its guards touches an amount.** It is a
transcription layer: `Auth/Auth` copies every money field off `AuthItemRequest` onto `NAuthLine`,
rounds seven of them to 2dp, recomputes exactly one (`Factor`), builds the FHIR bundle from the
stored line and POSTs it. Whatever the caller sends is what the national exchange sees.

## The submission path, field by field

`AuthService.Auth()` → line-build at `AuthService.cs:423-448`:

| Field on `AuthItemRequest` | What the service does | Reaches NPHIES? |
|---|---|---|
| `UnitPrice` | `.Round()` → stored | **yes** — `Claim.ItemComponent.UnitPrice` (`Extensions.cs:306`) |
| `Quantity` | stored verbatim, **not rounded** | **yes** — `Quantity` (`Extensions.cs:283-305`) |
| `NetAmount` | `.Round()` → stored | **yes** — `Net` (`Extensions.cs:311`) |
| `Vat` | `.Round()` → stored | **yes** — `extension-tax` (`Extensions.cs:242`) |
| `ActualPatientShare` | stored verbatim, **not rounded** | **yes** — `extension-patient-share` (`Extensions.cs:251`) |
| `Factor` | **overwritten**: `line.Factor = line.Amount / line.ExtendedPrice` (`:450`), then `== 0 ? 1 : Factor` at send (`Extensions.cs:303`) | **yes** |
| `ExtendedPrice` | `.Round()` → stored | **no** — only feeds the `Factor` recompute |
| `Amount` | `.Round()` → stored | **no** — only feeds the `Factor` recompute |
| `DiscountPercentage`, `DiscountAmount` | `.Round()` → stored | **no** |
| `MaxCoverage`, `DeductibleG`, `DeductibleGroupName` | stored verbatim | **no** |
| `DaysSupply` | range-checked 1–100, stored | **yes**, as a `days-supply` supporting-info sequence |
| `SelectionReason` | **overridden** by item master (`IdfCategory` → `Generic` / `innovative-noGeneric`; blanked if `RemoveSelectionReason`) at `:415-421,443` | **yes** — `extension-pharmacist-Selection-Reason` |

`.Round()` = `decimal.Round(v, 2, MidpointRounding.AwayFromZero)` (`Extensions.cs:896`).

Header `DeductibleG1/G2/G3`, their `Max` and `Paid` twins are copied to `NAuth` (`AuthService.cs:156-164`)
and **go nowhere else** — no NPHIES mapping exists for them anywhere in the service. Grep for
`DeductibleG` outside DTOs/maps returns only the two entity declarations.

The outbound `Claim` carries **no `Total`** — `.Total` appears in the service only when *reading* a
`ClaimResponse` (`ProcessAuthResponse.cs:165`, `ProcessAdvancedAuthResponse.cs:469`). There is no
header total for lines to reconcile against, so the mismatch the ticket's step 3 imagined cannot be
expressed in the request, let alone rejected.

## The complete guard list (every `throw` before the POST)

None is about money:

- prescription ref > 40 chars (`:219`)
- a direct-claim duplicating an existing online approval (`:241`); a referral number already used
  (`:259`); the original auth already dispensed (`:275`)
- item not in the item master (`:402`); item has no Nphies item category (`:514`)
- `DaysSupply` outside 1–100 (`:405`)
- provider not configured (`:576`); payer not configured (`:581`); coverage object not found
  (`AuthBundle.cs:150`)
- clinical-edit validation on the diagnoses (`:318`, `ClinicalEditValidator`)
- plus the `Auth_{ClaimType}{PatientId}` lock in the controller

## The checklist, answered

1. **Consistent totals accepted, and does the response echo or transform the money?** Accepted. The
   response transforms nothing of ours: `ProcessAuthResponse.cs:124-179` overwrites the line's
   `Copay / Benefit / Eligible / Submitted / Deductible / Tax / Rejected / PatientShare / Discount /
   ApprovedQuantity` with the **payer's adjudication**, verbatim, and the same set at header level
   from `ClaimResponse.Total`. Our submitted numbers survive untouched in their own columns.
2. **`ExtendedPrice ≠ UnitPrice × Quantity`?** **Accepted, silently.** Neither value is compared,
   and `ExtendedPrice` never leaves the service — its only effect is to skew the recomputed
   `Factor`, which *does* reach NPHIES. So the failure mode is not a rejection: it is a wrong
   `factor` on a live claim.
3. **Header deductibles not summing to the lines'?** **Accepted, silently, and unobservable** — see
   above; neither side of that sum is sent.
4. **Money absent or zero?** **Not accepted — but not checked either.** `ExtendedPrice = 0` makes
   `line.Factor = Amount / 0` throw `DivideByZeroException` at `:450`. It lands in the blanket catch
   at `:743`, so the caller gets `Success = false` with `ErrorMessage = "Attempted to divide by
   zero."`, and the `finally` at `:752` still persists an `NAuth` header with `Error = true` **and no
   lines** (the throw happens inside the item loop, before `nLines.Add`). This is the div-by-zero
   already reported while resolving [205](../../205-nphies-who-computes-the-money.md), now with its
   exact blast radius. It is an accident, not a validation: a zero `Amount` with a non-zero
   `ExtendedPrice` sails through as `Factor = 0` → sent as `1`.
5. **Anything the service computed rather than echoed?** Exactly two, both on the way out: `Factor`
   (recomputed) and `SelectionReason` (overridden from the item master). On the way back, everything
   is the payer's.

## What could not be answered, and why it no longer matters

Whether **NPHIES itself** enforces a `net = unitPrice × quantity × factor` rule is still unprobed:
staging `:8077` was unreachable from this network on 2026-08-01 (connect timeout), production
`:8065` answers but is off-limits for submissions — it reaches the live national exchange.

It matters less than the ticket assumed. The production formula is *empirically valid*: WPF has been
sending `Net = Amount + Vat` with `Factor = Amount / ExtendedPrice` for years and the exchange
accepts it. The web's obligation is therefore **reproduce that formula**, not discover the rule.
A violation surfaces as the `Failed` state [203](../../203-nphies-screen-shape.md) already models —
NPHIES refusing on validation before the payer sees it — which the agent fixes in the form.

## Consequences for the map

- **Nothing downstream will catch a money error.** [205](../../205-nphies-who-computes-the-money.md)'s
  ruling that the engine computes everything is safe — no second opinion exists to contradict it —
  but it is also load-bearing: the browser and the engine are the last line of defence, and a wrong
  amount becomes a wrong claim at the national exchange, not an error message.
- **Send `Factor` or don't — it is discarded either way.** 205 already ruled it omitted; this
  confirms the omission costs nothing, provided `ExtendedPrice` and `Amount` are both correct and
  `ExtendedPrice` is never zero.
- **Guard zero server-side.** SIS.Api (or the engine session) must refuse a line with
  `ExtendedPrice = 0` before it reaches `Auth/Auth`, or the agent gets "Attempted to divide by zero"
  and a headerless orphan row. A voided-to-zero or free-of-charge line is the realistic trigger.
- **Rounding is the caller's job for the one field that is adjudicated.** The service rounds
  `UnitPrice / ExtendedPrice / Amount / NetAmount / Vat / DiscountPercentage / DiscountAmount` to 2dp
  but leaves `ActualPatientShare` untouched — and that is the field NPHIES adjudicates. Whatever
  precision the pricing engine emits goes to the exchange verbatim. Same exposure as the till today
  (WPF passes `InsuranceActualDeductibleAmount` straight through at
  `NphiesAuthRequestController.cs:1936`), so this is parity, not a regression — but the web should
  round to 2dp and say so.
- **`SelectionReason` is overridden server-side anyway.** 205 ruled the agent may set it with WPF's
  exact rule; worth knowing that for a `Generic` or `Brand-IR` item master the service overwrites the
  choice regardless. The web's rule is a *display* truth, not the effective one.

## Incidental — for [207](../../207-nphies-reopening-a-refused-request.md)

`GET auth/AuthJson/{id}` **exists** (`AuthController.cs:590`). 207's premise that it is absent from
[198](../../198-nphies-proxy-contract.md)'s fifteen is right about the proxy, but the endpoint itself
is already there to proxy — 207 need only decide whether to.
