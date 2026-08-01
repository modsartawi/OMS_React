---
type: wayfinder-ticket
wayfinder: task
map: 196
status: done
blocked-by: —
---

# 206 — Does the Nphies service check the money it is sent

## Question

[197](197-nphies-pricing-machinery.md) answered four of its five questions from source and returned
**"no evidence found, in either direction"** on the fifth: whether the standalone Nphies REST service
prices anything itself, and whether it rejects an authorization whose totals do not reconcile. The
repo cannot answer it — the service is not in it — and the WPF client could not tell you if it did:
`NphiesService.cs:499-504` collapses every non-2xx into one bare `Exception` with no body.

This is the map's one remaining unknown that is settled by **doing**, not deciding, and it constrains
every option in [205](205-nphies-who-computes-the-money.md): a service that reconciles totals means
the web must send engine-computed money and nothing else; a service that stores what it is given
means rounding and override policy is entirely ours.

Probe staging (`http://172.23.27.40:8077/`, dev `localhost:5000`) with `Auth/Auth`. A precise
checklist for whoever holds network access:

1. Submit a well-formed authorization with **consistent** totals — baseline: it is accepted, and what
   comes back (does the response echo the money, or transform it?).
2. Resubmit with `ExtendedPrice` deliberately ≠ `UnitPrice × Quantity`. Accepted or rejected? If
   rejected, capture the **status code and body** — that is the error taxonomy
   [198](198-nphies-proxy-contract.md) has to carry through the proxy.
3. Resubmit with the header `DeductibleG1/G2/G3` not summing to the lines' `DeductibleG`.
4. Submit with the money fields **absent or zero** but the items valid. If it is accepted, the whole
   pricing question is optional-until-the-till and the estimate drops sharply — so this case matters
   most.
5. Note whether the response carries any field the service computed rather than echoed (a benefit, a
   patient share, an adjudication) — that is question 3 of [197](197-nphies-pricing-machinery.md)
   answered by observation.

**Do not probe production.** Record the request/response pairs as an asset under
`.issues/assets/196-nphies/`. If staging is unreachable from this network, say so and record who
owns access — that is itself the answer, and it makes the unknown a stated risk in
[204](204-nphies-the-estimate.md) rather than a silent one.

## Answer

**No. The service does not check the money — not one of its guards touches an amount.** Resolved
**AFK from source**, exactly as the comment below predicted: the ticket was charted as a network
probe and turned out to be a twenty-minute read of
`C:\Work\DMSCO\nphies\Service\NphiesService\NphiesService\`. Full field-by-field table, the complete
guard list and the five checklist items in
[the findings](assets/196-nphies/service-money-checks.md).

`Auth/Auth` is a **transcription layer**. It copies every money field off `AuthItemRequest` onto
`NAuthLine` (`AuthService.cs:423-448`), rounds seven of them to 2dp away-from-zero, recomputes
exactly one — `Factor = Amount / ExtendedPrice` (`:450`) — overrides one non-money field
(`SelectionReason`, from the item master), builds the FHIR bundle from the stored line and POSTs it.
**Whatever the caller sends is what the national exchange sees.** Every `throw` before the POST is
about an item, a provider, a payer, a diagnosis or a prescription reference; none is about an amount.

The four probe cases, answered:

1. **Consistent totals** — accepted; the response transforms nothing of ours. The payer's
   adjudication lands in its own columns (`ProcessAuthResponse.cs:124-179`) and our submitted numbers
   survive untouched beside it.
2. **`ExtendedPrice ≠ UnitPrice × Quantity`** — **accepted silently.** `ExtendedPrice` never leaves
   the service; its only effect is to skew the recomputed `Factor`, which *does* go to NPHIES. The
   failure mode is not a rejection — it is a wrong `factor` on a live claim.
3. **Header deductibles not summing to the lines'** — **accepted silently and unobservable.**
   `DeductibleG1/G2/G3` and line `DeductibleG` have no NPHIES mapping anywhere in the service, and
   the outbound `Claim` carries **no `Total`** at all (`.Total` is read-only, on the response). The
   mismatch cannot even be expressed in the request.
4. **Money zero or absent** — **not accepted, but not checked either.** `ExtendedPrice = 0` throws
   `DivideByZeroException` at `:450`, caught by the blanket handler at `:743` → `Success = false`,
   `"Attempted to divide by zero."`, and the `finally` still persists an `NAuth` header with
   `Error = true` **and no lines**. An accident, not a validation — a zero `Amount` with a non-zero
   `ExtendedPrice` sails through as `Factor = 0`, sent as `1`.
5. **Service-computed fields** — exactly two outbound (`Factor`, `SelectionReason`); everything on
   the way back is the payer's.

**The estimate does not drop, and the "staging unreachable" risk is deleted rather than accepted.**
Step 4 was the case that could have made pricing optional-until-the-till; it does the opposite — zero
money *breaks*, so the web must send real money from day one, and [205](205-nphies-who-computes-the-money.md)'s
engine-computes-everything ruling stands unchallenged **and load-bearing**: no second opinion exists
downstream, so a wrong amount becomes a wrong claim at the national exchange, not an error message.

Three consequences worth carrying into the spec:

- **SIS.Api must refuse `ExtendedPrice = 0` before it reaches `Auth/Auth`**, or the agent sees
  "Attempted to divide by zero" and leaves an orphan header behind. A voided-to-zero or
  free-of-charge line is the realistic trigger. Small, but it is a *required* guard, not a nicety.
- **`ActualPatientShare` is the one adjudicated money field and the service does not round it** —
  whatever precision the engine emits reaches NPHIES verbatim. Parity with the till (WPF passes it
  straight through at `NphiesAuthRequestController.cs:1936`), so not a regression; the web should
  round to 2dp and say so.
- **`Factor`'s omission costs nothing** (confirming 205) provided `ExtendedPrice` and `Amount` are
  both right and `ExtendedPrice` is never zero.

**What was not probed, and why it is no longer a risk.** Whether NPHIES *itself* enforces a
`net = unitPrice × quantity × factor` rule is still unobserved: staging `:8077` was unreachable from
this network on 2026-08-01 (connect timeout) and production `:8065` answers but is off-limits for
submissions — it reaches the live exchange. It matters less than this ticket assumed, because the
production formula is **empirically valid**: WPF has sent `Net = Amount + Vat` with
`Factor = Amount / ExtendedPrice` for years and the exchange accepts it. The web's obligation is to
**reproduce that formula**, not to discover the rule — and a violation surfaces as the `Failed`
state [203](203-nphies-screen-shape.md) already models, which the agent fixes in the form. Recorded
in [204](204-nphies-the-estimate.md) as a bounded assumption, not an open unknown.

**Incidental, for [207](207-nphies-reopening-a-refused-request.md):** `GET auth/AuthJson/{id}`
**exists** (`AuthController.cs:590`). 207 is right that it is absent from
[198](198-nphies-proxy-contract.md)'s fifteen, but the endpoint is already there to proxy — 207 need
only decide whether to.

## Comments

**2026-07-31, from [198](198-nphies-proxy-contract.md) — this ticket's central premise is now false.**
"The repo cannot answer it — the service is not in it" no longer holds: the Nphies service's full
source is on disk at `C:\Work\DMSCO\nphies\Service\NphiesService\` (8 controllers, ~60 endpoints,
`Features/Auth/AuthService.cs` being the submission path). Whoever takes this ticket should **read
before probing** — the money-reconciliation question may be answerable AFK from
`ProcessAddAuthRequest` / `ProcessAuthResponse`, which would turn this from a network-access task
into research with a confirming probe, and remove the "staging unreachable" failure mode from
[204](204-nphies-the-estimate.md)'s risk list.

Two facts from 198 that also land here: **step 2's error taxonomy is already settled** — a payer
rejection returns HTTP 200 with `Success = true` and the verdict in `AdjudicationOutcome`, while
`Success = false` means a transport/processing failure (`AuthService.cs:734-739`); and `Auth/Auth`
holds a lock on `Auth_{ClaimType}{PatientId}`, so **the repeated resubmissions in steps 2–4 must not
reuse the same patient id back-to-back** or they will collide with a bare-string 400 rather than
reaching the exchange.
