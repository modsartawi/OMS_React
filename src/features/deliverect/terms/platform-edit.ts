import type { DeliverectPlatform, DeliverectPlatformBody } from '@/core/models/deliverect'

// Editing a delivery platform (ticket 482; contract § Platforms and terms, `PUT Platforms/{key}`).
// Pure: no React, no `t`.
//
// 🚩 A platform with no credit customer cannot be active: its orders would be refused (spec 2615,
// story 4 — refused rather than guessed). The client never flips `active` itself: it refuses to send
// an active platform without one and says why, and the user unticks it.

/** The edit fields as typed. */
export interface PlatformDraft {
  displayName: string
  channelId: string
  creditCustomer: string
  active: boolean
}

export type PlatformField = keyof PlatformDraft
export type PlatformProblem = 'required' | 'wholeNumber' | 'noCreditCustomer'

/** The PUT body without its reason. */
export type PlatformValue = Omit<DeliverectPlatformBody, 'reason'>

/** A new platform's fields: empty, and not active (it has no credit customer yet). */
export const EMPTY_PLATFORM_DRAFT: PlatformDraft = { displayName: '', channelId: '', creditCustomer: '', active: false }

/** `DlvPlatform.PlatformKey`'s width (VARCHAR(26)). */
export const PLATFORM_KEY_MAX = 26

export type PlatformKeyProblem = 'required' | 'keyFormat'

/**
 * A new platform's key, as typed: trimmed and upper-cased (`JAHEZ`, `KEETA`, `HUNGERSTATION`). A
 * machine value — letters, digits, `_` and `-`, at most 26 — never edited once added.
 */
export function parsePlatformKey(raw: string): { value: string | null; problem: PlatformKeyProblem | null } {
  const key = raw.trim().toUpperCase()
  if (key === '') return { value: null, problem: 'required' }
  if (key.length > PLATFORM_KEY_MAX || !/^[A-Z0-9_-]+$/.test(key)) return { value: null, problem: 'keyFormat' }
  return { value: key, problem: null }
}

/** The fields as the row has them; a null credit customer is an empty field. */
export function platformDraftOf(p: DeliverectPlatform): PlatformDraft {
  return { displayName: p.displayName, channelId: String(p.channelId), creditCustomer: p.creditCustomer ?? '', active: p.active }
}

/**
 * The fields read into the PUT body, or the problem with each. `activeBlocked` is true while there is
 * no credit customer — the Active box cannot be ticked, and the dialog says why.
 */
export function parsePlatformDraft(draft: PlatformDraft): {
  value: PlatformValue | null
  problems: Partial<Record<PlatformField, PlatformProblem>>
  activeBlocked: boolean
} {
  const problems: Partial<Record<PlatformField, PlatformProblem>> = {}
  const displayName = draft.displayName.trim()
  const channel = draft.channelId.trim()
  const creditCustomer = draft.creditCustomer.trim() || null
  const activeBlocked = creditCustomer === null

  if (displayName === '') problems.displayName = 'required'
  // ASCII digits only: the channel id is Deliverect's integer.
  if (!/^\d+$/.test(channel) || !Number.isSafeInteger(Number(channel))) problems.channelId = 'wholeNumber'
  if (activeBlocked && draft.active) problems.active = 'noCreditCustomer'

  if (Object.keys(problems).length > 0) return { value: null, problems, activeBlocked }
  return { value: { displayName, channelId: Number(channel), creditCustomer, active: draft.active }, problems, activeBlocked }
}

/** Whether the parsed fields are the row as it stands — Save waits for a change. */
export function samePlatform(value: PlatformValue, p: DeliverectPlatform): boolean {
  return (
    value.displayName === p.displayName &&
    value.channelId === p.channelId &&
    value.creditCustomer === (p.creditCustomer ?? null) &&
    value.active === p.active
  )
}
