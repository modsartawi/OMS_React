/**
 * The prescription on a Wasfaty or Nphies order (ticket 1008, spec 1006 D4, D6) — the patient's ID
 * and the reference, and the payment lock the type brings.
 *
 * - **The server owns the rule.** The ID is exactly 10 digits and the reference is required (D4),
 *   but `setPrescription` is what refuses (`PATIENT_ID_INVALID`, `REFERENCE_REQUIRED`); the console
 *   only words the refusal under the field it names. The one thing the box does itself is keep
 *   what cannot be an ID out of it: digits only, ten at most.
 * - **A blur sends a whole pair, Enter sends what is there.** The verb carries both fields, so a
 *   blur with the other box still empty would only earn a refusal for a field the agent has not
 *   reached yet. Enter is the agent asking, so it is sent and the server answers.
 * - **The payment lock is the server's** (BackOffice 4487): a Wasfaty / Nphies order answers
 *   `canChangePaymentType: false`, `header.paymentTypeForcedReason: 'orderType'` (the why) and
 *   `capabilityReasons.canChangePaymentType: 'PAYMENT_TYPE_FORCED'` (the generic code). The header's
 *   reason is read first because it is the specific one.
 */
import type { OrderType, SessionCapabilities, SessionHeader } from '@/core/models/callcenter'

export const PATIENT_ID_LENGTH = 10

/** Arabic-Indic (U+0660…) and Eastern Arabic-Indic (U+06F0…) digits, read as 0–9. */
function asciiDigit(ch: string): string {
  const code = ch.charCodeAt(0)
  if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660)
  if (code >= 0x06f0 && code <= 0x06f9) return String(code - 0x06f0)
  return ch
}

/** What the ID box keeps of what was typed or pasted: digits only, ten at most. */
export function filterPatientId(raw: string): string {
  return Array.from(raw, asciiDigit)
    .filter((ch) => ch >= '0' && ch <= '9')
    .join('')
    .slice(0, PATIENT_ID_LENGTH)
}

export interface PrescriptionDraft {
  patientId: string
  reference: string
}

/** What the order holds, as two strings (absent and `null` are empty). */
export function prescriptionOf(header: SessionHeader): PrescriptionDraft {
  return {
    patientId: header.prescription?.patientId?.trim() ?? '',
    reference: header.prescription?.reference?.trim() ?? '',
  }
}

/** Both fields held: the section settles into its ledger field. */
export function prescriptionSettled(header: SessionHeader): boolean {
  const held = prescriptionOf(header)
  return held.patientId !== '' && held.reference !== ''
}

/**
 * What a blur or an Enter sends, or `null` for nothing. The reference is trimmed (D4); a pair the
 * order already holds is not a correction and is not sent.
 */
export function prescriptionCommit(
  header: SessionHeader,
  draft: PrescriptionDraft,
  how: 'blur' | 'enter',
): PrescriptionDraft | null {
  const out = { patientId: draft.patientId.trim(), reference: draft.reference.trim() }
  const held = prescriptionOf(header)
  if (out.patientId === held.patientId && out.reference === held.reference) return null
  if (how === 'blur' && (out.patientId === '' || out.reference === '')) return null
  return out
}

const REFUSALS: Record<string, 'patientId' | 'reference'> = {
  PATIENT_ID_INVALID: 'patientId',
  REFERENCE_REQUIRED: 'reference',
}

/** The field a `setPrescription` refusal belongs under, and its words; `null` for any other code. */
export function prescriptionRefusal(
  code: string | null | undefined,
): { field: 'patientId' | 'reference'; key: string } | null {
  const field = code ? REFUSALS[code] : undefined
  return field ? { field, key: `prescription.refused.${code}` } : null
}

/** The reference's label: *eRx number* on Wasfaty, *Approval / PreAuthRef* on Nphies. */
export function referenceLabelKey(type: OrderType): string {
  return type === 'Wasfaty' || type === 'Nphies' ? `prescription.reference.${type}` : 'prescription.reference.other'
}

/** The payment lock reasons this console words. */
const KNOWN_PAYMENT_REASONS = new Set(['orderType', 'PAYMENT_TYPE_FORCED'])

export type PaymentLock = { open: true } | { open: false; key: string; reason: string | null }

/**
 * Whether the payment word is a control, and if not, the words for why.
 *
 * Shut when `canChangePaymentType` is false or the header carries a forced reason. The words come
 * from the header's reason first (`orderType`: *paid on delivery*), then the capability's code.
 */
export function paymentLock(header: SessionHeader, capabilities: SessionCapabilities): PaymentLock {
  const forced = header.paymentTypeForcedReason ?? null
  if (capabilities.canChangePaymentType !== false && !forced) return { open: true }
  const reason = forced ?? capabilities.capabilityReasons?.canChangePaymentType ?? null
  return { open: false, key: reason && KNOWN_PAYMENT_REASONS.has(reason) ? `payment.locked.${reason}` : 'payment.locked.unknown', reason }
}
