/**
 * The whitelist import's list of material numbers (ticket 479, contract § Catalog
 * `POST Whitelist/Import`) — pure. Graduated from `features/deliverect/catalog/` to core by ticket
 * 555, unchanged but for `isHeader`'s export, when the HungerStation material import became the
 * second reader of its header rule (a feature may never import another).
 *
 * The category manager pastes material numbers or picks a one-column `.xlsx`, and this one parser
 * decides what the request carries. It does not judge a value: a row that is not a material number is
 * kept and sent, and the server answers it (DLV-00012). The ONE exception is a first line / cell with
 * no digit at all, which is a header ("Material", "رقم المادة") — skipped, and said on screen, so a
 * sheet's header does not have the whole import refused. What it owns is the shape — split, trim,
 * drop blanks, collapse duplicates, skip a header, and count against the 5000 cap, which is refused
 * HERE, before anything is sent.
 */

/** The contract's ceiling on one import (DLV-00012 refuses more). */
export const WHITELIST_IMPORT_MAX = 5000

/** What an import will send. */
export interface MaterialList {
  /** Distinct material numbers, first occurrence first, as typed. NEVER truncated to the cap. */
  materials: string[]
  /** How many repeats were collapsed. */
  duplicates: number
  /** Every non-blank entry read, repeats included (the header not) — a sheet's row count. */
  entries: number
  /** The first line or cell, skipped as a header because it holds no digit — else `null`. */
  header: string | null
  /** How many distinct materials over the cap the list is; 0 when it can be sent. */
  overBy: number
  /** A sheet with a non-blank cell beyond its first column: which column to read is not guessed. */
  otherColumns: boolean
}

/** A header holds no digit at all: "Material", "Material number", "رقم المادة". */
export const isHeader = (value: string) => !/\d/.test(value)

/**
 * Pasted text (split on line breaks, commas, semicolons, tabs and spaces), or a sheet's rows (the
 * first column, one material per cell). Either way: trimmed, blanks dropped, duplicates collapsed
 * ordinally, a first line / cell with no digit in it skipped as a header.
 *
 * The cap is reported, not applied: a list of 5001 keeps all 5001 so the user can split it, rather
 * than having one silently dropped.
 */
export function parseMaterialList(
  source: string | readonly (readonly string[])[],
  cap: number = WHITELIST_IMPORT_MAX,
): MaterialList {
  let values: string[]
  let header: string | null = null
  let otherColumns = false

  if (typeof source === 'string') {
    const lines = source.split(/\r?\n|\r/).map((l) => l.trim())
    const first = lines.findIndex((l) => l !== '')
    if (first >= 0 && isHeader(lines[first])) {
      header = lines[first]
      lines.splice(first, 1)
    }
    values = lines.flatMap((l) => l.split(/[\s,;]+/))
  } else {
    otherColumns = source.some((row) => row.slice(1).some((cell) => cell.trim() !== ''))
    values = source.map((row) => (row[0] ?? '').trim())
    const first = values.findIndex((v) => v !== '')
    if (first >= 0 && isHeader(values[first])) {
      header = values[first]
      values.splice(first, 1)
    }
  }

  const seen = new Set<string>()
  const materials: string[] = []
  let duplicates = 0
  for (const raw of values) {
    const value = raw.trim()
    if (!value) continue
    if (seen.has(value)) {
      duplicates++
      continue
    }
    seen.add(value)
    materials.push(value)
  }
  return { materials, duplicates, entries: materials.length + duplicates, header, overBy: Math.max(0, materials.length - cap), otherColumns }
}
