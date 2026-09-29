/**
 * The bulk screen's list of delivery numbers (ticket 332) — pure.
 *
 * The officer pastes, or adds from a file, and the one parser here decides what the
 * request will carry. It never judges a value: an order number or a partner reference is
 * kept and sent, and the server answers it as "not a delivery" (spec 2094 story 6). What
 * this module owns is only the shape — split, trim, dedupe, count against the cap.
 */

/** What a pasted list will send. */
export interface DeliveryList {
  /** Distinct values, first occurrence first. NEVER truncated to the cap. */
  numbers: string[]
  /** How many repeats were collapsed. */
  duplicates: number
  /** How many distinct values over the cap the list is; 0 when it can be sent. */
  overBy: number
}

/**
 * One token, with the quoting a spreadsheet adds when a column is copied out of it:
 * `"123"` (a quoted CSV cell), `="123"` (Excel's keep-as-text formula) and `'123`
 * (Excel's text prefix).
 */
function clean(token: string): string {
  let t = token.trim()
  const formula = /^="(.*)"$/.exec(t)
  if (formula) t = formula[1]
  else if (/^"(.*)"$/.test(t)) t = t.slice(1, -1)
  if (t.startsWith("'")) t = t.slice(1)
  return t.trim()
}

/**
 * Split on line breaks, commas, semicolons, tabs and spaces; trim; drop blanks; collapse
 * duplicates ordinally (as the server does, so the count shown is the count it will see).
 *
 * The cap is reported, not applied: a list of 205 keeps all 205 so the officer can split
 * it, rather than having five silently dropped.
 */
export function parseDeliveryList(text: string, cap: number): DeliveryList {
  const seen = new Set<string>()
  const numbers: string[] = []
  let duplicates = 0
  for (const token of text.split(/[\s,;]+/)) {
    const value = clean(token)
    if (!value) continue
    if (seen.has(value)) {
      duplicates++
      continue
    }
    seen.add(value)
    numbers.push(value)
  }
  return { numbers, duplicates, overBy: Math.max(0, numbers.length - cap) }
}

/** A value that looks like a delivery number: a long run of digits. */
const LONG_NUMBER = /^\d{8,}$/

/** All digits. */
const NUMBER = /^\d+$/
/** A header naming the delivery number — the WHOLE cell, so a title like "Deliveries not
 *  invoiced" above the header does not claim its column. */
const DELIVERY_HEADER = /^deliver(y|ies)?[\s_.-]*(no\.?|nos\.?|number|num|#|id)?$/i
/** How far down a header is looked for — a title row or two may sit above it. */
const HEADER_ROWS = 5

/**
 * The cells of the column a file's delivery numbers are in.
 *
 * A column HEADED as the delivery number wins outright: a sheet may carry order numbers
 * beside the deliveries, and both are ten digits. Otherwise the column is chosen by
 * CONTENT — the rollout sheet (spec 2094) heads its delivery numbers "Order No" beside a
 * "Store" column of short codes, so no header names them. The column holding the most
 * long numbers wins; a tie goes to the leftmost; a file with none falls back to the first
 * column.
 *
 * Every non-number above the column's first number is a title or a header and is dropped
 * (with no number at all, only the first row is). Every other non-blank cell is kept,
 * number or not — the server answers each.
 */
export function deliveryColumn(rows: readonly (readonly string[])[]): string[] {
  let best = -1
  for (const row of rows.slice(0, HEADER_ROWS)) {
    best = row.findIndex((cell) => DELIVERY_HEADER.test(cell) && !NUMBER.test(clean(cell)))
    if (best >= 0) break
  }
  if (best < 0) {
    best = 0
    let bestScore = 0
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
    for (let col = 0; col < width; col++) {
      const score = rows.filter((row) => LONG_NUMBER.test(clean(row[col] ?? ''))).length
      if (score > bestScore) {
        best = col
        bestScore = score
      }
    }
  }
  const cells = rows.map((row) => clean(row[best] ?? ''))
  const firstNumber = cells.findIndex((cell) => NUMBER.test(cell))
  const body = firstNumber >= 0 ? cells.slice(firstNumber) : cells.slice(1)
  return body.filter((cell) => cell !== '')
}

/** A leading byte-order mark, which Excel writes at the head of a UTF-8 CSV. */
const BOM = String.fromCharCode(0xfeff)

/**
 * A CSV file's rows. RFC 4180 quoting (a quoted cell may hold the separator, a line break
 * or a doubled quote), CRLF or LF, a leading BOM dropped.
 *
 * The separator is the file's `sep=` line when it has one, else whichever of comma,
 * semicolon and tab is commonest over the first ten lines (not the first alone: a title
 * line holds none) — Excel saves with `;` in an Arabic locale, and a one-column file has
 * none at all.
 */
export function csvRows(text: string): string[][] {
  let body = text.startsWith(BOM) ? text.slice(1) : text
  let sep = ','
  const declared = /^sep=(.)\r?\n/.exec(body)
  if (declared) {
    sep = declared[1]
    body = body.slice(declared[0].length)
  } else {
    const head = body.split(/\r?\n/, 10).join('\n')
    const counts = [',', ';', '\t'].map((c) => [c, head.split(c).length - 1] as const)
    const commonest = counts.reduce((a, b) => (b[1] > a[1] ? b : a))
    if (commonest[1] > 0) sep = commonest[0]
  }

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quoted) {
      if (ch === '"' && body[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && body[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** How an added file is read. */
export type FileKind = 'xlsx' | 'utf-8' | 'utf-16le' | 'utf-16be' | 'unsupported'

/**
 * How to read an added file — by its bytes, not its extension, since a renamed file is
 * common and the extension says nothing about the encoding.
 *
 * A workbook is the full zip signature `PK\x03\x04`, never just `PK` (a CSV may open with
 * a store code like `PK01`). A UTF-16 text export (Excel's "Unicode Text") is known by its
 * byte-order mark. An old binary `.xls` (OLE) and any other file holding NUL bytes is
 * refused: decoded as text it would put noise into the list, which would then be sent.
 */
export function fileKind(bytes: Uint8Array): FileKind {
  const at = (i: number) => bytes[i]
  if (at(0) === 0x50 && at(1) === 0x4b && at(2) === 0x03 && at(3) === 0x04) return 'xlsx'
  if (at(0) === 0xff && at(1) === 0xfe) return 'utf-16le'
  if (at(0) === 0xfe && at(1) === 0xff) return 'utf-16be'
  if (at(0) === 0xd0 && at(1) === 0xcf && at(2) === 0x11 && at(3) === 0xe0) return 'unsupported'
  if (bytes.subarray(0, 4096).includes(0)) return 'unsupported'
  return 'utf-8'
}
