// The WPF tab-separated import, read on this side first (spec 430 D14, ticket 437). Pure: text in,
// a preview out; no `t`, no DOM, no api. Generic over a column spec, so every import screen
// (Cities, Districts, Document source users) supplies its columns and reads the file the same way.
// The dialog that draws it is `./ImportDialog` (graduated at ticket 438, its second feature).
//
// The format is WPF's own, so existing files and habits still work:
// - a row per line, `\r\n` or `\n`, empty lines dropped;
// - columns split on a tab;
// - a trailing `X` (either case) after the spec's columns makes the line a delete.
//
// Where it is stricter than WPF, on purpose: WPF indexed `values[n]` blindly, so a short line threw
// and a long one shifted silently. Here a line must hold exactly the spec's columns, or those plus
// the `X`; anything else is an error line, and an import with one is not sent.
//
// 🚩 There is NO header skip. A header is an ordinary line in the preview, so the user sees it
// before it becomes a city named "CityCode". Values are sent as written: the server trims and
// upper-cases codes, as it does for WPF.

/** Why a line cannot be sent. One kind today: the wrong number of columns. */
export interface ImportLineError {
  code: 'COLUMN_COUNT'
  /** The columns the line holds. */
  found: number
  /** The columns the spec asks for (one more is allowed when it is the `X`). */
  expected: number
}

/** A line that reads: what it asks for, by the spec's column keys. */
export interface ImportOkLine<K extends string> {
  /** 1-based among the lines sent (empty lines are not lines). */
  line: number
  cells: string[]
  action: 'upsert' | 'delete'
  fields: Record<K, string>
  error?: undefined
}

/** A line that does not read; its cells are kept for the preview. */
export interface ImportErrorLine {
  line: number
  cells: string[]
  error: ImportLineError
  action?: undefined
  fields?: undefined
}

export type ImportLine<K extends string> = ImportOkLine<K> | ImportErrorLine

/** The file's text as the lines of an import, by a column spec (the field keys, in file order). */
export function parseImport<K extends string>(text: string, columns: readonly K[]): ImportLine<K>[] {
  const rows = text.split(/\r?\n/).filter((row) => row !== '')
  return rows.map((row, i): ImportLine<K> => {
    const line = i + 1
    const cells = row.split('\t')
    const extra = cells.length - columns.length
    const isDelete = extra === 1 && cells[columns.length].toUpperCase() === 'X'
    if (extra !== 0 && !isDelete) {
      return { line, cells, error: { code: 'COLUMN_COUNT', found: cells.length, expected: columns.length } }
    }
    const fields = Object.fromEntries(columns.map((key, c) => [key, cells[c]])) as Record<K, string>
    return { line, cells, action: isDelete ? 'delete' : 'upsert', fields }
  })
}

/**
 * The lines to send, in file order — or `null` while Send is not offered (it needs at least one
 * line, and none in error). Never a filtered subset: the server's 1-based `line` must stay the preview's.
 */
export function sendableLines<K extends string>(lines: readonly ImportLine<K>[]): ImportOkLine<K>[] | null {
  const ok: ImportOkLine<K>[] = []
  for (const l of lines) {
    if (l.error) return null
    ok.push(l)
  }
  return ok.length > 0 ? ok : null
}

/** What the preview says it holds. */
export function importTally(lines: readonly ImportLine<string>[]) {
  let upserts = 0
  let deletes = 0
  let errors = 0
  for (const l of lines) {
    if (l.error) errors++
    else if (l.action === 'delete') deletes++
    else upserts++
  }
  return { lines: lines.length, upserts, deletes, errors }
}

/**
 * A picked file's bytes as text, by its BOM as WPF's `StreamReader` reads it: Excel's "Unicode
 * text" is UTF-16 LE, and a file with no BOM is UTF-8. The BOM itself is not part of the text.
 *
 * 🚩 Throws on bytes that are not valid UTF-8 — Excel's plain "Text (Tab delimited)" is the ANSI
 * code page, whose Arabic would otherwise read as replacement characters and be SENT as names.
 */
export function decodeImportFile(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  // The UTF-8 decoder drops a UTF-8 BOM itself.
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}
