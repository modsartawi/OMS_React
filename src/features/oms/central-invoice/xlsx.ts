/**
 * The first sheet of an `.xlsx`, as rows of text (ticket 332) — just enough to lift a
 * column of delivery numbers out of the rollout sheet.
 *
 * 🚩 **No dependency, on purpose.** The repo ships a workbook *writer* and no reader, and
 * a whole reader library for one column is out of proportion. An `.xlsx` is a zip of XML
 * parts: the zip's central directory gives each part's offset and size, a part is stored
 * or deflated, and the browser inflates natively (`DecompressionStream('deflate-raw')`).
 * The XML read here is the narrow, machine-written SpreadsheetML Excel emits — cell
 * references, shared strings, inline strings — read with patterns rather than a DOM so
 * the module stays testable in the node runner.
 *
 * Out of scope, and refused rather than misread: ZIP64 archives, encrypted workbooks and
 * the binary `.xlsb`/`.xls` formats. They fail as "not a workbook we can read", and the
 * officer can still paste.
 */

const EOCD = 0x06054b50
const CENTRAL = 0x02014b50
const LOCAL = 0x04034b50

interface ZipEntry {
  method: number
  compressedSize: number
  localOffset: number
}

function entries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end-of-central-directory record sits in the last 22 bytes plus up to a 64 KiB comment.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('not a zip archive')

  const count = view.getUint16(eocd + 10, true)
  let at = view.getUint32(eocd + 16, true)
  const names = new TextDecoder()
  const found = new Map<string, ZipEntry>()
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== CENTRAL) throw new Error('corrupt zip directory')
    const nameLength = view.getUint16(at + 28, true)
    const extraLength = view.getUint16(at + 30, true)
    const commentLength = view.getUint16(at + 32, true)
    found.set(names.decode(bytes.subarray(at + 46, at + 46 + nameLength)), {
      method: view.getUint16(at + 10, true),
      compressedSize: view.getUint32(at + 20, true),
      localOffset: view.getUint32(at + 42, true),
    })
    at += 46 + nameLength + extraLength + commentLength
  }
  return found
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** One part's text, or null when the archive has no such part. */
async function part(bytes: Uint8Array, zip: Map<string, ZipEntry>, name: string): Promise<string | null> {
  const entry = zip.get(name)
  if (!entry) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const at = entry.localOffset
  if (view.getUint32(at, true) !== LOCAL) throw new Error('corrupt zip entry')
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  const raw = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return new TextDecoder().decode(raw)
  if (entry.method === 8) return new TextDecoder().decode(await inflate(raw))
  throw new Error(`unsupported zip method ${entry.method}`)
}

function unescapeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const lower = e.toLowerCase()
    if (lower === 'amp') return '&'
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    return String.fromCodePoint(lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10))
  })
}

/** The text of a string item (`<si>` or `<is>`): every `<t>` run, phonetic runs excluded. */
function runs(xml: string): string {
  const visible = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let text = ''
  for (const m of visible.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) text += m[1]
  return unescapeXml(text)
}

function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)
  return m ? m[1] : null
}

/** The first sheet in WORKBOOK order — not `sheet1.xml`, which is only the first one made. */
async function firstSheetPath(bytes: Uint8Array, zip: Map<string, ZipEntry>): Promise<string> {
  const workbook = (await part(bytes, zip, 'xl/workbook.xml')) ?? ''
  const rels = (await part(bytes, zip, 'xl/_rels/workbook.xml.rels')) ?? ''
  const sheet = /<sheet\b([^>]*)\/?>/.exec(workbook)
  const id = sheet ? attr(sheet[1], 'r:id') : null
  if (id) {
    for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
      if (attr(m[1], 'Id') !== id) continue
      const target = attr(m[1], 'Target') ?? ''
      return target.startsWith('/') ? target.slice(1) : `xl/${target}`
    }
  }
  return 'xl/worksheets/sheet1.xml'
}

/** `B12` → 1. */
function columnIndex(ref: string): number {
  let col = 0
  for (const ch of ref.replace(/\d+$/, '')) col = col * 26 + (ch.charCodeAt(0) - 64)
  return col - 1
}

/** A numeric cell as text. Excel may write a whole number as `8.006456512E9`; a delivery
 *  number must come back as its digits. */
function numberText(value: string): string {
  if (/^-?\d+$/.test(value)) return value
  const n = Number(value)
  return Number.isSafeInteger(n) ? String(n) : value
}

/**
 * The first sheet's rows, each cell at its column position (a gap is `''`), an empty row
 * `[]`. Throws when the bytes are not a workbook this reader can open.
 */
export async function xlsxRows(bytes: Uint8Array): Promise<string[][]> {
  const zip = entries(bytes)
  const sheetXml = await part(bytes, zip, await firstSheetPath(bytes, zip))
  if (sheetXml === null) throw new Error('workbook has no sheet')
  const sharedXml = (await part(bytes, zip, 'xl/sharedStrings.xml')) ?? ''
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => runs(m[1]))

  const rows: string[][] = []
  for (const r of sheetXml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row: string[] = []
    for (const c of (r[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]
      const inner = c[2] ?? ''
      const ref = attr(attrs, 'r')
      const col = ref ? columnIndex(ref) : row.length
      const type = attr(attrs, 't')
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1] ?? ''
      let text: string
      if (type === 's') text = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') text = runs(inner)
      else if (type === 'str' || type === 'e' || type === 'b') text = unescapeXml(v)
      else text = numberText(v)
      while (row.length < col) row.push('')
      row[col] = text
    }
    rows.push(row)
  }
  return rows
}
