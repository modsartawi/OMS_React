# The Nphies web API — frozen contract v1.0

> Asset of [209](../../209-nphies-web-spec.md), map [196](../../196-nphies-to-web-map.md).
> Frozen 2026-08-01.
> **This document is the single source of truth for both tracks.**
> Client track: `oms-react` `features/nphies/` — tickets
> [210](../../210-core-owns-the-latest-state-guard.md)–[221](../../221-reopening-replays-and-reports.md).
> Server track: SIS.Api — BackOffice
> [912](C:\Work\DMSCO\BackOffice\.issues\912-nphies-web-door.md)–[922](C:\Work\DMSCO\BackOffice\.issues\922-nphies-conformance-fixtures.md),
> eleven tickets each citing this document by section, following the map-126 precedent (BackOffice
> 875–878 against [the call-centre contract](../136-cc-contract/CONTRACT.md)). **Conformance is
> [922](C:\Work\DMSCO\BackOffice\.issues\922-nphies-conformance-fixtures.md)** — §10's twelve
> fixtures are what stop this document becoming something two tracks each believe they implement.
> Change it only through [§8 Revision protocol](#8-revision-protocol).

All field names below were read from the Nphies service's own source at
`C:\Work\DMSCO\nphies\Service\NphiesService\NphiesService\` on 2026-08-01, not inferred. Where this
document names a DTO it is that DTO.

---

## 0. The laws

Everything below is a consequence of these. If an example and a law disagree, the law wins.

1. **The client sends intent, never money.** No verb accepts a price, an extended price, a VAT
   amount, a discount or a total. The agent's *five inputs* ([§4](#4-the-authorization-line--one-owner-per-field))
   are inputs to a computation, not the computation's result. Amounts are one-way: engine → client,
   display only.
2. **The authorization is an engine document.** A web-raised authorization is a real `NphiesAuth`
   transaction on the Till Submission Platform, driven verb by verb, because the audit trail must
   show *what the engine landed versus what the agent changed*. There is no "assemble a payload and
   POST it" path, and adding one would defeat the reason the screen exists.
3. **Every mutating session verb returns the whole `NphiesAuthSessionState`.** No delta protocol, no
   client-side patching. `State` exists for refresh, recovery and reload only.
4. **The client renders the latest state and never an older one.** Every state carries `version` and
   `etag`; the ordering rule is [§2.1](#21-which-state-may-be-rendered) and it is shared code, not a
   per-feature reimplementation.
5. **Three kinds of bad news, and only one of them is an error.** A payer rejection is **data** and
   renders. A guardrail refusal is a **business outcome** with a machine code. A transport failure is
   the error. Collapsing any two of these is a contract violation
   ([§6](#6-error-taxonomy)).
6. **A submit timeout means in flight, never failed.** The client's only permitted response is to
   offer a status check. It must never resubmit, and no code path may be written that does.
7. **SIS.Api stamps identity; the browser never sends it.** Distribution channel, user id, staff id
   and source code are server-stamped. `ProviderCode` is the single exception — it is operator input
   ([§1.3](#13-what-sisapi-stamps-refuses-and-pins)).
8. **The acting store is the pricing plant**, bound once at `Open` and immutable for the life of the
   transaction. It never appears in the NPHIES payload and it decides every amount in it.
9. **The transaction is the draft, and there are no drafts.** Leaving abandons. Nothing is resumable;
   anything that escapes `Abandon` is swept server-side.
10. **Every response carries `contractVersion`.** Unknown fields are ignored by rule; a major
    mismatch is a client hard stop.

---

## 1. Transport, door, and shape

| | |
|---|---|
| **Tag / prefix** | `Nphies/*` — one tag, one filter, one probe. Extends the existing `NphiesEndpoints.cs` |
| **Auth** | Cookie session. `UaSessionEndpointFilter` stamps `UserId`/`StaffId` from `session.UserId` |
| **Grant** | **One** `NphiesGrantEndpointFilter` over the whole surface — no read/write split, no per-audience matrix ([200](../../200-nphies-identity-and-context.md)) |
| **Envelope** | The universal `HttpGeneralResponse<T>`. All client access through `src/core/api.ts` per `.claude/rules/api-envelope.md` |
| **Upstream** | The Nphies service at `Nphies:BaseUrl` (prod `:8065`, staging `:8077` planned, dev `localhost:5000`) via the registered `NphiesHttpService`. **Environment is server config, never a client concern** |
| **Timeout** | Explicit **100 s** on the submit leg; the named client configures none today and must |
| **Async** | SIS.Api is async all the way down. WPF's `.Result` / `.GetAwaiter().GetResult()` pattern does not come across |

> ⚠ **What ships today**, verified 2026-08-01: `NphiesEndpoints.cs` maps **exactly one** route —
> `POST Nphies/CheckEligibility` — with `ApiKeyEndpointFilter` and **no grant filter at all**.
> `NpihesHttpService` (the filename is misspelled upstream) has three methods: `CheckEligibility`,
> `AuthResponse`, `LinkAuth`. Everything else in this document is new. Closing the missing grant is
> part of the first slice, not a later hardening pass.

### 1.1 The passthrough table — 16 endpoints

Acts and lookups pass through. **The two lists do not** — they are re-modelled in SIS.Api, because
the upstream reads take 20 000 rows with the ordering commented out ([§3.3](#33-the-two-lists)).

| # | Verb | SIS.Api | Upstream | Shape |
|---|---|---|---|---|
| 1 | checkEligibility | `POST Nphies/CheckEligibility` | `Eligibility/CheckEligibility` | `EligibilityRequest` → `EligibilityResponse` |
| 2 | lastEligibility | `GET Nphies/LastEligibility/{patientId}` | `Eligibility/LastEligibility/{patientId}` | → `LastEligibilityModel` |
| 3 | eligibilityList | `GET Nphies/EligibilityResponses` | `eligibility/EligibilityResponses` | **re-modelled** |
| 4 | eligibilityDetail | `GET Nphies/EligibilityResponse/{id}` | `eligibility/EligibilityResponse/{id}` | → `EligibilityResponse` + coverages |
| 5 | authList | `GET Nphies/AuthResponses` | `auth/AuthResponses` | **re-modelled** |
| 6 | authDetail | `GET Nphies/AuthResponse/{id}` | `auth/AuthResponse/{id}` | → `AuthHeaderDto` |
| 7 | statusCheck | `POST Nphies/StatusCheck` | `Auth/StatusCheck` | `{ reference }` |
| 8 | retry | `POST Nphies/Retry` | `Auth/Retry` | `{ referenceId, referenceType, storeCode, staffId }` |
| 9 | cancel | `POST Nphies/Cancellation` | `auth/Cancellation` | `{ reference, reasonCode, claimType, nullify, staffId, providerCode }` |
| 10 | clinicalEditValidate | `POST Nphies/ClinicalEditValidate` | `Auth/ClinicalEditValidate` | → findings, typed `F`/`W` |
| 11 | payers | `GET Nphies/Payers` | `core/payers` | lookup |
| 12 | providers | `GET Nphies/Providers` | `core/providers` | lookup, `IsBlocked == false` filtered upstream |
| 13 | codeSystem | `GET Nphies/CodeSystem` | `core/codeSystem` | lookup — selection reasons live here |
| 14 | diagnoses | `GET Nphies/Diagnoses` | `core/diagnoses` | lookup |
| 15 | morphs | `GET Nphies/Morphs` | `core/morphs` | lookup |
| 16 | access | `GET Nphies/Access` | — | `{ canOpenNphies: boolean }` — SIS.Api only, no upstream |

**Reconciliation with [198](../../198-nphies-proxy-contract.md):** that ticket said fourteen, then
fifteen after `Auth/Retry`. The enumeration here is **sixteen** because the lookups are five rather
than four and `auth/Cancellation` was named in the prose but never counted, plus the access probe
which is SIS.Api's own. The day figure is unaffected — these are the same near-identical handlers,
and 198's cost table already priced "14 endpoints + the grant filter" as 2.5 days combined.

**Never proxied**, and this list is normative: `Auth/Claim`, `Auth/HasFollowUp`,
`auth/Communications/{id}`, `POST auth/Communication`, `Auth/UpdateAuthFromEligibility`,
`auth/AuthJson/{id}`, `hidp/*`, `PaymentController/*` in full, and every `[FromForm]` upload
(`Auth/UploadAuthRequest` and siblings). Attachments ride as base64 inside the submit body, so the
multipart family buys nothing.

### 1.2 The session verb table — 11 verbs

All `POST`, all under `Nphies/Session/*`, all carrying `{ transactionId, requestId }` and all
returning `NphiesAuthSessionState` except where noted.

| Verb | Route | Additional body | Returns |
|---|---|---|---|
| open | `Nphies/Session/Open` | `{ eligibilityId, memberId }` | `OpenResult` |
| state | `Nphies/Session/State` | *(GET, `?transactionId=`)* | `NphiesAuthSessionState` |
| addItem | `Nphies/Session/AddItem` | `{ itemNumber, qty }` | state |
| changeQty | `Nphies/Session/ChangeQty` | `{ lineId, newQty }` | state |
| voidLine | `Nphies/Session/VoidLine` | `{ lineId }` | state |
| setHeader | `Nphies/Session/SetHeader` | `{ serviceDate?, diagnoses[]?, exceptionPrescription?, daysSupplyDefault?, reasonForVisit? }` | state |
| setInsurance | `Nphies/Session/SetInsurance` | `{ g1: {rate, max, paid}, g2: {…}, g3: {…} }` | state |
| updateLineInsurance | `Nphies/Session/UpdateLineInsurance` | `{ lineId, maxPayerShare }` | state |
| updateLineMeta | `Nphies/Session/UpdateLineMeta` | `{ lineId, daysSupply?, selectionReason? }` | state |
| submit | `Nphies/Session/Submit` | `{ attachments[] }` — see [§3.5](#35-submit) | `SubmitResult` |
| abandon | `Nphies/Session/Abandon` | — | `AbandonResult` |

> **This table resolves [208](../../208-nphies-the-auth-is-an-engine-document.md)'s "roughly eight".**
> That ticket named seven and estimated eight; [205](../../205-nphies-who-computes-the-money.md)
> added three, giving eleven. The eleventh named here is **`setHeader`** — the diagnoses, the
> exception-prescription flag and the days-supply default have to reach
> `PosTransactionInsurance` somehow, and no earlier ticket said how. If the server track
> prefers to fold it into `setInsurance`, that is an additive revision, not a redesign.

**`updateLineInsurance` runs on every scan**, not only on an agent override: the category → G1/G2/G3
assignment is server-side (`ResolveDeductibleGroupForLine`) and fires as each line lands. The verb is
exposed because the agent may *also* override the cap.

**Not verbs, deliberately:** attachments (they ride on `submit` — [§3.5](#35-submit)), item search
(the existing item lookup is reused, not re-doored), and anything resembling `replaceLine` or a price
override — law 1.

### 1.3 What SIS.Api stamps, refuses, and pins

| Value | Rule |
|---|---|
| `distributionChannel` | **Pinned to `"20"`.** Never accepted from the body. `"21"` is Bahrain, out of scope — and the WPF "inconsistency" [200](../../200-nphies-identity-and-context.md) went looking for turned out to be correct |
| `UserId` / `StaffId` | Stamped from `GetUserAction()`; the session filter sets both claims from `session.UserId` |
| `SourceCode` | The constant **`'WEB'`**. ⚠ Confirm the column takes three characters — `NAuthMap.cs:104` maps it unlengthed and it has only ever held store codes |
| `ClaimType` | Pinned to **`0`** (prior authorization). v1 has one claim type |
| `ClaimRequestType` | Pinned to **`WithReferenceToEligibility`**. The enum is six-valued; every other value belongs to something deferred or dropped |
| `ProviderCode` | **The exception — operator input, passed through unvalidated.** The Nphies service is the authority (`EligibilityService.cs:375` throws `"Provider doesn't configured!"`), so that refusal is one more business outcome |
| `ExtendedPrice == 0` | **Refused by SIS.Api before the upstream call.** Required, not defensive: `AuthService.cs:450` computes `Factor = Amount / ExtendedPrice` and a decimal divide-by-zero throws, failing the whole submission with an unhandled exception and leaving an orphan header |
| `ActualPatientShare` | Rounded to **2dp** by the client before it is sent. The service rounds seven money fields and **not this one** — and it is the only per-line amount the payer adjudicates |
| `Factor` | **Omitted.** The service overwrites it unconditionally. Sending it is harmless and pointless |

---

## 2. `NphiesAuthSessionState` — the projection the whole form renders

```jsonc
{
  "contractVersion": "1.0",
  "transactionId": "01JC8…",           // engine ULID, 26 chars
  "version": 14,                        // blind-incremented on every engine save
  "etag": "a3f1…",                      // identifies one state; see §2.1
  "status": "open",                     // open | submitted | abandoned
  "plant": "1101",                      // the acting store, bound at Open, IMMUTABLE (law 8)

  "reference": {                        // fetched from the eligibility at Open, read-only forever
    "eligibilityId": "…",
    "memberId": "…",                    // the chosen coverage — this IS the policy choice
    "patientId": "…", "patientName": "…", "patientGender": "…", "patientBirthDate": "…",
    "patientIdType": "…",
    "payerCode": "…", "providerCode": "…",
    "policyNumber": "…", "policyStartDate": "…", "policyEndDate": "…", "policyHolder": "…"
  },

  "header": {
    "serviceDate": "2026-08-01",
    "diagnoses": [ { "code": "C50.9", "type": "principal", "description": "…", "morphology": "…" } ],
    "exceptionPrescription": false,
    "daysSupplyDefault": 30,
    "reasonForVisit": "…"
  },

  "insurance": {                        // editable — inherited from the coverage, then correctable
    "g1": { "rate": 20, "max": 500, "paid": 0 },
    "g2": { "rate": 30, "max": 500, "paid": 200 },
    "g3": { "rate": 100, "max": 0,  "paid": 0 }
  },

  "lines": [
    {
      "lineId": "…", "sequence": 1, "voided": false,
      "itemNumber": "…", "itemDescription": "…",
      "quantity": 2,                                  // agent
      "unitPrice": 25.00, "extendedPrice": 50.00,     // engine, read-only
      "amount": 50.00, "netAmount": 47.50, "vat": 7.13,
      "discountPercentage": 5, "discountAmount": 2.50,
      "actualPatientShare": 9.50,                     // engine — the only adjudicated money
      "deductibleG": 9.50,                            // engine, ours only
      "deductibleGroupName": "Generic",               // == InsuranceItemCategory (§4)
      "maxCoverage": 0,                               // engine default, agent-overridable
      "daysSupply": 30,                               // agent
      "selectionReason": "…",                         // derived, agent-overridable
      "selectionReasonEditable": false,               // false on Generic lines ONLY
      "pricing": "settled"                            // settled | pending — drives the ⟳ in the grid
    }
  ],

  "submitBlockers": [ { "code": "NO_ATTACHMENTS", "message": "…" } ],
  "replayed": false                                   // true when a retried requestId was not re-applied
}
```

### 2.1 Which state may be rendered

Two requests in flight, the slow one lands second, and the basket goes backwards on screen. The rule
that prevents it is **shared code in `core/`**, moved there by
[210](../../210-core-owns-the-latest-state-guard.md) from the call-centre console — it is one rule
and there will not be two copies of it:

- No current state → the incoming state applies.
- **Higher** `version` → applies.
- **Equal** `version`, **same** `etag` → idempotent; the current state is kept **by identity**, so a
  replay costs no re-render.
- **Equal** `version`, **different** `etag` → **the incoming state applies.** Version *orders* states;
  the etag *identifies* one. A server that changed the state without advancing its counter is
  disagreeing with itself, and the newly arrived state is the door's own answer to a verb the agent
  just performed.
- **Lower** `version` → **discarded.**
- `contractVersion` major mismatch → **client hard stop**, before any state is admitted.

### 2.2 What the agent may change, and what they may not

**In:** header deductible rates and caps · header paid-outside · line quantity · line Max Coverage ·
line Days Supply · Selection Reason · void a line · the diagnoses · exception prescription.

**Out, and there is no verb for any of them:** item swap or replace · unit price · discount ·
extended price · patient share · the calculated deductible · the deductible group · the plant.

*The agent corrects the insurance terms, never the merchandise or its price.*

### 2.3 Two rules stated where they apply

- **A duplicate item is refused at `addItem`**, with the quantity control named as the remedy. WPF
  refuses at submit (`ValidateDuplicateItems`); moving the rule to the scan means the agent fixes it
  while looking at it. `ITEM_ALREADY_ON_REQUEST` ([§6](#6-error-taxonomy)).
- **Days Supply is validated 1–100 at the cell**, client-side, and rejected by
  `updateLineMeta` server-side. One range replaces WPF's three (180/90/100), which deletes its
  submit-time sweep rather than porting it — and the web can never hand the service a value it throws
  on (`AuthService.cs:405-409`).

---

## 3. The acts

### 3.1 `checkEligibility`

`POST Nphies/CheckEligibility` → upstream `Eligibility/CheckEligibility`.

Body is `EligibilityRequest` verbatim: `EligibilityPurpose`, `ProviderCode`, `PayerCode`,
`PatientId`, `PatientIdType`, `PatientGender`, `PatientName`, `PatientBirthDate`, `MemberId`,
`Transfer`, `Newborn`, `Occupation`, `MaritalStatus`. `HidpReference` is **always null** — HIDP is
out of scope.

`ProviderCode` is a **free per-act pick** with no default and no memory: submit is blocked until the
agent chooses. Providers get blocked upstream and the service already filters
`IsBlocked == false`, so WPF's disabled-combo-holding-null trap cannot occur.

Response is `EligibilityHeaderResponse` + `EligibilityCoverageResponse[]`. The two axes are derived
per [§5](#5-the-two-status-axes); `SiteEligibility` (`OutsideNetwork` / `Eligible` /
`NotDirectBilling`) **qualifies the verdict inline at result time** — "Eligible · outside network" —
rather than being buried in a guard that throws when a later button is pressed.

### 3.2 `lastEligibility` — the Fill button

`GET Nphies/LastEligibility/{patientId}` → `LastEligibilityModel`.

Fills the identity block on a **cold** form from that patient's last check. This supersedes WPF's
row-driven `NewWithRefCommand` rather than deferring it: it works from a patient id alone, not only
from a selected row.

### 3.3 The two lists

**These are the only two endpoints SIS.Api re-models rather than proxies**, and it is the only
genuinely new server logic in the passthrough. Upstream returns `Take(20000)` with the ordering
commented out; SIS.Api owns **sort, page and total**.

```
GET Nphies/EligibilityResponses ?providerCode &payerCode &patientId
                                &fromDate &toDate &showAll
                                &page &pageSize &sort
GET Nphies/AuthResponses        ?claimType &providerCode &payerCode &patientId &preAuthRef
                                &fromDate &toDate &showAll
                                &page &pageSize &sort
```

Both return `{ rows[], total, page, pageSize }`.

🚩 **`showAll` must be `true` on the authorization list.** `AuthService.cs:1377` filters
`if (!showAll) → Where(c => !c.Error)`, so a refused authorization is **invisible** without it — and
[221](../../221-reopening-replays-and-reports.md)'s reopen affordance on a row nobody can see is
worth nothing. This is the single easiest thing in the effort to get silently wrong.

`claimType` is pinned to `0` by SIS.Api, not sent by the browser.

**The client's default window is the last 7 days**, rendered as a *removable chip* — the visible
window is what actually tames the bulk read, and a silently truncated list reads as "that's
everything". The provider filter defaults to **all** providers and therefore does **not** narrow the
underlying read.

Row shape is `AuthForListDto` / the eligibility equivalent, projected to what the grid shows:
identity, both axes ([§5](#5-the-two-status-axes)), `NeedComm` and `IsDispensed` as **markers**, and
the timestamps.

### 3.4 The two details

`GET Nphies/AuthResponse/{id}` returns **`AuthHeaderDto`** — not the thin submit DTO — with
`AuthLines` and `AuthSupportingInfos` eagerly fetched. Per line it carries
`AdjudicationOutcome`, `ApprovedQuantity`, `Rejected`, `Benefit`, `Copay`, `Eligible` and
**`BenefitReason`**, which is **already decoded display text** (the service resolves the payer's
`BenefitReasonCode` against the NPHIES `AdjudicationReason` code system and stores the 250-char
`Display`). Header carries `Disposition` and `ProcessNote`.

**So there is no rejection view to build.** The ordinary detail always carries per-line verdict,
approved quantity, rejected and reason — which also covers the **partial**, where the header says
approved and individual lines were refused. No new endpoint, no second surface.

**Two known gaps**, both priced and not taken: `MaxCoverage` is on `NAuthLine` but **absent from
`AuthLineDto`**, so a prefill sourced from here loses that one override; and `NAuthDiagnosis` is
**dead code** (entity present, both DTOs commented out, never written), so diagnoses round-trip as
the header `Diagnosis` string plus per-line `Diagnosis` / `DiagnosisIndex` and the client owns
parsing its own encoding back.

Attachments come back as base64 on `AuthSupportingInfoDto.Attachment` **whether the client renders
them or not** — so showing what the payer was sent costs no endpoint and no server change, and the
proxied response carries every attached megabyte either way ([§3.5](#35-submit) explains why that
matters).

### 3.5 `submit`

`POST Nphies/Session/Submit` with `{ transactionId, requestId, attachments[] }`.

The request body sent upstream is **built server-side from the transaction** — the browser does not
assemble an `AuthRequest`. Law 2.

**Attachments ride here, in the submit body**, not in a session verb and not through an upload
endpoint:

```jsonc
"attachments": [
  { "sequence": 1, "title": "Prescription", "contentType": "image/jpeg", "attachment": "<base64>" }
]
```

- **Title is a closed 7-value select**, no free-text escape — the value reaches the payer verbatim and
  a typo at a national exchange is a data-quality defect. Values: `Id` (National ID / Iqama — keeps
  WPF's wire value) · `Prescription` · `Medical report` · `Lab result` · `Radiology report` ·
  `Insurance card` · `Referral letter`.
- **Duplicates are allowed.** Two prescriptions are two prescriptions; `Sequence` already
  distinguishes the rows. This is the *opposite* of [§2.3](#23-two-rules-stated-where-they-apply)'s
  duplicate-item refusal, and correctly so — a duplicate engine line really does collide.
- **The type dropdown does not exist.** The browser derives `contentType` from the file's MIME.
- **Images are canvas-downscaled to a 2000 px longest edge at JPEG q0.85** before base64 — a 6 MB
  phone photo becomes ~250 KB. PDFs pass through untouched and are **refused over 5 MB** at the
  picker. There is no configured size limit in either hop and the column is `NVARCHAR(MAX)`; the only
  ceiling is the un-configured ~28.6 MB default, so the downscale is what keeps a 100 s synchronous
  submit honest.
- **At least one attachment is mandatory** — `GeneralValidation()` refuses any non-advance
  authorization without one, and v1 is claim type 0 only. The client makes this a **form state**
  (banner + Submit disabled), not a submit-time throw.

Submission is **synchronous at 100 s**. Three outcomes — see [§7.3](#73-submitresult).

**Before it runs**, the client calls `clinicalEditValidate` ([§3.7](#37-clinicaleditvalidate)). It is
a *submit*-time gate, not a dispense-time one.

### 3.6 `statusCheck`, `retry`, `cancel`

| Act | Body | Offered on |
|---|---|---|
| statusCheck | `{ reference }` | `Pending` |
| retry | `{ referenceId, referenceType, storeCode, staffId }` | **`Pending`** |
| cancel | `{ reference, reasonCode, claimType, nullify, staffId, providerCode }` | `Complete`, not dispensed |

🚩 **Retry belongs to `Pending`, not to `Failed`.** `AuthService.RetryAuth` (`:1155`) re-POSTs the
**stored request JSON verbatim** and runs `ProcessPendingAuth` on the answer, refusing an
already-dispensed authorization. It means *"ask again with the same payload, take the newer answer"*
— which is meaningless for a request the exchange never accepted.
[201](../../201-nphies-rejection-detail.md)'s `Failed ⇒ Retry` line is superseded and this contract
carries the correction.

**No browser polling.** The service runs `PollRequestWorker`, a `BackgroundService` looping every
**15 seconds** over every unblocked provider on channel `20`, so a `Pending` authorization becomes
`Complete` on its own — the normal path to a verdict is *waiting*. The client offers a manual
**Refresh** with the load time stated beside it, and sets no `refetchInterval` anywhere. These three
acts are the manual escalations for a row that has waited too long.

### 3.7 `clinicalEditValidate`

`POST Nphies/ClinicalEditValidate` → findings, each typed `F` (fatal) or `W` (warning) per
`ClinicalEditRestrictionTypeConstants`.

The client renders **one dialog in two shapes**: a warning lists the restrictions with
`Back to the form` / `Submit anyway`; a fatal is the same surface with the confirm button removed.

### 3.8 The lookups

Five straight passthroughs. `codeSystem` carries the selection reasons
(`ValueSetConstants.SelectionReason`). `providers` is already filtered to unblocked upstream.

**No item-picker change exists in this contract.** `InsuranceItemCategory` rides the *engine line*,
not the lookup response, so [197](../../197-nphies-pricing-machinery.md)'s second server change is
priced at zero and dropped.

### 3.9 Reopen — the journal row

`GET Nphies/AuthRequestJournal/{authId}` (SIS.Api-internal; no upstream call).

Reads `PosIntegrationAttempt.RequestJson` where `SubmissionReference == authId`.
`IntegrationAttemptLog.StartAsync` writes it on a **fresh connection, committed before the payer is
called**, so it survives a refusal, a rejection and a transport failure alike — and it is
`StringMaxType`, so [§3.5](#35-submit)'s attachments ride inside it. **No new table, column or
write.**

It is the only source that covers a **header-only** refusal: the service's own guards (unknown item
`:402`, item with no Nphies category `:514`, unconfigured provider `:576` / payer `:581`,
prescription ref over 40 chars `:219`) throw **before the lines are built** at `:562`.

**A reopen is a replay, not a restore.** The client opens a *fresh* session and replays through
verbs that already exist — **no new session verb** — and **reports what did not come back**. An item
may since have been blocked or repriced; a scan that refuses is the information the agent needs, and
a silent restore would hand them a request quietly different from the one they think they are
resending.

---

## 4. The authorization line — one owner per field

`AuthItemRequest` as the service actually defines it. **Nineteen fields**, not the fifteen
[197](../../197-nphies-pricing-machinery.md) counted before the builder was read.

| Field | Owner | Reaches NPHIES? | Note |
|---|---|---|---|
| `Sequence`, `ItemNumber` | session | yes | engine line identity |
| `Quantity` | **agent** | yes | `changeQty` |
| `UnitPrice`, `ExtendedPrice`, `Amount`, `NetAmount`, `Vat` | engine | yes | priced at the plant = acting store |
| `DiscountPercentage`, `DiscountAmount` | engine | — | never agent-set |
| `Factor` | **omitted** | yes | service recomputes as `Amount / ExtendedPrice` |
| `ActualPatientShare` | engine | **yes** | `DeductibleValue` — **the only per-line money the payer adjudicates**. Client rounds 2dp |
| `DeductibleG` | engine | **no** | `CalculatedDeductible` — stored on `NAuthLine` for the dispensing till |
| `DeductibleGroupName` | engine | **no** | **IS `InsuranceItemCategory`** — same value, two names. Carries `Generic`/`Brand`/`Brand-IR`/`NonMed`, *not* the G1/G2/G3 bucket it reads like |
| `MaxCoverage` | engine, **agent-overridable** | **no** | `MaxPayerShare` — for the till's read-back |
| `ServiceDate`, `Diagnosis` | header | yes | stamped down onto every line |
| `DaysSupply` | **agent** | **yes** | `days-supply` supporting-info, referenced by `InformationSequence` |
| `SelectionReason` | derived, **agent-overridable** | **yes** | `extension-pharmacist-Selection-Reason` |

**Three of the money fields never reach NPHIES.** `MaxCoverage`, `DeductibleG` and
`DeductibleGroupName` are stored on `NAuthLine` and stop there — their audience is the **dispensing
till**, which reads them back to price the dispense the same way the request was priced. Getting them
wrong is a mispriced dispense later, not a rejected claim. Different failure, different test.

**Two quirks carried deliberately, not fixed:**

- On a `Brand-IR` line the agent may pick a selection reason and the service **overwrites it at
  submit** with `"innovative-noGeneric"` (`AuthService.cs:418-421`); it also blanks the field entirely
  when `nItem.RemoveSelectionReason`. WPF behaves identically. Reproduce it, or someone will "fix" it
  and change what reaches the payer.
- **A `MaxPayerShare` of 0 will not apply.** SIS.Pos 26.4.64 ignores `<= 0` in
  `UpdateLineInsuranceInternalAsync`, so the till's `AllowZero = true` semantics silently do nothing
  under the new engine. The client **says so in the cell** rather than accepting a value that will not
  take effect.

**Header money** is `DeductibleG1/G1Max/G1Paid` through `G3` on `AuthRequest` — nine fields, all
agent-editable, all inherited from the coverage first. One rate edit re-prices the whole basket
through the engine (`UpdateDeductible` never touches `request.Items`), so line amounts stay derived.

**Paid-outside is persisted** in a new `PaidAmount DECIMAL(18,2) NOT NULL DEFAULT 0` column on
`PosTransactionDeductibleGroup`, with the coverage's own cap in `MaxAmount`. The engine receives a
cap already reduced by paid-outside, so a stored `MaxAmount` of 300 cannot distinguish *a 300 cap*
from *a 500 cap with 200 already spent* — and the agent's input is precisely the part that would
vanish. That is a direct hit on law 2.

---

## 5. The two status axes

The same pair on both lists and both details.

| Column | Question | Auth values | Eligibility values |
|---|---|---|---|
| **Request** | did we get an answer at all | `Cancelled` · `Failed` · `Pending` · `Complete` | same four |
| **Verdict** | what did they say | `Approved` · `Partly approved` · `Rejected` · `No approval needed` | `Eligible` · `Not in force` · `Not eligible` |

Request derives from `Cancelled` / `Error` / `Queued` / `ClaimProcessingCodes`; auth Verdict from
`AdjudicationOutcome` (`approved` / `partial` / `rejected` / `not-required`).

**Verdict is blank until Request is `Complete`.** A request that never reached the payer has no
verdict to report, and the blank cell is the honest rendering of that.

**`NeedComm` and `IsDispensed` are markers, not axis values.** The payer sets `NeedComm`
asynchronously on an authorization whose `ClaimProcessingCodes` may already be `Complete`, and
`IsDispensed` is a fact from after the verdict, owned by the till. The payer-query marker is
**required**: answering it is out of v1, so such an authorization *stalls on the web* and the agent
must be able to see the row now needs WPF.

🚩 **`ErrorMessageShort` is a trap, and the Request state defuses it.** The field carries a transport
error *or* the decoded adjudication display, depending on branch (`ProcessAuthResponse.cs:53-65`
fills it from transport codings; **only if that left it empty** does `:120` fill it from
`GetAdjudicationOutcomeDisplay`). The rule:

- `Failed` / `Pending` → render under a **failure** label ("could not reach the payer").
- `Complete` → **never render it at all.** The payer's words come from `Disposition`, `ProcessNote`
  and per-line `BenefitReason`.

A neutral "Message" label would re-conflate exactly what the two axes exist to keep apart.

**The row never asserts "ready to dispense."** The predicate is already authoritative in the
service's `Dispense()` and its `HasFollowUp` clause is **absent from `AuthForListDto`**, so a browser
copy could only lie. The reader infers it: `Complete` + a good verdict + no dispensed marker.

🚩 **`Failed` means the request was refused before the payer saw it**, and it has **two sources** —
NPHIES's own validation, and the service's local guards ([§3.9](#39-reopen--the-journal-row)). Either
way it is a **form state the agent fixes in place**, not a transport blip. A `Complete` + `Rejected`
is the opposite: the payer's final word, and the remedy is a new authorization.

---

## 6. Error taxonomy

Three kinds, and only the third is an error (law 5).

**Kind 1 — a payer rejection is DATA.** HTTP 200, envelope `success: true`, the verdict in
`AdjudicationOutcome` (`AuthService.cs:734-739`). It **renders**; it must never toast.

**Kind 2 — a guardrail refusal is a business outcome.** Non-2xx carrying the envelope with
`success:false`, a human `message` (server-supplied, passed through as data — no i18n key) and
`errors[0].errorCode`. `core/api.ts` maps this to `ApiError(kind:'business')`; `apiErrorCode()` is
how the client branches.

| Code | HTTP | Meaning / client action |
|---|---|---|
| `NPHIES_NOT_GRANTED` | 403 | The grant probe failed. Nav leaf hidden, in-page backstop |
| `SESSION_BUSY` | 409 | Claim collision. Auto-retry with `retryAfterMs`, bounded |
| `NOT_YOUR_SESSION` | 403 | The transaction belongs to another agent. Hard stop |
| `SESSION_CLOSED` | 409 | `reason: submitted \| abandoned \| swept`. Stale tab; return to the list |
| `ITEM_ALREADY_ON_REQUEST` | 409 | [§2.3](#23-two-rules-stated-where-they-apply). The refusal **names the quantity control** as the remedy |
| `ITEM_NOT_FOUND` | 404 | Unknown item number |
| `ITEM_NO_NPHIES_CATEGORY` | 409 | The item has no insurance category — upstream `AuthService.cs:514` |
| `NO_PRICE_AT_PLANT` | 409 | The item does not price at the acting store |
| `ZERO_EXTENDED_PRICE` | 400 | [§1.3](#13-what-sisapi-stamps-refuses-and-pins). **Required guard** — without it the upstream throws div-by-zero and orphans a header |
| `QTY_INVALID` | 400 | Zero, negative, or beyond the cap |
| `DAYS_SUPPLY_INVALID` | 400 | Outside 1–100 |
| `LINE_NOT_FOUND` | 404 | Stale screen |
| `PROVIDER_NOT_CONFIGURED` | 409 | Upstream `EligibilityService.cs:375`. The provider is operator input, so this is reachable |
| `PAYER_NOT_CONFIGURED` | 409 | Upstream `AuthService.cs:581` |
| `PRESCRIPTION_REF_TOO_LONG` | 400 | Over 40 chars — upstream `:219` |
| `SUBMIT_BLOCKED` | 409 | A `submitBlockers` entry still holds. Carries `blockers[]` |
| `CLINICAL_EDIT_FATAL` | 409 | An `F` finding. Not overridable |
| `AUTH_ALREADY_DISPENSED` | 409 | Retry and cancel both refuse a dispensed authorization |
| `DUPLICATE_SUBMISSION` | 409 | Upstream holds a lock on `Auth_{ClaimType}{PatientId}` and answers a bare-string 400; SIS.Api translates it by string match. ⚠ Back-to-back submissions for the **same patient id** collide before reaching the exchange |
| `AUTH_NOT_FOUND` | 404 | Unknown authorization id |
| — | 401 | `auth` kind, handled entirely by `core/api.ts`'s `handle401`; feature code never catches it |

**Kind 3 — transport.** A timeout, a socket failure, a 5xx without the envelope. `ApiError(kind:
'server' | 'network')`.

🚩 **On the submit leg a timeout is `in flight`, not a failure** (law 6). The client's only permitted
response is to offer `statusCheck`. Raising a second authorization for a request that already reached
the payer is the worst outcome this screen can produce, and this rule is the whole of what prevents
it.

**SIS.Api owns every translation.** The upstream answers with bare strings, thrown exceptions and a
blanket catch at `AuthService.cs:743`; none of that shape reaches the browser.

---

## 7. The three non-state results

### 7.1 `OpenResult`

```jsonc
{ "outcome": "opened", "state": { /* NphiesAuthSessionState */ } }
```

`Open` takes `{ eligibilityId, memberId }` and binds the plant from the agent's **acting store**
(`StoreSwitcher`) once and forever. **Shift-less**, per the call-centre device precedent — a browser
has no shift and nothing reads one before submission.

Unlike the call-centre door there is **no `refusedExisting`**: drafts are not resumable, so a second
`Open` simply opens a second transaction. The first is abandoned or swept.

### 7.2 `AbandonResult`

```jsonc
{ "outcome": "abandoned", "transactionId": "01JC8…" }
```

Called on leaving the form. The transaction is VOIDED; a crashed tab is swept after a timeout. No
state is returned — there is nothing left to render. **The client warns before navigating away**,
because leaving genuinely discards the request.

### 7.3 `SubmitResult`

```jsonc
{ "outcome": "submitted", "authId": "…", "preAuthRef": "…", "state": { /* status:"submitted" */ } }
{ "outcome": "refused",   "authId": "…", "reasons": [ { "lineId": "…|null", "message": "…" } ] }
{ "outcome": "inFlight",  "authId": null }
```

- **`submitted`** — lodged. `MarkSubmittedAsync(authId)` stamps the transaction and the attempt is
  journalled under `"NPHIES_AUTH_REQUEST"`. The client lands on the detail.
- **`refused`** — a `Failed`. **The agent stays on the form**, with each reason attached to the row or
  field that caused it. `lineId: null` is a header-level reason, which is the header-only case
  [§3.9](#39-reopen--the-journal-row) describes.
- **`inFlight`** — the 100 s window elapsed. **Not a failure** (law 6).

Submit takes only the transaction id and the attachments. No document, no lines, no amounts — the
upstream `AuthRequest` is built server-side from engine state.

---

## 8. Revision protocol

The contract is **this document**, in `oms-react`, linked from every BackOffice issue on the effort.

- **Every response carries `contractVersion` (`"major.minor"`).** The client checks it on the first
  response of a session.
- **Additive changes** — a new optional field, a new error code — bump the **minor** and land by
  either track editing this document. Clients **ignore unknown fields by rule**, so an additive change
  can ship server-first.
- **Breaking changes** — a removed or renamed field, a changed meaning, a changed status code — bump
  the **major**, require an owner ruling, and land as a dated entry in
  [§9 Amendments](#9-amendments), appended, never rewritten in place.
- **Major mismatch is a client hard stop**: the form refuses to run and asks to be updated rather than
  mis-rendering money at a national exchange.
- **Conformance is the enforcement.** The server track owes a fixture suite over
  [§10](#10-fixtures), serialized from real responses and diffed against committed fixtures.
- Expect **one deliberate revision after first integration**, when the provisional fixtures are
  replaced by captures. One event, not a negotiation.

---

## 9. Amendments

| Version | Date | Change | Kind | Ruled by |
|---|---|---|---|---|
| 1.0 | 2026-08-01 | Frozen. | — | [209](../../209-nphies-web-spec.md) |

---

## 10. Fixtures

The server track owes serialized captures of these. Each is a scenario the client has a test for, so
a drift shows up on both sides at once.

1. **An eligible check, one coverage** — auto-selected, no picker.
2. **An eligible check, three coverages** — the pick is forced, no default.
3. **A not-in-force check** — verdict populated, `NotInForceReason` present.
4. **An eligible-but-outside-network check** — `SiteEligibility` folded into the verdict inline.
5. **A session through its whole life** — open → add → **duplicate refused** → changeQty → void →
   setInsurance → updateLineInsurance → updateLineMeta → submit → submitted.
6. **A refused submit with per-line reasons** — the `Failed` form state.
7. **A refused submit with header-only reasons** — no lines built; only the journal row can prefill.
8. **A submit that times out** — `inFlight`, and the status check that resolves it.
9. **An authorization list page** — both axes, both markers, `showAll=true`, a refused row **present**.
10. **An authorization detail with a partial approval** — some lines approved, some rejected, each
    with decoded `BenefitReason`, plus attachments returned as base64.
11. **A clinical-edit `W` and an `F`** — the two shapes of one dialog.
12. **A `DUPLICATE_SUBMISSION` collision** — two submissions for the same patient id back to back.

> ⚠ **Fixture 12 has a testing hazard.** The upstream holds a lock on `Auth_{ClaimType}{PatientId}`,
> so any test suite that resubmits for the same patient id back to back will collide with a
> bare-string 400 rather than reaching the exchange. Vary the patient id across scenarios, or the
> suite will test the lock instead of the path.
