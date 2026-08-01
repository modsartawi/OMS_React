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
