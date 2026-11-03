import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import { formatDateTime } from '@/core/util/date-format'

/**
 * The copilot's refusals (ticket 737, spec 734 D7) — each envelope code to its own words in the
 * `copilot` namespace, so a refusal never shows its raw code. A code the panel has no words for is
 * the server's own message, through `apiErrorMessage`.
 *
 * A session expiry (HTTP 401) never reaches here: `core/api`'s `handle401` owns it. `COPILOT-401` is
 * the missing grant, a business outcome inside the envelope.
 */

const KEYS: Record<string, string> = {
  'COPILOT-401': 'refusal.noGrant',
  'COPILOT-402': 'refusal.rateLimit',
  'COPILOT-403': 'refusal.personalData',
  'COPILOT-404': 'refusal.unreachable',
  'COPILOT-405': 'refusal.tooLong',
  'COPILOT-406': 'refusal.conversationOver',
}

/** A refusal the panel words itself (`key`, with 402's reset time) or the server's message as it came. */
export type CopilotRefusalView = { key: string; resetAt: string | null } | { message: string }

/**
 * ⚠ D10 names no field for 402's reset time. It is read from the refusal's `data` as `resetAt`
 * (estate local `yyyy-MM-ddTHH:mm:ss`, like `askedAt`), defensively: without one, the limit is
 * named without a time — and so is one that does not read as a time (review item 6: an unparseable
 * or unset value would format to '' and leave "ask again at .").
 */
function resetAtOf(err: unknown): string | null {
  const data = apiErrorData(err)
  const v = data && typeof data === 'object' ? (data as { resetAt?: unknown }).resetAt : null
  return typeof v === 'string' && formatDateTime(v) !== '' ? v : null
}

export function copilotRefusal(err: unknown, fallback: string): CopilotRefusalView {
  const code = apiErrorCode(err)
  const key = code ? KEYS[code] : undefined
  if (!key) return { message: apiErrorMessage(err, fallback) }
  if (code === 'COPILOT-402') {
    const resetAt = resetAtOf(err)
    return resetAt ? { key, resetAt } : { key: 'refusal.rateLimitNoTime', resetAt: null }
  }
  return { key, resetAt: null }
}
