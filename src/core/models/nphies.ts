/**
 * The Nphies wire shapes (spec 209, frozen contract v1.0 §1.1 / §3.1 / §3.2).
 *
 * Every field name below is the camelCase of a property on a DTO the Nphies
 * service actually defines — `Features/Eligibility/Dtos/EligibilityRequest.cs`,
 * `EligibilityResponse.cs`, `EligibilityCoverageResponse.cs`,
 * `Models/LastEligibilityModel.cs` and `Features/Core/Dtos/ProviderDto.cs`, read
 * on 2026-08-01. Nothing here is inferred: a screen built against a guessed shape
 * fails the day the endpoint lands, and it fails silently on exactly the fields
 * that were guessed.
 *
 * ⚠ The acts these describe pass **through** SIS.Api (contract §1.1: "acts and
 * lookups pass through"), so the DTO the browser sees is the service's own.
 */

/** `GET Nphies/Access` (contract §1.1 #16) — SIS.Api's own probe, no upstream. */
export interface NphiesAccessResult {
  canOpenNphies: boolean
}

/**
 * `GET Nphies/Providers` (§1.1 #12) → `ProviderDto`. **Already filtered to
 * `IsBlocked == false` upstream** (`CoreService.GetProviders`), which is why the
 * client never re-filters and WPF's disabled-combo-holding-null trap cannot occur.
 *
 * There is no display name on this DTO — the code IS what the agent picks, with
 * the license as the only distinguishing detail beside it.
 */
export interface NphiesProvider {
  providerCode: string
  providerId: string
  license: string
}

/**
 * `POST Nphies/CheckEligibility` body (§3.1) — `EligibilityRequest` verbatim.
 *
 * 🚩 `hidpReference` is **always null** (§3.1: HIDP is out of scope) and is
 * therefore absent from this type rather than present-and-nulled: a field the
 * screen cannot set is one nobody has to wonder about.
 *
 * 🚩 No `distributionChannel`, no user id, no staff id, no source code — law 7:
 * SIS.Api stamps identity and the browser never sends it. `providerCode` is the
 * single exception, and it is operator input (§1.3).
 */
export interface EligibilityCheckRequest {
  eligibilityPurpose: string
  providerCode: string
  payerCode: string
  patientId: string
  /** `NI` · `PRC` (Iqama) · `PN` · `Other` — `NphiesTypes/PatientIdType.cs`. */
  patientIdType: string
  /** `male` · `female`, lowercase — `NphiesTypes/GenderType.cs`. */
  patientGender: string
  patientName: string
  /** ISO `yyyy-MM-dd`. The DTO's type is a non-nullable `DateTime`. */
  patientBirthDate: string
  memberId: string
  transfer: boolean
  newborn: boolean
  occupation: string
  maritalStatus: string
}

/**
 * One policy the patient holds — `EligibilityCoverageResponse`. 213 is the ticket
 * that makes the agent pick between two of these; 211 only ever lists them under
 * the answer.
 */
export interface EligibilityCoverage {
  id: string
  sequence: number
  coverageId: string
  memberId: string
  subscriberId: string
  network: string
  coveragePlan: string
  coverageClass: string
  coverageGroup: string
  policyHolderName: string
  inForce: boolean
  benefitStart: string
  benefitEnd: string
  periodStart: string
  periodEnd: string
}

/**
 * `POST Nphies/CheckEligibility` response (§3.1) — `EligibilityResponse`, i.e.
 * the `EligibilityHeaderResponse` fields plus `Coverages`.
 *
 * The two axes are **derived** from this, never read off it: see
 * `@/core/nphies/status`. `isEligible` is the service's own
 * `Success && Inforce && Coverage` (`EligibilityService.cs:278`).
 */
export interface EligibilityCheckResponse {
  id: string
  eligibilityPurpose: string
  providerCode: string
  payerCode: string
  patientId: string
  patientIdType: string
  patientGender: string
  patientName: string
  patientBirthDate: string
  actionDateTime: string
  /**
   * 🚩 The dual-meaning field of §5's trap, on the eligibility side. Rendered
   * only under a failure label, and only when the Request state is not
   * `Complete` — see `showsFailureMessage` in `@/core/nphies/status`.
   */
  errorMessage: string
  inforce: boolean
  outcome: string
  disposition: string
  notInForceReason: string
  success: boolean
  coverage: boolean
  coverageId: string
  network: string
  class: string
  statusCode: number
  isEligible: boolean
  /** NPHIES `siteEligibility` code system — `eligible` | `outside-network` | … */
  siteEligibility: string
  transfer: boolean
  newborn: boolean
  occupation: string
  maritalStatus: string
  coverages: EligibilityCoverage[]
}

/**
 * The envelope both **re-modelled** lists answer with (§3.3:
 * "Both return `{ rows[], total, page, pageSize }`").
 *
 * 🚩 These two endpoints are the only ones SIS.Api re-models rather than proxies,
 * and this shape is why: upstream returns `Take(20000)` with the ordering
 * commented out, so **sort, page and total are SIS.Api's** and a browser that
 * paged the raw read would be paging a truncation. `total` is the true match
 * count, not the page's length — reading `rows.length` as a total is the exact
 * defect ticket 148 fixed on the Ua Users grid.
 *
 * Generic because 214's authorization list takes the identical envelope over a
 * different row.
 */
export interface NphiesPage<TRow> {
  rows: TRow[]
  total: number
  /** 1-based, echoed back — the page the server actually served. */
  page: number
  pageSize: number
}

/**
 * One row of `GET Nphies/EligibilityResponses` (§1.1 #3, §3.3) — "the eligibility
 * equivalent" of `AuthForListDto`.
 *
 * Every field below is one the service's own list projection actually selects
 * (`EligibilityService.GetEligibilityResponses`, `EligibilityService.cs:1003-1032`,
 * read 2026-08-02), mapped to its `EligibilityResponse` name. The projection is
 * narrower than the check response in two ways that matter:
 *
 * - **`notInForceReason` is NOT selected**, so the list cannot say *why* a policy
 *   is out of force — that stays the detail's (213). It is absent here rather
 *   than optional: a field the row never carries is one nobody should reach for.
 *   `actionDuration` is absent for the mirror reason — the projection sets it on
 *   the *entity*, but `EligibilityResponse` (the DTO the rows are mapped to) has
 *   no such property, so it never reaches the wire.
 * - **`outcome` is not a column at all.** `NEligibility` has no such property; the
 *   value is read off the live FHIR bundle and discarded. It is declared optional
 *   because SIS.Api re-models this row and may project one, and because
 *   `deriveEligibilityAxes` reads a stored row correctly without it — see the
 *   flag in `@/core/nphies/status`.
 *
 * `coverages` are likewise absent: the list read never fetches them.
 */
export interface EligibilityListRow {
  id: string
  eligibilityPurpose: string
  providerCode: string
  payerCode: string
  patientId: string
  patientIdType: string
  patientGender: string
  patientName: string
  patientBirthDate: string
  /** When the check was run. The list's sort key — newest first (§3.3). */
  actionDateTime: string
  /** ⚠️ Not persisted — see the note above. Present only if SIS.Api projects one. */
  outcome?: string
  success: boolean
  inforce: boolean
  coverage: boolean
  isEligible: boolean
  siteEligibility: string
  /** 🚩 The dual-meaning field again: readable ONLY under a failure label, and
   *  only when the Request state is not `Complete` (§5, `showsFailureMessage`). */
  errorMessage: string
  disposition: string
  statusCode: number
  transfer: boolean
  newborn: boolean
  occupation: string
  maritalStatus: string
}

/**
 * One row of `GET Nphies/AuthResponses` (§1.1 #5, §3.3) — **`AuthForListDto`**,
 * projected to what the grid shows: identity, both axes, the two markers and the
 * timestamps.
 *
 * Every field below is a property of
 * `Features/Auth/AuthsDtos/AuthForListDto.cs` in camelCase, read 2026-08-02.
 * Nothing is inferred and nothing is renamed to read better.
 *
 * 🚩 **There is no patient name on this DTO**, unlike the eligibility row. The
 * authorization list identifies a patient by `patientId` alone, and inventing a
 * name field would be inventing a server shape on the one ticket that warns
 * hardest against it. Logged in `.afk/HITL-214.md`.
 *
 * ⚠️ Absent by choice, not by oversight: `originalId`, `result`, `rowIndex`,
 * `responseSystem`/`responseValue`, `refResponse*`, `invoiceNo`, `userId`,
 * `sourceCode`, `isReferenceToDocument`, `refDocumentNo` and `actionDuration` are
 * all on the DTO and none of them is a thing this list shows. A model field the
 * screen never reads is one a later reader has to wonder about.
 */
export interface AuthListRow {
  id: string
  /** The eligibility this authorization was raised from (§7.1's `Open` body). */
  eligibilityId: string
  providerCode: string
  payerCode: string
  patientId: string
  /** The payer's own reference, and the list's one free-text filter (§3.3). */
  preAuthRef: string
  /** 🚩 Axis one's raw sources — see `AuthAxisSource` in `@/core/nphies/status`.
   *  Never read directly by a screen: `Cancelled` outranks a stored `Complete`. */
  claimProcessingCodes: string
  queued: boolean
  error: boolean
  cancelled: boolean
  /** Axis two's raw source: `approved` · `partial` · `rejected` · `not-required`. */
  adjudicationOutcome: string
  /** 🚩 **Marker, not an axis value** (§5). The payer asked a question, raised
   *  asynchronously — answering it is out of v1, so the row stalls on the web. */
  needComm: boolean
  /** 🚩 **Marker, not an axis value** (§5). The row's end of life, owned by the till. */
  isDispensed: boolean
  dispensedTime: string
  dispensedStore: string
  /** When the request was raised. The list's sort key — newest first (§3.3). */
  actionDateTime: string
  /** When the payer's answer landed. Empty until one does. */
  responseDateTime: string
  serviceDate: string
  /** 🚩 §5's dual-meaning field: a transport error OR the decoded adjudication
   *  display, depending on branch (`ProcessAuthResponse.cs:53-65` vs `:120`).
   *  Readable ONLY under a failure label, and only when the Request state is not
   *  `Complete` — see `showsFailureMessage`. */
  errorMessageShort: string
  /** The payer's own summary. Header-level, and only on a `Complete` row. */
  disposition: string
  statusCode: number
  /** Pinned to `0` by SIS.Api (§3.3) — the browser never sends it and v1 has one
   *  claim type. Present because the row carries it. */
  claimType: number
}

/**
 * The envelope the five **lookups** answer with (§1.1 rows 11–15, §3.8).
 *
 * 🚩 The list is wrapped because law 10 puts `contractVersion` on the **payload
 * model** and a bare JSON array has nowhere to hang it — SIS.Api's own
 * `NphiesLookupResponse<T>` (`Modules/Nphies/Services/Models/Lookups/`, read
 * 2026-08-02), whose doc comment logs the same wrapping as a wanted §3.8
 * clarification. The client reads `items` when it is there and a bare array when
 * it is not, in **one** place (`unwrapLookup` in `@/core/nphies/api`), so the day
 * §3.8 freezes the shape it is a one-line edit rather than a sweep — and so a
 * screen built before the freeze does not silently render an empty picker.
 */
export interface NphiesLookup<TRow> {
  contractVersion?: string
  items: TRow[]
}

/**
 * One row of `GET Nphies/CodeSystem?valueSet=…` (§1.1 #13, §3.8) — the Nphies
 * service's own `CodeSystemDto`.
 *
 * ⚠️ `blocked` really is a **string** upstream, not a boolean; it is carried as
 * declared, because a lookup that "fixes" a type is no longer a passthrough.
 *
 * The value set is the caller's. 215 reads `TaskReasonCode` (the cancellation
 * reasons); 218's per-line picker reads `SelectionReason` from the same door.
 */
export interface NphiesCodeSystemEntry {
  code: string
  display: string
  blocked: string
  valueSetName: string
}

/**
 * `POST Nphies/StatusCheck` (§1.1 #7, §3.6) — the body is `{ reference }`, and
 * `reference` is the **authorization id**: `CancellationService.cs:108` matches it
 * as `c.Id == requestModel.Reference`, and the status check's own leg does the
 * same. It is not the preauth reference the payer quotes.
 */
export interface AuthStatusCheckRequest {
  reference: string
}

/**
 * What a status check answers — the upstream's `StatusCheckResponse` forwarded
 * whole.
 *
 * 🚩 **`success: false` here is NOT a failure.** The upstream sets it only when
 * the exchange's task came back `Completed` (`StatusCheckService.cs:155`), so a
 * check on an authorization the payer is still working answers `success: false`
 * with a `status` — which is the ordinary answer of the act's own use case, a row
 * that has waited too long. It is **data** (§6 kind 1) and it renders. Reading it
 * as an error would report the normal path as a fault.
 */
export interface AuthStatusCheckResult {
  /** 🚩 Law 10's field, present on every response of the web door. It is read for
   *  display-free purposes only: 211 settled that the client neither sends nor
   *  *checks* a contract version until §8 says how. */
  contractVersion?: string
  id: string
  reference: string
  providerCode: string
  payerCode: string
  patientId: string
  actionDateTime: string
  errorMessage: string
  outputType: string
  /** The exchange task's own status — the value that makes the act worth offering. */
  status: string
  disposition: string
  adjudicationOutcome: string
  success: boolean
  statusCode: number
}

/**
 * `POST Nphies/Retry` (§1.1 #8, §3.6). The upstream body is
 * `{ referenceId, referenceType, storeCode, staffId }` and **the browser owns
 * exactly one of the four** (law 7 / §1.3): SIS.Api pins `referenceType` to
 * `"Auth"` (v1 has one claim type) and stamps `staffId` from `GetUserAction()` and
 * `storeCode` from the session's acting store. Sending them would be the browser
 * asserting an identity, so they are absent from this type rather than
 * present-and-ignored.
 */
export interface AuthRetryRequest {
  referenceId: string
}

/**
 * What a retry answers: a flag and a string.
 *
 * The retry's real product is not in this body — `ProcessPendingAuth` has by then
 * rewritten the authorization itself, so the **list is re-read** to see what
 * changed.
 */
export interface AuthRetryResult {
  contractVersion?: string
  success: boolean
  errorMessage: string
}

/**
 * `POST Nphies/Cancellation` (§1.1 #9, §3.6). The upstream body is
 * `{ reference, reasonCode, claimType, nullify, staffId, providerCode }`; the two
 * server-owned fields are absent for the retry's reason — SIS.Api pins `claimType`
 * to `0` and stamps `staffId`.
 *
 * `nullify` is the client's and is always sent **false**: the upstream throws
 * `"Nullify operation is not supported"` (`CancellationService.cs:101`), and
 * SIS.Api forwards the flag as asked rather than downgrading it, so a `true` here
 * would be a refusal by construction.
 *
 * `providerCode` is §1.3's one exception — operator input, passed through
 * unvalidated — and is the row's own, because `CancellationService.cs:109` narrows
 * the lookup by it.
 */
export interface AuthCancellationRequest {
  reference: string
  /** A `TaskReasonCode` code from `GET Nphies/CodeSystem` — the agent's chosen
   *  reason, which reaches NPHIES as the cancel task's `reasonCode` coding. */
  reasonCode: string
  nullify: boolean
  providerCode: string
}

/** What a cancellation answers — the same shape as a status check, upstream's
 *  `CancellationResponse`. */
export type AuthCancellationResult = AuthStatusCheckResult

/**
 * `GET Nphies/LastEligibility/{patientId}` (§3.2) → `LastEligibilityModel` — what
 * **Fill** completes a cold form from. `null` when the patient has never been
 * checked.
 */
export interface LastEligibility {
  id: string
  providerCode: string
  patientId: string
  patientIdType: string
  patientGender: string
  patientName: string
  patientBirthDate: string
  payerCode: string
  transfer: boolean
  newborn: boolean
  occupation: string
  maritalStatus: string
  memberId: string
}
