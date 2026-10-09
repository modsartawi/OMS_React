// The GS1 check's scan list (ticket 454, spec 2544 stories 41–42). Pure: no React, no `t`.
//
// 🚩 A scan is kept BYTE FOR BYTE — the GS control character (0x1D, FNC1) a DataMatrix read
// carries and the `#` a pasted string uses as its separator both stay exactly where they were, in
// the list AND in the request. Nothing here parses, trims or judges a code: the server's verdict
// is the only one the page shows.

/** The most scans the list holds — the door's own limit (`MAT-00005` over 500). */
export const GS1_LIST_CAP = 500

/** The GS control character (FNC1 in a DataMatrix read). */
export const GS = '\u001d'

/** One scan in the list. `id` is its place in the order scanned, never reused within a list. */
export interface ScanEntry {
  id: number
  /** The raw scan, exactly as read. */
  code: string
  /** The same code is already in the list above it — flagged on its own row, never merged. */
  duplicate: boolean
}

export interface ScanList {
  entries: ScanEntry[]
  /** The next entry's id. */
  nextId: number
}

export const emptyScanList: ScanList = { entries: [], nextId: 1 }

/**
 * The scans one input holds: a pasted block is one scan per line (`\r\n` or `\n`), and a line
 * that holds nothing but blanks is not a scan. Each line is otherwise kept as it is — not trimmed,
 * so a scan is sent byte for byte.
 */
export function splitScans(text: string): string[] {
  return text.split(/\r?\n|\r/).filter((line) => line.trim() !== '')
}

export interface AddResult {
  list: ScanList
  /** The entries this call added, in order — the batch to send. */
  added: ScanEntry[]
  /** The scans refused because the list was full — the 501st and after. */
  refused: string[]
}

/**
 * Add scans to the end of the list. A scan equal to one already in the list (or earlier in the
 * same block) is ADDED and flagged `duplicate`; once the list holds {@link GS1_LIST_CAP} scans,
 * every further one is refused, duplicates included.
 */
export function addScans(list: ScanList, scans: readonly string[]): AddResult {
  const seen = new Set(list.entries.map((e) => e.code))
  const added: ScanEntry[] = []
  const refused: string[] = []
  let nextId = list.nextId
  for (const code of scans) {
    if (list.entries.length + added.length >= GS1_LIST_CAP) {
      refused.push(code)
      continue
    }
    added.push({ id: nextId++, code, duplicate: seen.has(code) })
    seen.add(code)
  }
  return { list: { entries: [...list.entries, ...added], nextId }, added, refused }
}

/**
 * What an Enter in the scan box commits: the box's text as scans (a box can be handed several
 * lines by a paste), or nothing for an empty box.
 */
export function commitBox(list: ScanList, boxText: string): AddResult {
  return addScans(list, splitScans(boxText))
}

/**
 * The batches a set of scans is sent in: up to {@link GS1_LIST_CAP} codes per
 * `POST MaterialWeb/Gs1/Check`, in order. The list never holds more, so in practice this is one.
 */
export function scanBatches(entries: readonly ScanEntry[], size: number = GS1_LIST_CAP): ScanEntry[][] {
  const batches: ScanEntry[][] = []
  for (let i = 0; i < entries.length; i += size) batches.push(entries.slice(i, i + size))
  return batches
}

/**
 * A scan as a person reads it: the invisible GS shown as `<GS>`, the GS1 General Specifications'
 * own notation. 🚩 For DISPLAY and the EXPORT cell only — never the stored scan or the request.
 * The xlsx writer silently DROPS a control character (it is illegal in xlsx XML), which would glue
 * two element strings together in the file and make the scan read as another code.
 */
export function visibleScan(code: string): string {
  return code.split(GS).join('<GS>')
}
