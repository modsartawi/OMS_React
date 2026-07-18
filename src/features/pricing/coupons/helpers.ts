// Client-side coupon-import parsing (ticket 522). Mirrors the SERVER ImportFileParser
// (Retail.Data/Modules/Coupons/V2/Helpers/ImportFileParser.cs) byte-for-byte so the
// browser preview matches what the server will accept — but the server remains the
// authority: on submit (519) it re-dedupes and re-enforces the 100k cap as the backstop.

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
