/**
 * "Close without invoice" (ticket 548; BackOffice spec 2994 story 72, door 3015): the write-off
 * form's validity, the body it sends, and what each failure reads as in the dialog. Pure: no React,
 * no `t` — the dialog turns `labelKey` into words.
 */
import { apiErrorCode, apiErrorKind, apiErrorMessage, isBareDenial } from '@/core/api'

export interface WriteOffForm {
  /** One of `WRITE_OFF_REASONS`, or `''` before a choice. */
  reason: string
  note: string
}

/** The coded reason that needs a note (`PrescriptionSessionWriteOffReasons.Other`). */
const OTHER = 'OTHER'

/** What stops the form being sent, or `null` when it may go. The server stays the authority. */
export function writeOffBlock(form: WriteOffForm): 'reasonRequired' | 'noteRequired' | null {
  if (form.reason === '') return 'reasonRequired'
  if (form.reason === OTHER && form.note.trim() === '') return 'noteRequired'
  return null
}

/** The POST body: `{ reason, note }`, the note trimmed (any script, otherwise unchanged). */
export function writeOffBody(form: WriteOffForm): { reason: string; note: string } {
  return { reason: form.reason, note: form.note.trim() }
}

/** The refusals the door names (`PrescriptionSessionErrorCodes.NotEndable`, `PrescriptionSessionHqErrorCodes`). */
const REFUSAL_LABEL: Record<string, string> = {
  'PSES-00009': 'writeOff.refusal.notEndable',
  'PSES-00220': 'writeOff.refusal.badReason',
  'PSES-00221': 'writeOff.refusal.noteRequired',
  'PSES-00222': 'writeOff.refusal.noActor',
}

export type WriteOffRefusal =
  /** A bare 403: the write-off grant is not held. The button hides for the rest of the visit. */
  | { kind: 'notGranted' }
  /** An envelope refusal: its message and code, with this side's words for a known code. */
  | { kind: 'refused'; code: string; labelKey: string | null; message: string }
  /** Anything else (network, a crash): the dialog's generic failure line. */
  | { kind: 'failed' }

export function writeOffRefusal(err: unknown): WriteOffRefusal {
  if (isBareDenial(err)) return { kind: 'notGranted' }
  const code = apiErrorCode(err)
  if (code && apiErrorKind(err) !== null) {
    return { kind: 'refused', code, labelKey: REFUSAL_LABEL[code] ?? null, message: apiErrorMessage(err, '') }
  }
  return { kind: 'failed' }
}
