import type { GuardItemProblem } from './guard-answer'
import type { GuardSuggestion } from './guard-check'

// The `insurance-order-guards` keys the guard dialog builds from data (ticket 616), in one place so the
// locale test can prove each exists. Pure.

/** A fired rule's problem → its sentence. A REFUSE and an OVERRIDE without the grant say what to do instead. */
export const PROBLEM_KEYS: Record<GuardItemProblem, string> = {
  remove: 'guard.refuse',
  noGrant: 'guard.noGrant',
  interventionMissing: 'guard.problem.interventionMissing',
  outcomeMissing: 'guard.problem.outcomeMissing',
  reasonMissing: 'guard.problem.reasonMissing',
  reasonCapped: 'guard.problem.reasonCapped',
  ackMissing: 'guard.problem.ackMissing',
}

/** A template's suggestion → its sentence (`<n>` slot for the value). */
export const SUGGESTION_KEYS: Record<keyof GuardSuggestion, string> = {
  maxQuantity: 'guard.suggestion.maxQuantity',
  maxDaysSupply: 'guard.suggestion.maxDaysSupply',
}

/** The suggestions a fired rule carries, in a fixed order, with their values as text. */
export function suggestionsOf(s: GuardSuggestion | null | undefined): Array<{ key: string; value: string }> {
  if (!s) return []
  return (Object.keys(SUGGESTION_KEYS) as Array<keyof GuardSuggestion>)
    .filter((k) => s[k] !== undefined && s[k] !== null && String(s[k]) !== '')
    .map((k) => ({ key: SUGGESTION_KEYS[k], value: String(s[k]) }))
}
