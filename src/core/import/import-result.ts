import type { ImportResultModel } from '@/core/models/import-result'

// An import door's answer, read for the result view (spec 430 D8, ticket 437). Pure: the known
// reasons come back as KEYS the feature words in its own namespace, and any other reason is kept
// as its code — a skipped line is never dropped because its reason is new.

/** The reasons D8 names, and the key each is worded by. */
const KNOWN_REASONS: Record<string, ImportReasonKey> = {
  UNKNOWN_CITY: 'unknownCity',
  UNKNOWN_STAFF: 'unknownStaff',
  UNKNOWN_SOURCE: 'unknownSource',
}

export type ImportReasonKey = 'unknownCity' | 'unknownStaff' | 'unknownSource'

export interface ImportSkipView {
  line: number
  key: string
  /** The server's code, as sent. */
  reason: string
  /** Its wording's key, or `null` for a code this side does not know: show the code itself. */
  reasonKey: ImportReasonKey | null
}

export interface ImportResultView {
  applied: number
  unchanged: number
  skippedCount: number
  /** Nothing was skipped. */
  clean: boolean
  /** In file order. */
  skipped: ImportSkipView[]
}

const count = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

/** The answer as the result view shows it. A malformed answer reads as zeros, never a crash. */
export function importResult(r: Partial<ImportResultModel> | null | undefined): ImportResultView {
  const skipped = (Array.isArray(r?.skipped) ? r.skipped : [])
    .map((s) => {
      const reason = String(s?.reason ?? '')
      return {
        line: count(s?.line),
        key: String(s?.key ?? ''),
        reason,
        reasonKey: Object.hasOwn(KNOWN_REASONS, reason) ? KNOWN_REASONS[reason] : null,
      }
    })
    .sort((a, b) => a.line - b.line)
  return {
    applied: count(r?.applied),
    unchanged: count(r?.unchanged),
    skippedCount: skipped.length,
    clean: skipped.length === 0,
    skipped,
  }
}
