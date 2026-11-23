/**
 * Bulk Mark Tested on the bulk change screen (BackOffice spec 4190 stories 40–43, server ticket 4194;
 * oms 959). Pure.
 *
 * The server runs the single Mark Tested path on each row (tester grant, Planned check, re-validation,
 * test mark, audit, cache eviction), so nothing here decides what is tested: it picks the rows, builds
 * the request and reads the answer. There is no bulk Activate.
 */
import { canTestBbyMaintain } from '@/core/bonus-buy/access'
import type { BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import type {
  BbyBulkListRow,
  BbyBulkMarkTestedRequest,
  BbyBulkMarkTestedResult,
  BbyBulkTarget,
} from '@/core/models/bonus-buy-bulk'
import { lockReason } from './selection'

/** The action is shown only with the tester grant (`BbyMaintain:04`) beside the screen grant (story 42). */
export const canMarkBulkTested = canTestBbyMaintain

/** `BbyTestMark.Note`'s width (`NVARCHAR(200)`), as the single Mark Tested caps it. */
export const BULK_TEST_NOTE_MAX = 200

/**
 * The batch to mark: the selected rows when there are any; otherwise the rows the last apply saved,
 * read off the refreshed list (so each goes at its new version) and only while still Planned.
 */
export function markTestedTargets(
  selected: readonly BbyBulkListRow[],
  lastSaved: readonly string[],
  list: readonly BbyBulkListRow[],
): BbyBulkTarget[] {
  const pick = (r: BbyBulkListRow): BbyBulkTarget => ({ bbyNumber: r.bbyNumber, version: r.version })
  if (selected.length > 0) return selected.map(pick)
  const saved = new Set(lastSaved)
  return list.filter((r) => saved.has(r.bbyNumber) && lockReason(r) === null).map(pick)
}

/** The request: every bonus buy at its version, and the one note (blank → null, as the single Mark Tested). */
export function markTestedRequest(targets: readonly BbyBulkTarget[], note: string): BbyBulkMarkTestedRequest {
  return {
    bonusBuys: targets.map((t) => ({ bbyNumber: t.bbyNumber, version: t.version })),
    note: note.trim() || null,
  }
}

/** `tested` is the test mark written; `refuse` is not; any word the screen does not know is never shown as tested. */
export type MarkOutcome = 'tested' | 'refuse' | 'unknown'

export interface MarkRow {
  number: string
  outcome: MarkOutcome
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
}

export interface MarkTestedReading {
  batchId: string | null
  /** Refused before any row was touched (no tester grant, over the cap, nothing sent). */
  refusedWhole: boolean
  batchRefusals: BbyRefusal[]
  batchWarnings: BbyRefusal[]
  rows: MarkRow[]
  counts: Record<MarkOutcome, number>
}

function outcomeOf(status: string): MarkOutcome {
  if (status === 'saved' || status === 'tested') return 'tested'
  if (status === 'refused') return 'refuse'
  return 'unknown'
}

export function readMarkTested(result: BbyBulkMarkTestedResult): MarkTestedReading {
  const rows: MarkRow[] = (result.bonusBuys ?? []).map((r) => ({
    number: r.number,
    outcome: outcomeOf(r.status),
    refusals: r.refusals ?? [],
    warnings: r.warnings ?? [],
  }))
  const counts: Record<MarkOutcome, number> = { tested: 0, refuse: 0, unknown: 0 }
  for (const r of rows) counts[r.outcome]++
  return {
    batchId: result.batchId ?? null,
    refusedWhole: result.status === 'refused' && rows.length === 0,
    batchRefusals: result.refusals ?? [],
    batchWarnings: result.warnings ?? [],
    rows,
    counts,
  }
}
