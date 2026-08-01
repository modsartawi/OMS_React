/**
 * The eligibility check form's draft, its gate, and the body it becomes
 * (ticket 211, contract v1.0 §3.1 / §3.2).
 *
 * Pure: no React, no i18n, no server call. The page is a controlled shell over
 * this module — which is why the provider gate and Fill's one refusal are
 * testable without React Testing Library (spec 209's tier-1 ruling).
 */

import type { EligibilityCheckRequest, LastEligibility } from '@/core/models/nphies'

/**
 * What the agent has typed so far. Every field is a string or a boolean because
 * that is what a controlled input holds; the wire types live on
 * `EligibilityCheckRequest`.
 */
export interface CheckDraft {
  providerCode: string
  payerCode: string
  patientId: string
  patientIdType: string
  patientName: string
  patientGender: string
  /** ISO `yyyy-MM-dd` — what a native date input speaks. */
  patientBirthDate: string
  memberId: string
  transfer: boolean
  newborn: boolean
  occupation: string
  maritalStatus: string
}

/**
 * The cold form.
 *
 * 🚩 `providerCode` is `''` and there is **no code anywhere that seeds it** — not
 * from the acting store, not from the last check, not from the previous act on
 * this screen. A provider is a free per-act pick with no default and no memory
 * (§3.1), so an agent can never submit under one they did not consciously choose.
 */
export const EMPTY_CHECK_DRAFT: CheckDraft = {
  providerCode: '',
  payerCode: '',
  patientId: '',
  patientIdType: 'PRC',
  patientName: '',
  patientGender: 'male',
  patientBirthDate: '',
  memberId: '',
  transfer: false,
  newborn: false,
  occupation: '',
  maritalStatus: '',
}

/**
 * `EligibilityPurpose`, pinned. v1 asks one question — *what is covered* — so
 * there is no selector, exactly as there is none for claim type or request type.
 *
 * ⚠️ The contract pins `ClaimType` and `ClaimRequestType` server-side but says
 * nothing about this field; the service looks it up by display name and then
 * **does not put the result in the bundle** (`EligibilityService.cs:144` is
 * commented out), so the value is echoed onto the response and never reaches the
 * exchange. Logged as a contract gap in `.afk/HITL-211.md`.
 */
const ELIGIBILITY_PURPOSE = 'benefits'

/** Why submit is held. Each one names a control the agent can see. */
export type CheckBlocker = 'provider' | 'patientId' | 'payer'

const blank = (value: string) => value.trim() === ''

/**
 * Every unmet condition, in the order the form asks for them. Empty = submittable.
 *
 * The **provider** blocker is the designed one (ticket 211): the block is
 * visible on the form rather than arriving as `PROVIDER_NOT_CONFIGURED` from a
 * national exchange. The other two are arithmetic — there is no request to build
 * without a patient to ask about or a payer to ask.
 */
export function checkBlockers(draft: CheckDraft): CheckBlocker[] {
  const blockers: CheckBlocker[] = []
  if (blank(draft.providerCode)) blockers.push('provider')
  if (blank(draft.patientId)) blockers.push('patientId')
  if (blank(draft.payerCode)) blockers.push('payer')
  return blockers
}

/** `2010-08-21T00:00:00` → `2010-08-21`; anything else is passed through. */
const asDate = (value: string) => (value ? value.slice(0, 10) : '')

/**
 * **Fill** — the identity block completed from that patient's last check
 * (§3.2). It works on a **cold** form, which is what makes it better than the
 * row-driven prefill it replaces: the agent starts from the patient id they were
 * given on the phone, not from a row they had to find first.
 *
 * 🚩 It deliberately does **not** touch `providerCode`. The last check names one,
 * and copying it would be precisely the memory-of-the-last-pick §3.1 forbids —
 * an agent would submit under a provider the form chose for them. Whatever they
 * had already chosen survives untouched.
 */
export function fillFromLastEligibility(draft: CheckDraft, last: LastEligibility): CheckDraft {
  return {
    ...draft,
    payerCode: last.payerCode ?? '',
    patientId: last.patientId ?? draft.patientId,
    patientIdType: last.patientIdType || draft.patientIdType,
    patientName: last.patientName ?? '',
    patientGender: last.patientGender || draft.patientGender,
    patientBirthDate: asDate(last.patientBirthDate ?? ''),
    memberId: last.memberId ?? '',
    transfer: last.transfer === true,
    newborn: last.newborn === true,
    occupation: last.occupation ?? '',
    maritalStatus: last.maritalStatus ?? '',
  }
}

/**
 * The draft as the wire body — `EligibilityRequest` verbatim (§3.1).
 *
 * 🚩 What is NOT here is the point: no `distributionChannel`, no user or staff
 * id, no `sourceCode` (law 7 — SIS.Api stamps identity and the browser never
 * sends it), no `claimType` or `claimRequestType` (v1 has one of each, pinned
 * server-side), and no `hidpReference` (HIDP is out of scope, so the field is
 * absent rather than present-and-nulled).
 */
export function toCheckRequest(draft: CheckDraft): EligibilityCheckRequest {
  return {
    eligibilityPurpose: ELIGIBILITY_PURPOSE,
    providerCode: draft.providerCode.trim(),
    payerCode: draft.payerCode.trim(),
    patientId: draft.patientId.trim(),
    patientIdType: draft.patientIdType,
    patientGender: draft.patientGender,
    patientName: draft.patientName.trim(),
    patientBirthDate: draft.patientBirthDate,
    memberId: draft.memberId.trim(),
    transfer: draft.transfer,
    newborn: draft.newborn,
    occupation: draft.occupation.trim(),
    maritalStatus: draft.maritalStatus.trim(),
  }
}
