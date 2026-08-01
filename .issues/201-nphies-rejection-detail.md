---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: —
---

# 201 — What a status is, and what "the details in case of rejection" shows

## Question

The brief asks for the auth list "with the status, and check the details in case of rejection". The
WPF source does not have a status field — it has **seven** overlapping ones, and no screen that
explains a rejection. This ticket decides what the web actually shows.

**The raw material** (`NphiesAuthForListDto`, surfaced through `NphiesAuthForListViewModel`):
`ClaimProcessingCodes` (`"Complete"` / other), `AdjudicationOutcome` (`approved` / `partial` /
`rejected` / `not-required`), `Queued`, `Error`, `Cancelled`, `NeedComm`, `IsDispensed`, plus
`Result`, `StatusCode`, `ErrorMessageShort`, `Disposition` and `ProcessNote`. WPF's entire treatment
of this is a **background colour** (`NphiesAuthForListViewModel.Background`, line 183):

- red — `Cancelled || Error`
- orange — `Queued || NeedComm`
- cadet blue — `ClaimProcessingCodes == "Complete"`
- white — anything else

Note what that colour ramp does *not* say: a **rejected** authorization and an **approved** one are
the same blue. The pharmacist-facing question — "can this be dispensed?" — is answered nowhere on
the row; it is re-derived in `CreateInvoice()` and `Dispense()` as a five-clause predicate
(`ClaimProcessingCodes == "Complete" && ClaimType is 0 or 2 or 3 or 4 or 6 && !Cancelled &&
AdjudicationOutcome is "approved" or "partial" or "not-required"`).

Decide:

1. **The status vocabulary.** Collapse those seven fields into the set of states a human recognises,
   and name them. This is a `/domain-modeling` act — the words go in `CONTEXT.md`. `partial` and
   `not-required` are both "dispensable" and neither is "approved"; a state model that hides that
   distinction will mislead, and one that surfaces all seven raw fields will not be read.
2. **Whether the row says "ready to dispense".** The web screen's stated purpose is leaving an
   authorization *ready for the pharmacist*. If that predicate is not on the row, the screen does
   not do its job — but it is a **client-side re-derivation of a rule the till also owns**, which
   means two copies that can drift. Decide whether it belongs on the row, and if so whether the
   predicate should move server-side.
3. **What the rejection detail is.** Candidates, in ascending cost: the header's `Disposition` +
   `ProcessNote` + `ErrorMessageShort`; the per-line detail from `auth/AuthResponse/{id}` (where
   `Benefit == 0` marks a refused line, alongside `ApprovedQuantity`); and the payer's
   **communication** thread (`auth/Communications/{id}`), which is where a payer states what it
   wants. Establish which of these carries the reason a human needs — if the answer is the
   communication thread, that pulls a whole flow into scope and
   [199](199-nphies-scope-of-acts.md) must hear about it.
4. **What a *failed* row means.** `Error`, `Queued` and `Retry` describe a request that never
   reached the payer, which is a different kind of bad news from a payer refusal. Confirm the screen
   distinguishes them; conflating "we could not ask" with "they said no" is the mistake this ticket
   exists to prevent.
5. **Eligibility's own outcome.** Smaller but parallel: `IsEligible`, `Coverage`, `SiteEligibility`
   (`OutsideNetwork` / `Eligible` / `NotDirectBilling` / other) and the multi-coverage case where a
   patient has several policies and one must be chosen. WPF renders this as two mutually-exclusive
   visibility flags (`ShowSuccess` / `ShowError`) and buries `SiteEligibility` inside a throwing
   guard (`CheckSiteEligibility`, line 1233) that fires only when a *later* button is pressed.

## Answer

**Two columns, not seven fields and not one word.** A Nphies act carries two independent facts and
the screen shows them as two columns, the same pair on both the authorization list and the
eligibility list:

| Column | Question it answers | Auth values | Eligibility values |
|---|---|---|---|
| **Request** | did we get an answer at all | `Cancelled` · `Failed` · `Pending` · `Complete` | same four |
| **Verdict** | what did they say | `Approved` · `Partly approved` · `Rejected` · `No approval needed` | `Eligible` · `Not in force` · `Not eligible` |

Verdict is **blank until Request is Complete** — a request that never reached the payer has no
verdict to report, and the blank cell is the honest rendering of that. Request derives from
`Cancelled` / `Error` / `Queued` / `ClaimProcessingCodes`; auth Verdict from `AdjudicationOutcome`
(`approved` / `partial` / `rejected` / `not-required`).

The single collapsed state column was considered and **rejected by the requester**: precedence
ordering would have to hide one axis behind the other, and the two facts are asked about
separately. Four columns was rejected as width the screen cannot spend.

**`NeedComm` and `IsDispensed` are markers on the row, not columns.** Neither is a value of either
axis: `ProcessCommRequest.cs:107-108` shows the payer sets `NeedComm` asynchronously on an
authorization whose `ClaimProcessingCodes` may already be `Complete`, and `IsDispensed` is a fact
from after the verdict, owned by the till. The payer-query marker is **required**, not decorative —
[199](199-nphies-scope-of-acts.md) rules that a `NeedComm` authorization *stalls on the web*, so an
agent must be able to see that the row now needs WPF.

**The row does not assert "ready to dispense".** The reader's rule is visible without one:
Request = `Complete`, Verdict ∈ {Approved, Partly approved, No approval needed}, no dispensed
marker. Two facts settled this. First, the predicate is **already server-side and authoritative** —
`AuthService.Dispense()` (`AuthService.cs:1691-1726`) enforces not-cancelled/queued/errored,
`ClaimProcessingCodes == "Complete"`, outcome in approved/partial/not-required, **no follow-up**,
not already dispensed, plus a 3-day window for claim types 3/4 (both of which fall away under
[199](199-nphies-scope-of-acts.md)'s claim-type-0-only v1). WPF's client copy is a *second* copy; a
browser copy would be a **third**. Second, and decisively, that copy could not be faithful:
`HasFollowUp` is **not a field on `AuthForListDto`**, so a browser-side derivation would say
"ready" on rows the service will refuse. A truthful flag would need a computed `Dispensable` field
added to the **Nphies service** — a different repo and team, not carried by
[198](198-nphies-proxy-contract.md)'s estimate. Not spent: the columns already say it, and the till
remains the only place that rules on dispensability, which is where [196](196-nphies-to-web-map.md)
already put it.

**There is no rejection view — the detail always shows the reason.** The material was assumed
expensive and is not. `NAuthLine.BenefitReason` is **not a code**: `ProcessAuthResponse.cs:139-146`
takes the payer's `BenefitReasonCode`, resolves it against the NPHIES `AdjudicationReason` code
system and stores the `Display` text (250 chars). Alongside it, per line: `AdjudicationOutcome`,
`ApprovedQuantity`, `Rejected` (an amount), `Benefit`, `Copay`, `Eligible`. All of it is on
`AuthLineDto`, inside `auth/AuthResponse/{id}` — **already in [198](198-nphies-proxy-contract.md)'s
proxied set**. So the auth detail carries per-line *Verdict / Approved qty / Rejected / Reason* as
ordinary columns, with a header block of `Disposition` + `ProcessNote` when the payer sent them, and
a rejection needs no separate act or surface — it is simply a detail where those columns are
populated. This also covers the case the brief forgets: a **partial**, where the header says
approved and individual lines were refused.

**Question 3's expensive branch is closed: the communication thread is not the rejection reason.**
`auth/Communications/{id}` is not needed and stays unproxied; no endpoint is added, and the whole
flow it would have pulled in stays where [199](199-nphies-scope-of-acts.md) put it — out of v1.

**`ErrorMessageShort` is a trap, and the Request column defuses it.** The field carries two
different things depending on which kind of bad news occurred: `ProcessAuthResponse.cs:53-65` fills
it from the transport error codings, and *only if that left it empty* does line 120 fill it with
`GetAdjudicationOutcomeDisplay` — the decoded adjudication outcome. One field, two meanings; a
neutral "Message" label would re-conflate exactly what this ticket exists to keep apart. The rule:
**Request state picks the label and the source.** Failed/Pending ⇒ render it under a failure label
("Could not reach the payer") and show no verdict material at all. Complete ⇒ **never render it**;
the payer's words come from `Disposition` + `ProcessNote` + per-line `BenefitReason`, which are
unambiguous. The ambiguity never reaches the screen because the field is only read in one branch.

**Eligibility gets the same two axes, and site eligibility is part of the verdict.** Verdict =
`Eligible` / `Not in force` / `Not eligible`, with `NotInForceReason` occupying the same reason slot
`BenefitReason` occupies on the auth. `SiteEligibility` (`OutsideNetwork` / `Eligible` /
`NotDirectBilling`) **qualifies the verdict inline at result time** — "Eligible · outside network" —
rather than staying buried in WPF's `CheckSiteEligibility` guard, which throws only when a *later*
button is pressed. The agent learns it when it is discovered, not as a surprise at the end.

**Multi-coverage: auto-select on one, explicit pick on more than one — keyed on the count, not on
in-force.** The machinery is smaller than feared: the service's coverage-selection code is
**commented out** (`AuthService.cs:300-305`, `AuthBundle.cs:65`), the auth request carries no
`CoverageId` but a **`MemberId`** (`AuthRequest.cs:13`), and the eligibility bundle is replayed
wholesale from `NEligibilityJson`. So "choose a policy" is "choose which member id the auth is
raised under". The eligibility detail lists every coverage with its `MemberId`, `InForce`, network,
plan, class and policy holder. **Exactly one coverage ⇒ auto-selected, no picker** — the 99% case
costs no click, and a lone *expired* coverage is still auto-selected because the Verdict column is
what tells the agent it is `Not in force`. **Two or more ⇒ the agent must pick before submit, with
no default.**

**Estimate effect.** Net **downward**. No new endpoint (the communication thread is not needed), no
Nphies-service change (no `Dispensable` field), no second surface (no rejection view), and no code
system decoding in the browser — `BenefitReason` and `ErrorMessageShort` arrive as display text. The
costs added are two status columns with a derivation each, two row markers, a per-line reason column
on the detail, and a coverage picker that only appears above one coverage.

**Handed to [203](203-nphies-screen-shape.md):** whether the Request state governs which acts a row
offers (Failed ⇒ Retry, Pending ⇒ Status check, Complete ⇒ Cancel) or every row offers every act and
the server refuses. Ruled a layout question by the requester, not a vocabulary one.

Vocabulary added to `CONTEXT.md`: **Request state**, **Verdict**, **Payer query**.

## Comments

**2026-07-31, from [198](198-nphies-proxy-contract.md) — question 4 has its answer from the
service's own source, and the raw material is now readable.** The Nphies service is on disk at
`C:\Work\DMSCO\nphies\Service\NphiesService\`, so this ticket no longer has to infer the state
machine from the WPF viewmodel.

The "we could not ask" vs "they said no" distinction this ticket exists to protect is **already
explicit in the service**: `AuthResponse.Success` is set from `nAuth.Error`
(`Features/Auth/AuthService.cs:734-739`) — a transport/processing failure — while a payer refusal
comes back `Success = true` with the verdict in `AdjudicationOutcome` / `Outcome` / `Disposition` /
`ProcessNote`. 198 has already ruled that the proxy carries them differently: a failure becomes a
**business error** with a readable message, a rejection stays **data in a success envelope** and must
*render*, never toast. So question 4's answer is fixed at the seam; what remains for this ticket is
how the row and the detail *say* it.

Two constraints on question 3's cost: `auth/AuthResponse/{id}` and `auth/Communications/{id}` are
both reachable — the former is already in 198's proxied set, the latter is **not**, so choosing the
communication thread as the rejection detail adds an endpoint (and, per the map's fog, a whole flow).
