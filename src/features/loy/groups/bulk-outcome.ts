/**
 * What a bulk load did (oms ticket 633; door BackOffice 3175) — pure. The door answers a count per
 * outcome and the lines it did not add, each with its outcome. This orders them for the screen: the
 * counts in a fixed order under keys the locale names, and the rejected lines grouped by reason in that
 * same order.
 *
 * 🚩 An outcome this screen does not know is still listed (with the server's own word) and counted
 * under `other` — never dropped, so the counts can still be checked against the lines sent.
 *
 * ⚠️ GUESS until BackOffice 3175 ships: a rejected line's `outcome` spells its count's key
 * (`NotAMobile`, `notAMobile` or `NOT_A_MOBILE` — case and underscores are ignored).
 */
import type { LoyGroupBulkResult } from '@/core/models/loy-groups'

export const BULK_OUTCOMES = ['added', 'alreadyInGroup', 'duplicateInBatch', 'notAMobile', 'placeholder'] as const
export type BulkOutcomeKey = (typeof BULK_OUTCOMES)[number]

export interface BulkCount {
  key: BulkOutcomeKey | 'other'
  count: number
}

export interface BulkRejectedLine {
  /** As the user typed it — shown verbatim. */
  line: string
  /** The server's outcome word. */
  outcome: string
  /** Its known key, or `null` for an outcome this screen does not know. */
  reason: BulkOutcomeKey | null
}

export interface BulkOutcome {
  counts: BulkCount[]
  rejected: BulkRejectedLine[]
  /** The sum of every count. */
  total: number
  /** How many lines were sent. */
  sent: number
  /** The counts make up every line sent. */
  accountedFor: boolean
}

const fold = (s: string) => s.replace(/_/g, '').toLowerCase()
const KEY_OF = new Map<string, BulkOutcomeKey>(BULK_OUTCOMES.map((k) => [fold(k), k]))
const countOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export function bulkOutcome(result: LoyGroupBulkResult, sent: number): BulkOutcome {
  const raw = Array.isArray(result?.rejected) ? result.rejected : []
  const lines: BulkRejectedLine[] = raw.map((r) => {
    const outcome = String(r?.outcome ?? '')
    return { line: String(r?.line ?? ''), outcome, reason: KEY_OF.get(fold(outcome)) ?? null }
  })
  const rank = (r: BulkRejectedLine) => (r.reason === null ? BULK_OUTCOMES.length : BULK_OUTCOMES.indexOf(r.reason))
  // `sort` is stable: within one reason the server's order stays.
  const rejected = [...lines].sort((a, b) => rank(a) - rank(b))

  const counts: BulkCount[] = BULK_OUTCOMES.map((key) => ({ key, count: countOf(result?.[key]) }))
  const other = rejected.filter((r) => r.reason === null).length
  if (other > 0) counts.push({ key: 'other', count: other })
  const total = counts.reduce((sum, c) => sum + c.count, 0)
  return { counts, rejected, total, sent, accountedFor: total === sent }
}
