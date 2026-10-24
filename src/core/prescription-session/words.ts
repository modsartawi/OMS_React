/**
 * The prescription session's code words (BackOffice spec 2994, oms ticket 544): a code SIS.Api
 * sends — a state, a next step's owner, a route, a source, a badge, an after-close kind — to its
 * key in the `prescription-session` namespace. In `@/core/` because Document Details (544) and the
 * HQ list (545-548) say the same codes the same way, and a feature never imports a feature.
 *
 * An unknown code (SIS.Api grew one) has no key: it is shown as the code itself, never as a raw
 * key. Pure: no React, no `t` here except the one `wordText` that takes it.
 */

/** The namespace these keys live in (core-owned, like `attachments`; EN + AR). */
export const PRESCRIPTION_SESSION_NS = 'prescription-session'

/** A code's word: its key when the code is known, else `null`, and the code as it came. */
export interface CodeWord {
  key: string | null
  raw: string
}

/** PrescriptionSessionStates, in their lifecycle order (`PrescriptionSessionConstants.cs`). */
export const PRESCRIPTION_SESSION_STATES = [
  'DRAFT',
  'VALIDATING',
  'AWAITING_APPROVAL',
  'APPROVED',
  'AWAITING_ORDER',
  'PICKING',
  'AWAITING_DELIVERY',
  'DISPENSED',
  'INVOICED',
  'CLOSED',
  'ABANDONED',
  'WRITTEN_OFF',
] as const

/** NextStepOwners. */
export const PRESCRIPTION_STEP_OWNERS = ['HOLDING_STORE', 'PAYER', 'CUSTOMER', 'DONOR_STORE', 'SYSTEM', 'NONE'] as const

/** The two routes; a null route is "not chosen yet". */
export const PRESCRIPTION_SESSION_ROUTES = ['COUNTER', 'DELIVERY'] as const

/** The two sources: NPHIES and Wasfaty. */
export const PRESCRIPTION_SOURCE_KINDS = ['NPHS', 'WSFT'] as const

/** NextStepBadges. */
export const PRESCRIPTION_STEP_BADGES = ['EXPIRES_TOMORROW'] as const

/** PrescriptionSessionAfterCloseKinds. */
export const PRESCRIPTION_AFTER_CLOSE_KINDS = ['RETURN', 'CORRECTION', 'RESALE'] as const

/** Why an HQ row shows a second store (ticket 545; `PrescriptionSessionHqOtherStoreReasons`). */
export const PRESCRIPTION_OTHER_STORE_REASONS = ['DONOR', 'TRANSFER'] as const

/** The Notification Center items an HQ row can have open (`PrescriptionSessionHqItems` + 3013's kinds). */
export const PRESCRIPTION_OPEN_ITEMS = ['INVOICE_OWED', 'STALLED', 'LAPSE_WARNING'] as const

/** The HQ list's flags, as the `flag` filter takes them (`PrescriptionSessionHqFlags`). */
export const PRESCRIPTION_HQ_FLAGS = ['STALLED', 'ABOUT_TO_LAPSE', 'OWED'] as const
export type PrescriptionHqFlag = (typeof PRESCRIPTION_HQ_FLAGS)[number]

/** A word for `code` from one closed list: an own-list match only, so `toString` is never a code. */
function wordFrom(list: readonly string[], prefix: string, code: string | null | undefined): CodeWord {
  const raw = code ?? ''
  return list.includes(raw) ? { key: `${prefix}.${raw}`, raw } : { key: null, raw }
}

export const stateWord = (code: string | null | undefined): CodeWord => wordFrom(PRESCRIPTION_SESSION_STATES, 'state', code)

export const ownerWord = (code: string | null | undefined): CodeWord => wordFrom(PRESCRIPTION_STEP_OWNERS, 'owner', code)

/** A route; null or blank is "not chosen" — a word, not an absence. */
export function routeWord(code: string | null | undefined): CodeWord {
  if (code == null || code === '') return { key: 'route.notChosen', raw: '' }
  return wordFrom(PRESCRIPTION_SESSION_ROUTES, 'route', code)
}

export const sourceWord = (code: string | null | undefined): CodeWord => wordFrom(PRESCRIPTION_SOURCE_KINDS, 'source', code)

export const badgeWord = (code: string | null | undefined): CodeWord => wordFrom(PRESCRIPTION_STEP_BADGES, 'badge', code)

export const afterCloseKindWord = (code: string | null | undefined): CodeWord =>
  wordFrom(PRESCRIPTION_AFTER_CLOSE_KINDS, 'afterClose.kind', code)

export const otherStoreReasonWord = (code: string | null | undefined): CodeWord =>
  wordFrom(PRESCRIPTION_OTHER_STORE_REASONS, 'otherStoreReason', code)

export const openItemWord = (code: string | null | undefined): CodeWord => wordFrom(PRESCRIPTION_OPEN_ITEMS, 'openItem', code)

export const flagWord = (code: string | null | undefined): CodeWord => wordFrom(PRESCRIPTION_HQ_FLAGS, 'flag', code)

/**
 * The text a word reads as: `t(key)` when known, else the code itself. `t` is the caller's,
 * bound to the `prescription-session` namespace.
 */
export function wordText(t: (key: string) => string, word: CodeWord): string {
  return word.key === null ? word.raw : t(word.key)
}
