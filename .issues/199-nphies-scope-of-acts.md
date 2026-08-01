---
type: wayfinder-ticket
wayfinder: grilling
map: 196
status: done
blocked-by: —
---

# 199 — Which acts and which claim types the web actually raises

## Question

"Two functions — check eligibility and authorization request" is the brief, but the WPF module does
not have two functions. `NphiesAuthRequestController` alone raises **six claim types** and **five
request types**, and the surrounding controllers add a dozen more acts. Before anything can be
sized, the scope has to be a list.

**The claim-type axis** (`SelectedClaimType.Type`, seen throughout):

| Type | Meaning | Notes from the source |
|---|---|---|
| 0 | Prior authorization | The main flow. |
| 1 | Claim | Gated on `POSCommon.IsNphiesDemo` — never runs in production today. |
| 2 | Advance prior auth | Has its own update flow (`UpdateAdvance`), quantity ceiling, and a clinical-edit gate at dispense time. |
| 3 | Direct dispense | `NphiesEligibilityController.OK()`. Skips authorization entirely. |
| 4 | Direct claim / offline auth | `NphiesOfflineAuthController` (1100 lines, not among the four named). |
| 6 | BUPA-SABIC | OTC-number lookup against a different service. |

**The request-type axis** (`NphiesClaimRequestTypeEnum`): `None`, `WithReferenceToEligibility`,
`WithReferenceToAuth` (this is *follow-up*), `WithReferenceToOfflineAuth`,
`WithReferenceToOfflineEligibility`.

**Acts on the two list screens**, separated from the till acts already ruled out of scope:

- Eligibility list: search, display a past response, new, **new-with-reference** (prefill from a
  previous response).
- Auth list: search, display, **check status** (`Auth/StatusCheck`), **retry** (`Auth/Retry`),
  **follow-up** (a fresh auth referencing the old one), **cancel** (`Auth/Cancellation`),
  **update advance**, **update auth from eligibility** (`Auth/UpdateAuthFromEligibility` — re-runs
  eligibility against an existing authorization), and the **communication** loop
  (`NeedComm` → `auth/Communication`, where the payer has asked for more information).

Decide, for each: **v1, later, or never.** The audience answer already rules out dispensing — but
"make the auth ready for the pharmacist" implies at minimum that a rejected or queried authorization
can be *chased* from the web, which pulls follow-up and possibly communication in.

Two forced questions:

- **Is type 1 (Claim) in scope at all,** given it is demo-only in WPF and explicitly disabled in
  production (`NphiesAuthResponsesController.Search()` forces `isClaims = false` on Production)?
- **Do direct dispense (3) and offline/direct claim (4) belong to the till rather than the web?**
  Both bypass the authorization the pharmacist is waiting for, so both may be out of scope by the
  same reasoning that removed dispensing.

The answer is the scope list every other ticket sizes against, so it must be explicit enough that a
reader can say "that act is not in v1" without re-deriving it.

## Answer

**v1 is one claim type, one request type, and nine acts.** The requester's strategy governed every
ruling: *build the smallest thing the team can react to, show it, then plan the rest.* So the
question was consistently "does v1 break without this?", not "is this worth having".

The two dominant findings — both structural, both saving more than the features they drop:

1. **Both mode dropdowns leave the screen.** With one claim type and one request type, there is no
   `SelectedClaimType` picker, no request-type picker, no branch in the request-builder, and no
   "which kind is this row" column on the list. WPF's `NphiesAuthRequestController` spends much of
   its `Show()` block enabling, hiding and forcing those two combos (lines 809–847); none of that
   comes across.
2. **Nothing in v1 is hand-typed identity.** Direct auth is out, so the patient block on the auth
   form is *always* prefilled read-only from an eligibility. One form shape, no hand-entry
   validation, and no way to mistype a member id at a national exchange.

### The claim-type axis — v1 is type 0 alone

| Type | | Ruling | Why |
|---|---|---|---|
| **0** Prior authorization | | **v1** | The effort. |
| **1** Claim | | **never** | Demo-only in WPF, force-disabled in production; [198](198-nphies-proxy-contract.md) already ruled `Auth/Claim` not ported at all. |
| **2** Advance prior auth | | **later** | Requester's call: **not dead, needed later.** Its `UpdateAdvance` flow and quantity ceiling go with it. |
| **3** Direct dispense | | **never** | It *is* the till act — skips authorization, ends in a dispense. Out by the same reasoning that removed dispensing. |
| **4** Direct claim / offline auth | | **later** | 1 100 lines in a fifth controller; bypasses the authorization the pharmacist waits for. Not a till act though — offline auth is a back-office chase — so deferred, not killed. |
| **6** BUPA-SABIC | | **later** | A different service and an OTC lookup, forking request-building for one payer. |

### The request-type axis — a constant, not a control

Every value except one belongs to something cut: `WithReferenceToAuth` is follow-up (later),
`WithReferenceToOfflineAuth` is what direct auth forced (out), `WithReferenceToOfflineEligibility`
and `WithoutReference` belong to types 4 and 6 (later), `None` was direct-auth-in-demo.

**v1 sends `WithReferenceToEligibility`, always.** Recorded as a decision, not left as a derivation,
so nobody rebuilds the picker "for completeness". (The enum is six-valued, not five as the question
assumed — `_Enums.cs:8`.)

### Population variants — the map's "Variant flows" fog empties here

- **Bahrain — out of scope.** Ten branch sites across both controllers (different id type, optional
  member id, different coverage selection, offline approval number, even a different XAML view at
  `NphiesAuthRequestView.xaml.cs:21`). It is a *deployment* fork, not a user choice; this screen is
  for the Saudi back-office. If Bahrain ever needs it, that is a second effort with its own testing.
- **Vitality — out of scope.** Every use in the two list controllers is commented out
  (`//if (SelectedReceiver.CustomerID == "0001100102" && IsVitality)`); only two live branches
  remain in the eligibility controller. It is being retired; porting it would port uncertainty.
- **Exception prescription — IN v1.** The source misleads here: its whitelist gate
  (`NphiesEligibilityController.cs:866`) and its daily-max skip (`POSController.cs:15096`) both sit
  inside the **direct-dispense** path, and `SubDocumentType = "EXCEPTION"` is a retail-document
  field — all three died with claim type 3 and the till. What it actually means (requester):
  **one group for all items** instead of a per-line category. So it reduces to a checkbox, a boolean
  on the request body (persisted as `NAuth.ExceptionPrescription`, `AuthService.cs:165` — no FHIR
  branch reads it), and a grouping rule that is *cheaper* than the per-line path it replaces. It
  therefore lands next to [197](197-nphies-pricing-machinery.md)'s `InsuranceItemCategory` change:
  with the flag on, that field isn't needed per line.

### The eligibility screen — three acts

**Search · display a past response · new check.**

**New-with-reference is dropped, superseded rather than deferred.** It was row-driven prefill
(`NewWithRefCommand` → `WithRef` → `response = RefResponse`, `NphiesEligibilityController.cs:637`).
The web replaces it with a **patient-id-driven Fill** on the new-check form, reading
`Eligibility/LastEligibility/{patientId}` — already among [198](198-nphies-proxy-contract.md)'s
proxied endpoints. Better: it works from a cold form, not only from a selected row. Passed to
[203](203-nphies-screen-shape.md) as a shape input.

### The auth screen — six acts

| Act | Endpoint | Ruling |
|---|---|---|
| Search | `auth/AuthResponses` | **v1** |
| Display | `auth/AuthResponse/{id}` | **v1** — [201](201-nphies-rejection-detail.md) owns what it shows |
| Check status | `Auth/StatusCheck` | **v1** — without it the screen is a dead log; also 198's fallback when a 100 s submit times out |
| Retry | `Auth/Retry` | **v1** — the paired half of the timeout story |
| Cancel | `auth/Cancellation` | **v1** — already proxied by 198 |
| Clinical-edit validate | `Auth/ClinicalEditValidate` | **v1** — see below |
| Follow-up | `Auth/Auth` + `Auth/HasFollowUp` | **later** |
| Communication | `auth/Communications/{id}`, `POST auth/Communication` | **later** |
| Update auth from eligibility | `Auth/UpdateAuthFromEligibility` | **later** |
| Update advance | — | **later** (with claim type 2) |

**The line drawn: v1 lets an agent submit one authorization and see it through; it does not let them
negotiate with the payer.** Follow-up and communication are both negotiation.

**The accepted consequence, ruled explicitly by the requester:** an authorization the payer answers
with `NeedComm` **stalls on the web** — the agent sees it, finishing it stays on WPF. Acceptable
*provided the list shows the `NeedComm` state honestly* rather than hiding it. That is a constraint
on [201](201-nphies-rejection-detail.md).

**Clinical edit is a submit-time gate, not a dispense-time one** — the question implied otherwise.
`NphiesAuthRequestController.cs:1393` calls it immediately before building the request, returning
restrictions typed `F` (fatal) / `W` (warning) (`ClinicalEditRestrictionTypeConstants`). Only the
*advance* claim type's check sat at dispense. Whether a `W` blocks or asks for confirmation is
[203](203-nphies-screen-shape.md)'s call, not scope.

### Corrections this ticket makes to the map and to 198

- **[198](198-nphies-proxy-contract.md) grows by one: `Auth/Retry` → fifteen proxied endpoints.**
  The only place this ticket adds cost; everything else subtracts. `Auth/HasFollowUp`,
  `auth/Communication(s)` and `Auth/UpdateAuthFromEligibility` stay unproxied.
- **Follow-up and advance-update are not endpoints.** `AuthController` has no `FollowUp` and no
  `UpdateAdvance` — both are `Auth/Auth` again with a different request type / claim type. They cost
  request-building and screen states, never proxy surface. Worth knowing when they are picked up.

### The v1 sentence

*A back-office or call-centre agent runs a check-eligibility for a patient (prefilling from that
patient's last check), raises one prior authorization from it, and then watches, status-checks,
retries or cancels it from a list — with no mode selectors, no hand-typed patient identity, and no
way to answer a payer who asks for more information.*
