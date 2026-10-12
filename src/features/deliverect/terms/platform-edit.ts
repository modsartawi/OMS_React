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
