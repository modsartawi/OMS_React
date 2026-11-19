/**
 * "Add to blocked-patient list" on a confirmed case (oms 924; BackOffice 4056 `POST Insurance/Patterns/Cases/{id}/Block`,
 * NOT BUILT — the body is GUESSED). Pure: who is offered it, on which case, and the body a form makes — the dialog reads
 * its problems from here, and the call sends only a body this module made.
 *
 * The block goes through the blocked-patient list's own change path (BackOffice 3965), with the reference
 * "Case {caseNumber}" set by the server, and it uses the patient's identity — so the server also writes a reveal-log row.
 * It is never automatic.
 *
 * The entry's rules are the list's own (3965, 3982), mirrored here as the list's editor mirrors them in
 * `features/insurance-rules/lists/entry-form.ts` — a feature never imports another, and two small copies of a
 * two-word kind and a width are cheaper than a shared module neither owns.
 */
import { isBareDenial } from '@/core/api'
import type { PatternBlockBody, PatternBlockReasonKind } from '@/core/models/insurance-pattern-manager'
import type { LocalDate } from '@/core/util/date-window'
import type { Permissions } from '@/core/permissions'
import { canBlockPatient, canRevealPatient } from './access'

/** The kinds of finding a blocked-patient entry names (3965's `ReasonKind`), in the order the form offers them. */
export const BLOCK_REASON_KINDS: readonly PatternBlockReasonKind[] = ['abuse', 'fraud']

/** The reporting payer's width on the list (3982's `InsuranceList.Widths`). */
export const BLOCK_PAYER_MAX = 40

/** The dialog as typed: no kind chosen yet is `''`; a blank start is today (3965), a blank end is none. */
export interface BlockForm {
  reasonKind: PatternBlockReasonKind | ''
  payer: string
  /** `yyyy-MM-dd` from a date field, or ''. */
  startsOn: string
  /** `yyyy-MM-dd` from a date field, or ''. */
  endsOn: string
}

export const EMPTY_BLOCK: BlockForm = Object.freeze({ reasonKind: '', payer: '', startsOn: '', endsOn: '' })

/** Why a form cannot be sent, in the form's order. */
export type BlockProblem = 'reasonKind' | 'payerTooLong' | 'startInvalid' | 'endInvalid' | 'endPast' | 'startAfterEnd'

const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/**
 * The form's problems against `today` (the browser's local day). The kind of finding is required (4056; 3965 requires it
 * on the blocked-patient list). A start before today is accepted — a backdated finding is still a fact (3965) — but the
 * end may not be before today (the list refuses an expiry before today, 3133), nor before the start.
 */
export function blockProblems(form: BlockForm, today: LocalDate): BlockProblem[] {
  const out: BlockProblem[] = []
  if (!(BLOCK_REASON_KINDS as readonly string[]).includes(form.reasonKind)) out.push('reasonKind')
  if (form.payer.trim().length > BLOCK_PAYER_MAX) out.push('payerTooLong')
  const startOk = form.startsOn === '' || DAY.test(form.startsOn)
  const endOk = form.endsOn === '' || DAY.test(form.endsOn)
  if (!startOk) out.push('startInvalid')
  if (!endOk) out.push('endInvalid')
  if (endOk && form.endsOn !== '' && form.endsOn < today) out.push('endPast')
  if (startOk && endOk && form.startsOn !== '' && form.endsOn !== '' && form.startsOn > form.endsOn) out.push('startAfterEnd')
  return out
}

/** The body posted: the kind, and the payer, start and end only when given. Null while a problem stands. */
export function blockBody(form: BlockForm, today: LocalDate): PatternBlockBody | null {
  if (blockProblems(form, today).length > 0) return null
  const payer = form.payer.trim()
  return {
    reasonKind: form.reasonKind as PatternBlockReasonKind,
    ...(payer ? { payer } : {}),
    ...(form.startsOn ? { startsOn: form.startsOn } : {}),
    ...(form.endsOn ? { endsOn: form.endsOn } : {}),
  }
}

/**
 * Offered only on a CONFIRMED case, and only to a user holding BOTH the investigator grant and the blocked-patient
 * list's Change grant (BackOffice 4056: "It requires both"). Fails closed with the permissions answer. The door refuses
 * the same; this only hides what would be refused.
 */
export function canOfferBlock(status: string, p: Permissions): boolean {
  return status === 'confirmed' && canRevealPatient(p) && canBlockPatient(p)
}

/**
 * Why a block failed, for the dialog's words (review 3): `denied` a bare 403 — the grant filter refused before any
 * handler ran, so no sentence came back, and the dialog names the two grants a block needs rather than "Unexpected API
 * error (HTTP 403)"; `refused` anything else, the server's own sentence through `apiErrorMessage`.
 */
export type BlockFailure = 'denied' | 'refused'

export function blockFailure(error: unknown): BlockFailure {
  return isBareDenial(error) ? 'denied' : 'refused'
}
