import { isHeader } from '@/core/import/material-list'
import { HUNGERSTATION_IMPORT_MAX_ROWS, type HungerStationMaterialImportRow } from '@/core/models/hungerstation'

/**
 * The HungerStation material import's rows (ticket 555; contract § Materials
 * `POST HungerStationWeb/Materials/Import`) — pure.
 *
 * The WPF import read a tab-separated sheet, one row per material: its number, then `X` in the
 * disabled column, then `X` in the deleted column (a blank is false). This parser decides what the
 * request carries, and shows it before anything is sent:
 *
 * - **Marks:** `X` / `x` and `true` / `false` (any case) become booleans; a blank or missing cell is
 *   `false`. Any other mark is flagged with its line, never guessed.
 * - **Material numbers:** 1–18 digits, kept as typed (leading zeros and all). A row that is not one
 *   is flagged and left out — the door would refuse the whole import for it (DHS-00010).
 * - **Repeats:** one row per number, the LAST row winning (the server's own rule), kept in its first
 *   place.
 * - **Header:** a first line / row with no digit is skipped and said on screen (the core rule
 *   Deliverect's whitelist import reads too).
 * - **Cap:** more than 5000 rows is reported, never truncated, and refused HERE.
 */

/** The contract's ceiling on one import (DHS-00010 refuses more). */
export const MATERIAL_IMPORT_MAX = HUNGERSTATION_IMPORT_MAX_ROWS

/** A row the import will not send, and why. `line` is the 1-based line or sheet row. */
export interface ImportProblem {
  line: number
  value: string
  kind: 'material' | 'mark'
}

export interface MaterialImport {
  /** The body's rows: distinct numbers, first place kept, last row's marks. NEVER truncated. */
  rows: HungerStationMaterialImportRow[]
  /** Every sendable row read, repeats included — the sheet's row count. */
  entries: number
  /** How many repeats were collapsed into an earlier row. */
  repeats: number
  /** The first line or row, skipped as a header because it holds no digit — else `null`. */
  header: string | null
  /** The rows that will not be sent, in line order. */
  problems: ImportProblem[]
  /** How many rows over the cap the body is; 0 when it can be sent. */
  overBy: number
}

const MATERIAL = /^\d{1,18}$/

/** A mark as a boolean, or `null` when it is not one the sheet uses. */
function mark(cell: string | undefined): boolean | null {
  const value = (cell ?? '').trim().toLowerCase()
  if (value === '' || value === 'false') return false
  if (value === 'x' || value === 'true') return true
  return null
}

/**
 * Pasted text (one row per line; columns broken by tabs — what a copy from Excel gives — or by
 * commas or semicolons), or a sheet's rows (its first three cells). Columns past the third are
 * ignored, as the WPF import ignored them.
 */
export function parseMaterialImport(
  source: string | readonly (readonly string[])[],
  cap: number = MATERIAL_IMPORT_MAX,
): MaterialImport {
  const lines: { line: number; cells: string[] }[] =
    typeof source === 'string'
      ? source.split(/\r?\n|\r/).map((text, i) => ({ line: i + 1, cells: text.split(/[\t,;]/).map((c) => c.trim()) }))
      : source.map((row, i) => ({ line: i + 1, cells: row.map((c) => (c ?? '').trim()) }))
  const filled = lines.filter((l) => l.cells.some((c) => c !== ''))

  let header: string | null = null
  if (filled.length > 0 && isHeader(filled[0].cells.join(''))) {
    const first = filled.shift()!
    header = typeof source === 'string' ? source.split(/\r?\n|\r/)[first.line - 1].trim() : first.cells[0]
  }

  const byNumber = new Map<string, HungerStationMaterialImportRow>()
  const problems: ImportProblem[] = []
  let entries = 0
  for (const { line, cells } of filled) {
    const [materialNumber, disabledCell, deletedCell] = cells
    if (!MATERIAL.test(materialNumber)) {
      problems.push({ line, value: materialNumber || cells.join(' ').trim(), kind: 'material' })
      continue
    }
    const disabled = mark(disabledCell)
    const deleted = mark(deletedCell)
    if (disabled === null || deleted === null) {
      problems.push({ line, value: disabled === null ? disabledCell : deletedCell, kind: 'mark' })
      continue
    }
    entries++
    // `set` on an existing key keeps its place and takes the new value: the last row wins.
    byNumber.set(materialNumber, { materialNumber, disabled, deleted })
  }
  const rows = [...byNumber.values()]
  return { rows, entries, repeats: entries - rows.length, header, problems, overBy: Math.max(0, rows.length - cap) }
}
