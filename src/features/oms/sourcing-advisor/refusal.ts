/**
 * The door's refusal codes (spec 734 D20) as `sourcing-advisor` i18n keys. Pure.
 * A code the screen does not know returns `null`, and the page shows the server's own message.
 */
import { apiErrorCode } from '@/core/api'

const REFUSAL_KEYS: Readonly<Record<string, string>> = {
  'SOURCING-401': 'refusal.noGrant',
  'SOURCING-402': 'refusal.badRange',
  'SOURCING-403': 'refusal.notScored',
  'SOURCING-404': 'refusal.notScoredRange',
}

export function refusalKey(err: unknown): string | null {
  const code = apiErrorCode(err)
  return code ? (REFUSAL_KEYS[code] ?? null) : null
}
