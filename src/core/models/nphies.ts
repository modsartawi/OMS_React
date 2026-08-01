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
