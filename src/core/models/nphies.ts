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
 * One supporting info on an authorization (§3.4) —
 * `NphiesAuthSupportingInfoDto`
 * (`Sartawi.Retail.Data\Modules\Nphies\Services\Models\AuthView\`, read
 * 2026-08-02), which is SIS.Api's copy of the Nphies service's
 * `AuthSupportingInfoDto`. Both carry these fields; the SIS.Api one adds
 * `display`, so the client declares it.
 *
 * 🚩 **The collection is not "the attachments".** It also carries the
 * `days-supply`, `reason-for-visit` and `morphology` rows, which have no base64
 * at all — see `submittedAttachments` in the authorizations feature for what
 * separates them.
 *
 * ⚠️ **`attachmentType` is NOT a MIME type**, however much §3.5's submit body
 * spells its counterpart `contentType`. The service stores a two-valued flag —
 * `ProcessAddAuthRequest.cs:216` writes `ContentType.StartsWith("image") ?
 * "image" : "pdf"` and `Extensions.cs:725` reads it back the same way. Logged as
 * a §8 gap in `.afk/HITL-216.md`.
 */
export interface AuthSupportingInfo {
  id: string
  sequence: number
  /** `attachment` · `days-supply` · `reason-for-visit` · `morphology` —
   *  `ClaimInformationCategoryConstants`. */
  category: string
  code: string
  /** Base64. Empty on every supporting info that is not an attachment. */
  attachment: string
  valueString: string
  valueBoolean?: boolean | null
  valueDecimal?: number | null
  /** ⚠️ `image` | `pdf`, not a MIME type — see the note above. */
  attachmentType: string
  /** §3.5's closed 7-value title, as it reached the payer. */
  attachmentTitle: string
  display: string
}

/**
 * One line of the authorization detail (§3.4) — `NphiesAuthLineDto`, read
 * 2026-08-02. Only the fields the detail renders are declared; the DTO's
 * `factor`, `code1`/`code2`, `itemType*`, `submitted`, `deductible`,
 * `unallocDeduct`, `tax`, `patientShare`, `discount`, `supportingInfos`,
 * `diagnosisIndex`, `daysSupplyIndex` and its WPF-leftover `selected` are on the
 * wire and are not things this screen shows.
 *
 * 🚩 **`maxCoverage` is absent, and that is the server's gap, not an omission
 * here.** §3.4: `MaxCoverage` is on `NAuthLine` but **not on `AuthLineDto`**, so
 * a prefill sourced from this response loses that one override (221's problem,
 * priced and not taken).
 *
 * 🚩 **`benefitReason` is already decoded display text** — the service resolves
 * the payer's `BenefitReasonCode` against the NPHIES `AdjudicationReason` code
 * system and stores the 250-char `Display` (`ProcessAuthResponse.cs:139-146`).
 * The browser does **no** code-system lookup; a raw code arriving here is a
 * server-side mapping gap and not something to paper over client-side.
 */
export interface AuthDetailLine {
  id: string
  sequence: number
  itemNumber: string
  itemDescription: string
  quantity: number
  /** Engine, read-only (§4). Display only — law 1. */
  unitPrice: number
  extendedPrice: number
  amount: number
  netAmount: number
  vat: number
  discountPercentage: number
  discountAmount: number
  /** The only per-line money the payer adjudicates (§4). */
  actualPatientShare: number
  /** 🚩 Axis two's raw source **per line**: `approved` · `partial` · `rejected` ·
   *  `not-required`. Never read directly — blank until the HEADER's Request is
   *  `Complete`, which `projectAuthLines` is what enforces. */
  adjudicationOutcome: string
  /** What the payer allowed, which is not what was asked for on a partial. */
  approvedQuantity: number
  /** The refused money on this line. */
  rejected: number
  eligible: number
  copay: number
  benefit: number
  /** 🚩 The payer's reason **in words** — see the note above. */
  benefitReason: string
  serviceDate: string
  daysSupply: number
  selectionReason: string
  deductibleG: number
  /** `Generic` · `Brand` · `Brand-IR` · `NonMed` — IS `InsuranceItemCategory`,
   *  the same value under two names (§4), *not* the G1/G2/G3 bucket it reads
   *  like. */
  deductibleGroupName: string
  diagnosis: string
}

/**
 * `GET Nphies/AuthResponse/{id}` (§1.1 #6, §3.4) — **`NphiesAuthHeaderDto`**,
 * SIS.Api's copy of the upstream `AuthHeaderDto`, with `AuthLines` and
 * `AuthSupportingInfos` eagerly fetched. Read field by field 2026-08-02 from
 * `Sartawi.Retail.Data\Modules\Nphies\Services\Models\AuthView\NphiesAuthHeaderDto.cs`
 * — the DTO the browser actually receives (`NphiesEndpoints.cs:249` answers
 * `AuthResponseForWeb(id)`).
 *
 * 🚩 **There is no `isDispensed` here**, unlike `AuthListRow`. The dispensed
 * marker is a fact of the list row and of the till (§5); this detail cannot show
 * one without inventing a field the endpoint does not answer with, so it does not
 * (`.afk/HITL-216.md`).
 *
 * ⚠️ Declared narrower than the DTO on purpose. Its nine `deductibleG*` header
 * money fields, `preAuthStart`/`preAuthEnd`, `responseSystem`/`responseValue`,
 * `offline*`, `rowIndex`, `result`, `actionDuration`, `commRequest`/
 * `commResponse`, `originalId`, `isReferral`, `internalCustomerId`,
 * `hidpReference`, `newborn*`, `isMaternity`, `occupation`, `maritalStatus`,
 * `isReferenceToDocument`/`refDocumentNo` and `authRef` are all on the wire and
 * none of them is a thing this screen shows. Unknown fields are ignored by rule
 * (law 10), so declaring one the screen never reads only makes a later reader
 * wonder.
 */
export interface AuthDetail {
  /** 🚩 Law 10's field, on every response of the web door. Read for display-free
   *  purposes only: 211 settled that the client neither sends nor *checks* a
   *  contract version until §8 says how. */
  contractVersion?: string
  id: string
  /** The eligibility this authorization was raised from (§7.1's `Open` body). */
  eligibilityId: string
  /** The chosen coverage — **this IS the policy choice** (§2's `reference`). */
  memberId: string
  providerCode: string
  payerCode: string
  patientId: string
  patientIdType: string
  patientName: string
  patientGender: string
  patientBirthDate: string
  /** The payer's own reference — what an agent is quoted on the phone. */
  preAuthRef: string
  /** 🚩 Axis one's raw sources — the same five `AuthAxisSource` names the list
   *  row carries, so `deriveAuthAxes` reads a row and a detail identically. */
  claimProcessingCodes: string
  queued: boolean
  error: boolean
  cancelled: boolean
  adjudicationOutcome: string
  /** 🚩 **Marker, not an axis value** (§5). The payer asked a question; answering
   *  one is out of v1, so the authorization stalls on the web. */
  needComm: boolean
  actionDateTime: string
  /** When the payer's answer landed. Empty until one does. */
  responseDateTime: string
  serviceDate: string
  /** 🚩 §5's dual-meaning field: a transport error OR the decoded adjudication
   *  display, depending on branch. Readable ONLY under a failure label and only
   *  when the Request state is not `Complete` — `failureMessage` is the one place
   *  this ticket reads it. */
  errorMessageShort: string
  /** The payer's own summary. Single-meaning, unlike the field above. */
  disposition: string
  /** The payer's note. Single-meaning, same as the disposition. */
  processNote: string
  statusCode: number
  claimType: number
  /** 🚩 §3.4: `NAuthDiagnosis` is dead code upstream, so diagnoses round-trip as
   *  this header string plus per-line `diagnosis` / `diagnosisIndex`. */
  diagnosis: string
  policyNumber: string
  policyHolder: string
  prescriptionRef: string
  exceptionPrescription: boolean
  authLines: AuthDetailLine[]
  authSupportingInfos: AuthSupportingInfo[]
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
 * One row of `GET Nphies/Diagnoses?query=…` (§1.1 #14) — the Nphies service's own
 * `DiagnosisModel` (`Features/Core/Dtos/DiagnosisModel.cs`, read 2026-08-02),
 * camel-cased by the envelope like every other passthrough.
 *
 * 🚩 **`isNeedMorph` is the authority on the morphology field.** Spec 209 story
 * 44 says the field appears "only when the principal diagnosis is a neoplasm",
 * and *this flag is what the service means by that* — it is a column on
 * `NDiagnosis`, set per code. The client derives nothing from the code string: an
 * ICD range spelled into the browser would be a guessed shape that disagrees with
 * the database the exchange is validated against.
 *
 * ⚠️ **The door is a SEARCH, not a list.** `CoreService.GetDiagnosesAsync`
 * answers `[]` for an empty query and otherwise `Take(500)` of
 * `code StartsWith(query) || description Contains(query)`. So the picker types to
 * search; there is no whole-catalogue read to cache.
 *
 * `isUnacceptedAsPrincipal` and the four restriction fields are declared because
 * they are on the wire — the clinical-edit gate (220) is what reads them.
 */
export interface NphiesDiagnosisLookup {
  diagnosisCode: string
  diagnosisDescription: string
  genderRestriction: string
  genderRestrictionType: string
  ageLow: string
  ageHigh: string
  ageRestrictionType: string
  rareRestrictionType: string
  /** 🚩 This diagnosis requires a morphology code — the neoplasm rule, as the
   *  service itself holds it. */
  isNeedMorph: boolean
  isUnacceptedAsPrincipal: boolean
}

/** One row of `GET Nphies/Morphs?query=…` (§1.1 #15) — the service's `MorphModel`.
 *  A search on the same terms as the diagnoses door: empty query, empty answer. */
export interface NphiesMorphLookup {
  morphCode: string
  morphDescription: string
}

/**
 * One attachment as `submit` carries it — §3.5's body, verbatim:
 * `{ sequence, title, contentType, attachment }`.
 *
 * 🚩 **Attachments are not a verb and not an upload.** They ride inside the
 * submit body as base64 (§1.2: "not verbs, deliberately"), which is why this type
 * lives beside the session models and there is no endpoint anywhere for it.
 *
 * `title` is §3.5's closed seven-value list, `contentType` is derived from the
 * file's own MIME, and `sequence` is what distinguishes two rows carrying the
 * same title — the deliberate opposite of the duplicate-item refusal.
 */
export interface NphiesSubmitAttachment {
  sequence: number
  title: string
  contentType: string
  /** Base64, with no `data:` prefix. */
  attachment: string
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
 * ---------------------------------------------------------------------------
 * The **engine session** (§1.2's eleven verbs, §2's projection) — ticket 217.
 *
 * 🚩 The authorization is an engine document (law 2): a web-raised authorization
 * is a real `NphiesAuth` transaction on the Till Submission Platform, driven verb
 * by verb, because the audit trail must show *what the engine landed versus what
 * the agent changed*. There is no "assemble a payload and POST it" shape anywhere
 * below, and adding one would defeat the reason the screen exists.
 *
 * 🚩 **Every mutating verb answers the WHOLE state** (law 3), so there is exactly
 * one projection type and no delta, patch or partial anywhere in this block.
 * ---------------------------------------------------------------------------
 */

/**
 * Who the request is about and under whose policy — §2's `reference` block.
 *
 * 🚩 **Fetched from the eligibility at `Open`, read-only forever.** It is why the
 * form does not read the eligibility itself: the server does it once, inside the
 * verb that binds it to the transaction, and a second client-side read could
 * disagree with what the engine actually bound.
 *
 * `memberId` **IS the policy choice** — 213's seam carries it because §7.1's
 * `Open` takes it and there is no coverage id in the request.
 */
export interface NphiesSessionReference {
  eligibilityId: string
  memberId: string
  patientId: string
  patientName: string
  patientGender: string
  patientBirthDate: string
  patientIdType: string
  payerCode: string
  /** 🚩 **Inherited, never re-picked** (spec 209 story 25): the check and the
   *  authorization can then never disagree about who is asking. */
  providerCode: string
  policyNumber: string
  policyStartDate: string
  policyEndDate: string
  policyHolder: string
}

/** One diagnosis on the header (§2). 219 is the ticket that captures them; 217
 *  carries the shape because the projection does. */
export interface NphiesSessionDiagnosis {
  code: string
  /** `principal` and its siblings — exactly one principal is 219's structural rule. */
  type: string
  description: string
  morphology: string
}

/** The header the whole request is stamped from (§2, §4's `ServiceDate` /
 *  `Diagnosis` rows). Editable at 219; rendered read-only here. */
export interface NphiesSessionHeader {
  serviceDate: string
  diagnoses: NphiesSessionDiagnosis[]
  exceptionPrescription: boolean
  daysSupplyDefault: number
  reasonForVisit: string
}

/** One deductible group's terms — §2's `insurance.g1|g2|g3`, and §4's nine header
 *  money fields seen from the projection's side. 218's inputs, not 217's. */
export interface NphiesDeductibleGroup {
  rate: number
  max: number
  /** Paid outside — the field a stored cap alone cannot distinguish (§4). */
  paid: number
}

export interface NphiesSessionInsurance {
  g1: NphiesDeductibleGroup
  g2: NphiesDeductibleGroup
  g3: NphiesDeductibleGroup
}

/**
 * One line of the live request — §2's `lines[]`, whose ownership is §4's
 * nineteen-field table.
 *
 * 🚩 **Money is one-way.** `unitPrice` through `actualPatientShare` are the
 * engine's and are display-only (law 1); nothing in this repo sums, totals or
 * derives one of them. The agent's five inputs arrive at 218.
 */
export interface NphiesAuthSessionLine {
  lineId: string
  sequence: number
  /** 🚩 **A voided line is KEPT, not removed** (§1.2's verb table, spec story 31):
   *  the audit trail is the whole point, and "added then voided" is exactly what a
   *  payload of survivors cannot record. */
  voided: boolean
  itemNumber: string
  itemDescription: string
  /** Agent — `changeQty` (§4). */
  quantity: number
  unitPrice: number
  extendedPrice: number
  amount: number
  netAmount: number
  vat: number
  discountPercentage: number
  discountAmount: number
  /** The only per-line money the payer adjudicates (§4). */
  actualPatientShare: number
  /** Engine, ours only — read back by the dispensing till, never sent to NPHIES. */
  deductibleG: number
  /** **IS `InsuranceItemCategory`** — `Generic` · `Brand` · `Brand-IR` · `NonMed`
   *  (§4), *not* the G1/G2/G3 bucket it reads like. */
  deductibleGroupName: string
  /** Engine default, agent-overridable at 218. ⚠️ A `MaxPayerShare` of 0 will not
   *  apply — SIS.Pos ignores `<= 0` — which the cell says at 218. */
  maxCoverage: number
  /** Agent — `updateLineMeta`, validated 1–100 at the cell (218). */
  daysSupply: number
  selectionReason: string
  /** `false` on `Generic` lines ONLY (§2). 218's rule; carried here because the
   *  projection carries it. */
  selectionReasonEditable: boolean
  /** 🚩 What makes a line **price in place** (spec story 27). The engine says so;
   *  the browser never guesses that a price is on its way. Declared as §2's closed
   *  pair rather than a bare string, so a misspelt comparison fails the build
   *  rather than silently rendering every line as settled. */
  pricing: 'settled' | 'pending'
}

/** One reason submit is still held (§2). 218–219 fill the list; 217 renders
 *  whatever the server says without inventing an entry. */
export interface NphiesSubmitBlocker {
  code: string
  message: string
}

/**
 * **The projection the whole form renders** — §2, whole.
 *
 * `version` ORDERS states and `etag` IDENTIFIES one; which of two states may be
 * rendered is `@/core/engine-session/session-state`'s single rule (§2.1), shared
 * with the call-centre console and never re-implemented per feature.
 */
export interface NphiesAuthSessionState {
  /** Law 10's field. A **major** mismatch is a client hard stop before any state
   *  is admitted — `checkContractVersion`, in the same `core/` module. */
  contractVersion?: string
  /** The engine ULID, 26 chars. */
  transactionId: string
  version: number
  etag: string
  /** §2's three, closed. The form reads `open` in four places and a fourth value
   *  arriving would be a §8 revision, not something to guess at. */
  status: 'open' | 'submitted' | 'abandoned'
  /** 🚩 **The acting store as the pricing plant** (law 8) — bound once at `Open`
   *  and immutable for the life of the transaction. Invisible in the NPHIES
   *  payload and decisive in every amount in it, which is why the screen may not
   *  offer a store switch mid-request. */
  plant: string
  reference: NphiesSessionReference
  header: NphiesSessionHeader
  insurance: NphiesSessionInsurance
  lines: NphiesAuthSessionLine[]
  submitBlockers: NphiesSubmitBlocker[]
  /** `true` when a retried `requestId` was not re-applied (§2). */
  replayed: boolean
}

/**
 * `POST Nphies/Session/Open` → §7.1.
 *
 * 🚩 **There is no `refusedExisting`**, unlike the call-centre door: drafts are
 * not resumable (law 9), so a second `Open` simply opens a second transaction and
 * the first is abandoned or swept. Shift-less, per the call-centre device
 * precedent.
 */
export interface NphiesOpenResult {
  outcome: 'opened'
  state: NphiesAuthSessionState
}

/**
 * `POST Nphies/Session/Abandon` → §7.2. **No state comes back** — the
 * transaction is VOIDED and there is nothing left to render, which is why the
 * caller owes the agent a landing.
 */
export interface NphiesAbandonResult {
  outcome: 'abandoned'
  transactionId: string
}

/**
 * ---------------------------------------------------------------------------
 * The **clinical-edit gate** (§1.1 #10, §3.7) and **submit** (§3.5, §7.3) —
 * ticket 220.
 * ---------------------------------------------------------------------------
 */

/** One diagnosis as the clinical-edit check reads it — the service's own
 *  `ClinicalEditDiagnosis`. Two fields, and neither is the description: the
 *  validator looks the code up itself. */
export interface NphiesClinicalEditDiagnosis {
  diagnosisCode: string
  diagnosisType: string
}

/**
 * `POST Nphies/ClinicalEditValidate` body (§1.1 #10) — the service's
 * `ClinicalEditRequest` (`Features/ClinicalEditValidator.cs:285`, read
 * 2026-08-02), camel-cased by the envelope like every other passthrough.
 *
 * 🚩 **Four fields, and not one of them is money.** The check is about the
 * *patient and the diagnoses*: age and gender restrictions on each code, and
 * whether a principal was named at all. The basket is not part of it, which is
 * why this body is assembled from the session state's `reference` and `header`
 * and carries no line, no amount and no attachment (law 1).
 */
export interface NphiesClinicalEditRequest {
  serviceDate: string
  patientBirthDate: string
  patientGender: string
  diagnoses: NphiesClinicalEditDiagnosis[]
}

/**
 * One restriction the check found — the service's `ClinicalEditFinding`
 * (`:303`): a **restriction type** and a **message**, and nothing else.
 *
 * 🚩 `restrictionType` is `ClinicalEditRestrictionTypeConstants` — `"F"` fatal,
 * `"W"` warning (`:319`). It is a **string, not a closed pair**, and
 * deliberately so: the service fills it straight from `RareRestrictionType` /
 * `GenderRestrictionType` / `AgeRestrictionType`, which are raw columns on
 * `NDiagnosis`, so a third value is a database edit away. What the client does
 * with an unrecognised one is `submit-gate`'s ruling, not a type's.
 *
 * `message` is the service's own sentence — server-supplied text, passed through
 * as data with no i18n key (`.claude/rules/i18n-zero-literal.md`).
 */
export interface NphiesClinicalEditFinding {
  restrictionType: string
  message: string
}

/** What the clinical-edit check answers — the service's `ClinicalEditResult`
 *  (`:299`). An empty `findings` is the clear case, and it is the *ordinary*
 *  one. */
export interface NphiesClinicalEditResult {
  contractVersion?: string
  findings: NphiesClinicalEditFinding[]
}

/**
 * One reason a submission was refused (§7.3's `refused`).
 *
 * 🚩 **`lineId: null` is a header-level reason**, and it is the header-only case
 * §3.9 describes: the service's own guards — unknown item, item with no Nphies
 * category, unconfigured provider or payer, an over-long prescription reference —
 * throw **before the lines are built**, so there is no row for the reason to
 * attach to. A client that dropped the unattachable ones would hide precisely the
 * refusals that are hardest to recover from.
 */
export interface NphiesSubmitRefusalReason {
  lineId: string | null
  message: string
}

/**
 * `POST Nphies/Session/Submit` → §7.3's three outcomes, as a discriminated union
 * so a screen cannot read one branch's field off another's answer.
 *
 * 🚩 **`inFlight` is NOT a failure** (law 6). The 100 s window elapsed and the
 * request may well have reached the payer, so the client's only permitted
 * response is to offer a status check. There is no `failed` member of this union
 * and no code path anywhere in this feature that resubmits.
 *
 * 🚩 **`refused` is a `Failed`, and it is a FORM state.** The request was refused
 * before the payer saw it and is fixable by the agent, here — which is why the
 * reasons carry a `lineId` at all.
 */
export type NphiesSubmitResult =
  | {
      contractVersion?: string
      outcome: 'submitted'
      authId: string
      preAuthRef: string
      /** `status: "submitted"` — the transaction is closed and the form is done. */
      state: NphiesAuthSessionState
    }
  | {
      contractVersion?: string
      outcome: 'refused'
      authId: string
      reasons: NphiesSubmitRefusalReason[]
    }
  | {
      contractVersion?: string
      outcome: 'inFlight'
      /** Always `null` — nothing came back to name (§7.3). */
      authId: null
    }

/**
 * ---------------------------------------------------------------------------
 * The **write-ahead journal row** (§3.9) — ticket 221's one server dependency,
 * and the whole of what a reopen is prefilled from.
 * ---------------------------------------------------------------------------
 *
 * `GET Nphies/AuthRequestJournal/{authId}` reads `PosIntegrationAttempt.RequestJson`
 * where `SubmissionReference == authId`. `IntegrationAttemptLog.StartAsync` writes
 * it on a **fresh connection, committed before the payer is called**, so it
 * survives a refusal, a rejection and a transport failure alike — and it is the
 * only source that covers a **header-only** refusal, where the service's own
 * guards threw before the lines were built. **No new table, column or write.**
 *
 * 🚩 **The shape is the Nphies service's own `AuthRequest`**
 * (`Features/Auth/Dtos/AuthRequest.cs`, read 2026-08-02), camel-cased by the
 * envelope like every other passthrough — because that is literally what was
 * serialized into the column. It is not a friendlier reopen DTO: the contract
 * names the source and not a projection of it, and a projection invented here
 * would fail silently on exactly the fields it guessed. Logged as a §8 gap in
 * `.afk/HITL-221.md`.
 */

/**
 * One line of the journalled request — `AuthItemRequest` as the service defines
 * it (§4's nineteen-field ownership table, the same DTO seen from the stored
 * side).
 *
 * 🚩 **`maxCoverage` IS here**, unlike `AuthDetailLine`. That is the whole reason
 * §3.9 makes the journal the prefill source rather than the ordinary
 * response-by-id: `MaxCoverage` is on `NAuthLine` and **absent from
 * `AuthLineDto`**, so a replay sourced from the fallback drops that one override
 * (§3.4's known gap, priced and not taken).
 *
 * ⚠️ `factor` is on the DTO and is deliberately absent here: §1.3 omits it on the
 * way out because the service recomputes it unconditionally, so it is not a thing
 * a replay can carry across either.
 */
export interface AuthJournalItem {
  sequence: number
  itemNumber: string
  quantity: number
  /** Engine money, kept ONLY to compare against what the replay prices at (law 1
   *  — nothing here is ever sent). */
  unitPrice: number
  extendedPrice: number
  amount: number
  netAmount: number
  vat: number
  discountPercentage: number
  discountAmount: number
  actualPatientShare: number
  deductibleG: number
  /** IS `InsuranceItemCategory` (§4) — an item that has since lost it is one of
   *  the things a replay has to report rather than quietly drop. */
  deductibleGroupName: string
  /** Agent — `updateLineInsurance`. The override the fallback path cannot carry. */
  maxCoverage: number
  /** Agent — `updateLineMeta`. */
  daysSupply: number
  selectionReason: string
  serviceDate: string
  /** The header's `type|code` list, stamped down onto the line (§4). */
  diagnosis: string
}

/**
 * One supporting info of the journalled request — `AuthSupportingInfoRequest`
 * (read 2026-08-02). The same nine fields as the response-side
 * `AuthSupportingInfo` minus its `id`, which the *request* DTO does not carry.
 *
 * 🚩 **The morphology code rides in `code`**, on the row whose `category` is
 * `morphology` — `Extensions.cs:705-710` reads `nInfo.Code` against the
 * `Morphology` value set. Not in `valueString`, and not derived from anything.
 */
export interface AuthJournalSupportingInfo {
  sequence: number
  /** `attachment` · `days-supply` · `reason-for-visit` · `morphology`. */
  category: string
  code: string
  /** Base64 — §3.5's attachments really do ride inside the journal row, because
   *  the column is `StringMaxType`. */
  attachment: string
  valueString: string
  valueBoolean?: boolean | null
  valueDecimal?: number | null
  /** ⚠️ `image` | `pdf`, not a MIME type — the same trap `AuthSupportingInfo`
   *  carries. */
  attachmentType: string
  attachmentTitle: string
  display: string
}

/**
 * The journalled request, whole — `AuthRequest` (read 2026-08-02).
 *
 * ⚠️ Declared narrower than the DTO on purpose, as everything else in this file
 * is. `originalProviderCode`, `authRef`, `invoiceNo`, `episode`,
 * `claimRequestType`, the three `offline*` fields, `refResponse*`,
 * `hidpReference`, `isReferral`/`referralDisplay`, `preAuthRef`/`preAuthStart`/
 * `preAuthEnd`, `userId`, `sourceCode`, `newborn`/`newbornWeight`,
 * `isReferenceToDocument`/`refDocumentNo`, `occupation`, `maritalStatus` and
 * `isMaternity` are all on the wire and none of them is a thing a replay can
 * act on: there is no verb that carries one (§1.2), and law 7 makes half of them
 * the server's to stamp anyway.
 */
export interface AuthRequestJournal {
  contractVersion?: string
  /** 🚩 The two ids `Open` takes (§7.1), and the reason a reopen needs no other
   *  read: the fresh session is bound to the same eligibility and the same
   *  chosen coverage as the request being replayed. */
  eligibilityId: string
  memberId: string
  providerCode: string
  payerCode: string
  patientId: string
  patientIdType: string
  patientName: string
  patientGender: string
  patientBirthDate: string
  serviceDate: string
  prescriptionRef: string
  /** 🚩 `type|code` rows joined by `,` — `NphiesDiagnosis.GetDiagnosisList` is the
   *  parser on the service's own side, and §3.4 says the client owns parsing this
   *  encoding back because `NAuthDiagnosis` is dead code upstream. */
  diagnosis: string
  exceptionPrescription: boolean
  reasonForVisit: string
  policyNumber: string
  policyHolder: string
  claimType: number
  /** §4's nine header money fields, as `AuthRequest` names them. */
  deductibleG1: number
  deductibleG1Max: number
  deductibleG1Paid: number
  deductibleG2: number
  deductibleG2Max: number
  deductibleG2Paid: number
  deductibleG3: number
  deductibleG3Max: number
  deductibleG3Paid: number
  /** 🚩 **Empty on a header-only refusal** — the guards at `AuthService.cs:402`,
   *  `:514`, `:576`, `:581` and `:219` throw before the lines are built at
   *  `:562`. That case is precisely why the journal is the prefill source. */
  items: AuthJournalItem[]
  supportingInfos: AuthJournalSupportingInfo[]
}

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
