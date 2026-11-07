/**
 * Mark returned back (BackOffice spec 3433, ADR 0126; client ticket 838) — the second named
 * exception, beside Mark delivered (ADR 0065), to the screen's guardrail that delivery outcomes are
 * recorded in the field, never here (`CONTEXT.md` **Close**, **Marked returned back**). It records
 * the field's own returned back (`DRBK`) for a delivery whose goods came back and the field never
 * said so.
 *
 * Returned back is NOT a positive outcome: the order is not finished, the store must now
 * reschedule or cancel it. So it never takes the promoted commit slot and carries no check mark.
 *
 * Like Mark delivered it sits outside the `commands.ts` grammar: its first gate is a GRANT of its
 * own, and a session without it has no command to discover, so the command is hidden rather than
 * explained. Once drawn it follows the bar's rule — a state that contradicts it disables it with a
 * reason, it is never hidden for state.
 *
 * Pure, and `t` stays with the caller: this module answers in `document` namespace KEYS.
 *
 * The server is the authority on every rule below (3434, 3435). The client copies two of them only
 * to explain itself before a round trip, and maps the server's refusal codes to words.
 */

import { markDeliveredGate } from './mark-delivered'

/** What the gate reads: the probe's grant, the payload's category and two status codes. */
export interface MarkReturnedBackContext {
  /** `SdDocumentWeb/Access`'s `canMarkReturnedBack` (3436). Absent on an older SIS.Api. */
  canMarkReturnedBack: boolean | null | undefined
  documentCategory: string | null | undefined
  /** `status.deliveryStatus` — `O` is out for delivery. */
  deliveryStatus: string | null | undefined
  /** `status.closeStatus` — any value means a cancellation is pending. */
  closeStatus: string | null | undefined
  /** An action is posting, its reload is running, or a dialog is open. */
  busy: boolean
}

/** The one delivery status the server marks from (3435, `SDD-02227`). */
const OUT_FOR_DELIVERY = 'O'
const DELIVERY_CATEGORY = 'D'

/**
 * The server's note width (`SdDocumentLog.Widths.Note`, `VARCHAR(100)`), measured on the trimmed
 * note as the server measures it (`SDD-02230`).
 */
export const MARK_RETURNED_BACK_NOTE_MAX = 100

/**
 * The reason that cannot go without a note (`SDD-02229`). Not Mark delivered's `OTHR`: the reason
 * table is keyed by `ReasonCode` alone, so this act's `DLVB` group spells its own codes.
 */
export const OTHER_RETURN_REASON = 'OTHB'

const trimmed = (value: string | null | undefined): string => (value ?? '').trim()

/**
 * The command's state, or `null` when it is not drawn at all.
 *
 * - **Hidden** unless the probe says `canMarkReturnedBack === true` (strictly: absent and malformed
 *   are a denial, so an older SIS.Api draws nothing) and the payload's category is `D`. It reads
 *   its OWN grant only: Mark delivered's grant neither draws nor hides it.
 * - **Busy** disables it with no reason, as on every bar command.
 * - **Disabled with a reason** when the status is not exactly `O`, then when a cancellation is
 *   pending — the order the server checks them in, so the reason shown is the one it would give.
 */
export function markReturnedBackGate(
  ctx: MarkReturnedBackContext,
): { disabled: boolean; reasonKey: string | null } | null {
  if (ctx.canMarkReturnedBack !== true || trimmed(ctx.documentCategory) !== DELIVERY_CATEGORY) return null
  if (ctx.busy) return { disabled: true, reasonKey: null }
  if (ctx.deliveryStatus !== OUT_FOR_DELIVERY) {
    return { disabled: true, reasonKey: 'markReturnedBack.disabled.notOutForDelivery' }
  }
  if (trimmed(ctx.closeStatus) !== '') {
    return { disabled: true, reasonKey: 'markReturnedBack.disabled.cancellationPending' }
  }
  return { disabled: false, reasonKey: null }
}

/** The two back-office corrections the Delivery cluster can hold (ADR 0065, ADR 0126). */
export type DeliveryCorrectionKind = 'mark-delivered' | 'mark-returned-back'

export interface DeliveryCorrection {
  kind: DeliveryCorrectionKind
  disabled: boolean
  reasonKey: string | null
}

/**
 * The Delivery cluster's commands, in bar order, each drawn for ITS OWN grant alone: a session
 * holding only one of the two grants sees only that command, and a session holding neither (or an
 * older SIS.Api that sends neither flag) gets no cluster at all. Both share the one state gate.
 */
export function deliveryCorrections(
  ctx: Omit<MarkReturnedBackContext, 'canMarkReturnedBack'> & {
    canMarkDelivered: boolean | null | undefined
    canMarkReturnedBack: boolean | null | undefined
  },
): DeliveryCorrection[] {
  const { canMarkDelivered, canMarkReturnedBack, ...state } = ctx
  const cluster: DeliveryCorrection[] = []
  const delivered = markDeliveredGate({ ...state, canMarkDelivered })
  if (delivered) cluster.push({ kind: 'mark-delivered', ...delivered })
  const returnedBack = markReturnedBackGate({ ...state, canMarkReturnedBack })
  if (returnedBack) cluster.push({ kind: 'mark-returned-back', ...returnedBack })
  return cluster
}

/** Whether the dialog may commit, and the two note states it explains in place. */
export function markReturnedBackCommit(input: { reasonCode: string; note: string; pending: boolean }): {
  canCommit: boolean
  noteRequired: boolean
  noteTooLong: boolean
} {
  const reason = trimmed(input.reasonCode)
  const note = trimmed(input.note)
  const noteRequired = reason === OTHER_RETURN_REASON
  const noteTooLong = note.length > MARK_RETURNED_BACK_NOTE_MAX
  const canCommit = !input.pending && reason !== '' && !(noteRequired && note === '') && !noteTooLong
  return { canCommit, noteRequired, noteTooLong }
}

/**
 * The dialog's two consequences. The reschedule line is ALWAYS shown: a returned back delivery is
 * not finished, the store must reschedule or cancel it. On an express delivery the field's own
 * `DRBK` also queues a close request five minutes later (ADR 0126), so the operator is warned
 * before it happens. Strictly `true`: an absent or malformed flag warns of nothing that will not
 * happen. There is no amount-due line — a returned back settles no cash either way.
 */
export function markReturnedBackNotices(doc: { isExpressDelivery: boolean | null | undefined }): {
  reschedule: true
  expressAutoClose: boolean
} {
  return { reschedule: true, expressAutoClose: doc.isExpressDelivery === true }
}

/**
 * The door's refusal codes (3434, 3435) → their `document` namespace keys. This act's own block
 * (`SDD-02225`..), never Mark delivered's codes, so a refusal names the act it refused. Two are
 * borrowed from existing guards: an SGH or Lab Booking delivery is refused under that guard's code.
 */
export const MARK_RETURNED_BACK_REFUSALS: Readonly<Record<string, string>> = {
  'SDD-00002': 'markReturnedBack.refused.notFound',
  'SDD-02226': 'markReturnedBack.refused.notADelivery',
  'SDD-02227': 'markReturnedBack.refused.notOutForDelivery',
  'SDD-02228': 'markReturnedBack.refused.cancellationPending',
  'SDD-02090': 'markReturnedBack.refused.sghOrder',
  'SDD-02441': 'markReturnedBack.refused.labBooking',
  'SDD-02225': 'markReturnedBack.refused.unknownReason',
  'SDD-02229': 'markReturnedBack.refused.noteRequired',
  'SDD-02230': 'markReturnedBack.refused.noteTooLong',
}

/** A refusal code's key, or `null` for a code this client does not know (show the server's sentence). */
export function returnedBackRefusalKeyOf(code: string | null | undefined): string | null {
  return (code && MARK_RETURNED_BACK_REFUSALS[code]) || null
}

/**
 * The seeded `DLVB` reasons (BackOffice `079_seed_mark_returned_back_reasons.sql`), in the order the
 * server lists them (by code). The server stays the authority on which are active; this list is the
 * set this client carries labels for.
 */
export const MARK_RETURNED_BACK_REASONS = ['CARB', 'DAPB', 'OTHB', 'STOR'] as const

/**
 * A reason's label key, by code. The server sends English only (`SdDocumentReason` has no Arabic
 * column), so the labels are this client's; a code it does not know falls back to the server's
 * description at the call site.
 */
export function returnedBackReasonLabelKey(code: string): string {
  return `markReturnedBack.reasons.${trimmed(code)}`
}
