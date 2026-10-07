/**
 * Mark delivered (BackOffice spec 2417, ADR 0065; client ticket 2422) — the ONE positive outcome
 * Document Details offers, and the single named exception to the screen's guardrail that orders
 * complete in the field, never here (`CONTEXT.md` **Close**, `commands.ts`).
 *
 * It sits outside the `commands.ts` grammar on purpose, the way Central Invoice does: its first
 * gate is a GRANT, and a session without the grant has no command to discover, so the cluster is
 * hidden rather than explained. Once drawn it follows the bar's own rule — a state that contradicts
 * it disables it with a reason, it is never hidden for state.
 *
 * Pure, and `t` stays with the caller: this module answers in `document` namespace KEYS.
 *
 * The server is the authority on every rule below (2420). The client copies two of them only to
 * explain itself before a round trip, and maps the server's refusal codes to words.
 */

/** What the gate reads: the probe's grant, the payload's category and two status codes. */
export interface MarkDeliveredContext {
  /** `SdDocumentWeb/Access`'s `canMarkDelivered` (2421). Absent on an older SIS.Api. */
  canMarkDelivered: boolean | null | undefined
  documentCategory: string | null | undefined
  /** `status.deliveryStatus` — `O` is out for delivery. */
  deliveryStatus: string | null | undefined
  /** `status.closeStatus` — any value means a cancellation is pending. */
  closeStatus: string | null | undefined
  /** An action is posting, its reload is running, or a dialog is open. */
  busy: boolean
}

/** The one delivery status the server marks from (2420, `SDD-02152`). */
const OUT_FOR_DELIVERY = 'O'
const DELIVERY_CATEGORY = 'D'

/**
 * The server's note width (`SdDocumentLog.Widths.Note`, `VARCHAR(100)`), measured on the trimmed
 * note as the server measures it (`SDD-02155`).
 */
export const MARK_DELIVERED_NOTE_MAX = 100

/** The reason that cannot go without a note (`SDD-02154`). */
export const OTHER_REASON = 'OTHR'

const trimmed = (value: string | null | undefined): string => (value ?? '').trim()

/**
 * The command's state, or `null` when it is not drawn at all.
 *
 * - **Hidden** unless the probe says `canMarkDelivered === true` (strictly: absent and malformed
 *   are a denial, so an older SIS.Api draws nothing) and the payload's category is `D`.
 * - **Busy** disables it with no reason, as on every bar command.
 * - **Disabled with a reason** when the status is not exactly `O`, then when a cancellation is
 *   pending — the order the server checks them in, so the reason shown is the one it would give.
 *   The code is compared exactly, as the server does: a client kinder than its server offers a
 *   command that is then refused.
 */
export function markDeliveredGate(ctx: MarkDeliveredContext): { disabled: boolean; reasonKey: string | null } | null {
  if (ctx.canMarkDelivered !== true || trimmed(ctx.documentCategory) !== DELIVERY_CATEGORY) return null
  if (ctx.busy) return { disabled: true, reasonKey: null }
  if (ctx.deliveryStatus !== OUT_FOR_DELIVERY) {
    return { disabled: true, reasonKey: 'markDelivered.disabled.notOutForDelivery' }
  }
  if (trimmed(ctx.closeStatus) !== '') {
    return { disabled: true, reasonKey: 'markDelivered.disabled.cancellationPending' }
  }
  return { disabled: false, reasonKey: null }
}

/** Whether the dialog may commit, and the two note states it explains in place. */
export function markDeliveredCommit(input: { reasonCode: string; note: string; pending: boolean }): {
  canCommit: boolean
  noteRequired: boolean
  noteTooLong: boolean
} {
  const reason = trimmed(input.reasonCode)
  const note = trimmed(input.note)
  const noteRequired = reason === OTHER_REASON
  const noteTooLong = note.length > MARK_DELIVERED_NOTE_MAX
  const canCommit = !input.pending && reason !== '' && !(noteRequired && note === '') && !noteTooLong
  return { canCommit, noteRequired, noteTooLong }
}

/**
 * The door's refusal codes (2418, 2420) → their `document` namespace keys. Two are borrowed from
 * existing guards: an SGH or Lab Booking delivery is refused under that guard's own code.
 */
export const MARK_DELIVERED_REFUSALS: Readonly<Record<string, string>> = {
  'SDD-00002': 'markDelivered.refused.notFound',
  'SDD-02151': 'markDelivered.refused.notADelivery',
  'SDD-02152': 'markDelivered.refused.notOutForDelivery',
  'SDD-02153': 'markDelivered.refused.cancellationPending',
  'SDD-02090': 'markDelivered.refused.sghOrder',
  'SDD-02441': 'markDelivered.refused.labBooking',
  'SDD-02150': 'markDelivered.refused.unknownReason',
  'SDD-02154': 'markDelivered.refused.noteRequired',
  'SDD-02155': 'markDelivered.refused.noteTooLong',
}

/** A refusal code's key, or `null` for a code this client does not know (show the server's sentence). */
export function refusalKeyOf(code: string | null | undefined): string | null {
  return (code && MARK_DELIVERED_REFUSALS[code]) || null
}

/**
 * A reason's label key, by code. The server sends English only (`SdDocumentReason` has no Arabic
 * column, 2421), so the labels are this client's; a code it does not know falls back to the
 * server's description at the call site.
 */
export function reasonLabelKey(code: string): string {
  return `markDelivered.reasons.${trimmed(code)}`
}
