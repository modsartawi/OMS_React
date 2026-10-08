// Client-side coupon-import parsing (ticket 522). Mirrors the SERVER ImportFileParser
// (Retail.Data/Modules/Coupons/V2/Helpers/ImportFileParser.cs) byte-for-byte so the
// browser preview matches what the server will accept — but the server remains the
// authority: on submit (519) it re-dedupes and re-enforces the 100k cap as the backstop.

import type { TFunction } from 'i18next'
import type { CouponDetails, CouponTransaction, EarlierUpload, ImportJobDeletePreview, ImportJobStatus } from '@/core/models/coupons'
import { fsi } from '@/core/util/bidi'
import { type CodeListMeter, codeListMeter } from '@/core/util/code-list'

export const MAX_LINE_LENGTH = 256
export const MAX_CODES = 100_000

export interface ImportPreview {
  /** The distinct codes, in first-seen order (what gets POSTed). */
  codes: string[]
  /** How many non-blank lines were dropped as already-seen duplicates. */
  duplicates: number
}

export type ImportParseErrorKind = 'lineTooLong' | 'overCap'

/** A parse refusal the preview surfaces WITHOUT opening (a malformed file). `line` is
 *  the 1-based line number for `lineTooLong`; absent for `overCap`. */
export class ImportParseError extends Error {
  constructor(
    public readonly kind: ImportParseErrorKind,
    public readonly line?: number,
  ) {
    super(kind)
    this.name = 'ImportParseError'
  }
}

/**
 * Parse a chosen `.txt`/`.csv` file's text into a de-duped code list + a duplicate
 * count, exactly like the server:
 *  - `.csv` → the first comma-column of each line; otherwise the whole line;
 *  - trim; drop blank codes (blanks are NOT counted as duplicates);
 *  - ORDINAL (case-sensitive) dedupe;
 *  - a line longer than 256 chars → `ImportParseError('lineTooLong', n)`;
 *  - more than 100k DISTINCT codes → `ImportParseError('overCap')`.
 *
 * The length check is on the RAW line (before the csv split / trim), matching the
 * server's `line.Length > MaxLineLength` gate. A trailing newline yields a final empty
 * segment that is simply skipped — the server's ReadLine loop stops there, same result.
 */
export function parseImportText(text: string, fileName: string): ImportPreview {
  const isCsv = /\.csv$/i.test(fileName)
  const seen = new Set<string>()
  const codes: string[] = []
  let duplicates = 0

  const lines = text.split(/\r\n|\r|\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.length > MAX_LINE_LENGTH) throw new ImportParseError('lineTooLong', i + 1)

    const code = (isCsv ? (raw.split(',')[0] ?? '') : raw).trim()
    if (!code) continue
    if (seen.has(code)) {
      duplicates++
      continue
    }
    seen.add(code)
    codes.push(code)
    if (codes.length > MAX_CODES) throw new ImportParseError('overCap')
  }

  return { codes, duplicates }
}

/** Render a stored local ISO timestamp compactly. The value is already local wall-clock
 *  (no-utc-time rule) and carries no zone, so `new Date` parses it as local — no shift. */
export function formatStamp(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

/**
 * The template's origin filter (ticket 420, spec 2396 story 39): the same paste box, normaliser and
 * cap as the bonus buy's. ⚠ Flip to 3000 only with or after BackOffice 2403.
 */
export const TEMPLATE_ORIGIN_FILTER_MAX = 50

/** How many codes the origin filter holds, and its stored length against the cap. Never upper-cased. */
export const templateOriginFilterMeter = (value: string): CodeListMeter => codeListMeter(value, TEMPLATE_ORIGIN_FILTER_MAX)

// ── Deleting a mistaken upload (spec 2463, ticket 439) ──────────────────────────────────────

/** What a jobs-grid row offers. The server re-checks each one (a race answers 409). */
export interface JobActions {
  retry: boolean
  delete: boolean
}

/** Only a Failed job retries; a finished one (Completed or Failed) deletes; a Deleted one is done. */
export function jobActions(status: ImportJobStatus): JobActions {
  return {
    retry: status === 'Failed',
    delete: status === 'Completed' || status === 'Failed',
  }
}

/** A count grouped for reading (`2,904`). */
export const groupCount = (value: number): string => value.toLocaleString('en-US')

/** A count for a `t()` sentence: grouped and isolated whole (`fsi`, [bidi]). Not for exports. */
export const isolatedCount = (value: number): string => fsi(groupCount(value))

/**
 * The delete dialog's sentence, from the server's preview. Each count is isolated whole (`fsi`):
 * the sentence is plain text under RTL ([bidi]). The redeemed clause and the other-templates
 * sentence drop out when their count is zero.
 */
export function describeDeletePreview(preview: ImportJobDeletePreview, t: TFunction): string {
  const deletes = t(preview.redeemed > 0 ? 'import.delete.deletesRedeemed' : 'import.delete.deletes', {
    count: preview.toDelete,
    n: isolatedCount(preview.toDelete),
    redeemed: isolatedCount(preview.redeemed),
  })
  if (preview.inOtherTemplates === 0) return deletes
  const others = t('import.delete.otherTemplates', { count: preview.inOtherTemplates, n: isolatedCount(preview.inOtherTemplates) })
  return `${deletes} ${others}`
}

/** One block of a coupon's history in the detail pane. */
export type HistorySection =
  | { kind: 'current'; transactions: CouponTransaction[] }
  | { kind: 'earlier'; upload: EarlierUpload }

/**
 * The detail pane's history, exactly as the server grouped it: the current coupon's ledger first
 * (absent when the code is deleted), then one section per earlier upload in the order sent (oldest
 * first). Never re-split by date — a refund booked after a delete sits under the redemption it
 * reverses, which a split on `redemptionTime` would move (BackOffice 2466).
 */
export function couponHistorySections(details: CouponDetails): HistorySection[] {
  const earlier = details.earlierUploads.map((upload): HistorySection => ({ kind: 'earlier', upload }))
  return details.isDeleted ? earlier : [{ kind: 'current', transactions: details.transactions }, ...earlier]
}
