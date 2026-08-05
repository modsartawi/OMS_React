/**
 * The eligibility check form's draft, its gate, and the body it becomes
 * (ticket 211, contract v1.0 §3.1 / §3.2).
 *
 * Pure: no React, no i18n, no server call. The page is a controlled shell over
 * this module — which is why the provider gate and Fill's one refusal are
 * testable without React Testing Library (spec 209's tier-1 ruling).
 */

import type {
  EligibilityCheckRequest,
  LastEligibility,
  LastEligibilityAnswer,
} from '@/core/models/nphies'

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
  // 🚩 Unchosen, not defaulted. An identity field the agent never touched must
  // not be invented for them: `patientGender` reaches a national exchange inside
  // the FHIR Patient, and shipping `male` because it sorted first is the quiet
  // kind of wrong this screen exists to remove.
  patientIdType: '',
  patientName: '',
  patientGender: '',
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
export type CheckBlocker =
  | 'provider'
  | 'patientId'
  | 'payer'
  | 'patientIdType'
  | 'patientName'
  | 'patientGender'
  | 'patientBirthDate'

const blank = (value: string) => value.trim() === ''

/**
 * Every unmet condition, in the order the form asks for them. Empty = submittable.
 *
 * The **provider** blocker is the designed one (ticket 211): the block is
 * visible on the form rather than arriving as `PROVIDER_NOT_CONFIGURED` from a
 * national exchange. The rest are arithmetic — `EligibilityRequest` has no
 * request to build without them, `PatientBirthDate` is a **non-nullable
 * `DateTime`** so an empty one is a 400 rather than a question, and the service
 * throws `"Payer doesn't configured!"` on an empty payer.
 *
 * 🚩 They are blockers rather than defaults for the same reason the provider is:
 * an identity field nobody chose still reaches a national exchange. Stating the
 * requirement where the agent is standing is this spec's whole posture — "a
 * required field appears with its cause" — and it is what lets the form open on
 * genuinely empty identity controls.
 */
export function checkBlockers(draft: CheckDraft): CheckBlocker[] {
  const blockers: CheckBlocker[] = []
  if (blank(draft.providerCode)) blockers.push('provider')
  if (blank(draft.patientId)) blockers.push('patientId')
  if (blank(draft.payerCode)) blockers.push('payer')
  if (blank(draft.patientIdType)) blockers.push('patientIdType')
  if (blank(draft.patientName)) blockers.push('patientName')
  if (blank(draft.patientGender)) blockers.push('patientGender')
  if (blank(draft.patientBirthDate)) blockers.push('patientBirthDate')
  return blockers
}

/**
 * `2010-08-21T00:00:00` → `2010-08-21`, and **anything that is not an ISO date
 * becomes `''`**.
 *
 * 🚩 Validating rather than slicing is the point. A native date input silently
 * renders an unparseable value as empty, so a blind `slice(0, 10)` over an
 * unexpected serialization (`2010-8-21T…`, a locale format) would leave the agent
 * looking at a blank date field while the draft held a non-blank string — which
 * clears the blocker and posts a malformed `DateTime` to the exchange. Blank
 * keeps the field and its blocker agreeing with each other.
 */
const asDate = (value: string) => (/^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '')

/**
 * What Fill's read actually answered, whichever shape the door used.
 *
 * 🚩 SIS.Api wraps: the envelope's `data` is `{ eligibility }`
 * (`NphiesEndpoints.cs:168`), while §1.1 row 2 promises the bare
 * `LastEligibilityModel`. Both are read here, once — see `LastEligibilityAnswer`
 * for why reading only the bare one fails silently rather than loudly.
 *
 * A patient with no previous check is `null` **or** `{ eligibility: null }`, and
 * both must arrive at the same `null`: that is the ordinary answer the form
 * reports as "no previous check", and it is distinguishable from a fill that
 * happened only because this returns `null` rather than an empty object.
 */
export function unwrapLastEligibility(
  answer: LastEligibility | LastEligibilityAnswer | null | undefined,
): LastEligibility | null {
  if (!answer) return null
  // The wrapper is identified by its OWN key, not by the absence of a record's
  // key — an unknown third shape must read as "no previous check" rather than as
  // a record whose every field is undefined, which is the exact failure this
  // function exists to end.
  if ('eligibility' in answer) return answer.eligibility ?? null
  return answer
}

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
 *
 * 🚩 It **fills, and never clears**. Every text field falls back to what the
 * agent had already typed, because the stored record is patchy — `Occupation`
 * and `MaritalStatus` are nullable and usually empty — and a Fill that blanked a
 * name the agent had just typed would punish the very case it exists to serve
 * (press Fill, find out there is no previous check, keep going by hand). The two
 * flags are the last check's own facts and do replace.
 */
export function fillFromLastEligibility(draft: CheckDraft, last: LastEligibility): CheckDraft {
  const fill = (incoming: string | null | undefined, current: string) =>
    incoming && incoming.trim() !== '' ? incoming : current

  return {
    ...draft,
    payerCode: fill(last.payerCode, draft.payerCode),
    patientId: fill(last.patientId, draft.patientId),
    patientIdType: fill(last.patientIdType, draft.patientIdType),
    patientName: fill(last.patientName, draft.patientName),
    patientGender: fill(last.patientGender, draft.patientGender),
    patientBirthDate: fill(asDate(last.patientBirthDate ?? ''), draft.patientBirthDate),
    memberId: fill(last.memberId, draft.memberId),
    transfer: last.transfer === true,
    newborn: last.newborn === true,
    occupation: fill(last.occupation, draft.occupation),
    maritalStatus: fill(last.maritalStatus, draft.maritalStatus),
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
