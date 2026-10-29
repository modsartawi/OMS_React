import { isHeader } from '@/core/import/material-list'
import type { ImportLine } from '@/core/import/parse-import'
import {
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  type HungerStationDiscountSubtype,
  type HungerStationPromotionItemInput,
} from '@/core/models/hungerstation'

/**
 * A strikethrough's items as the user pastes them from Excel or picks them as a `.tsv` / `.txt`
 * (ticket 666, spec 3201 § oms-react: "Strikethrough columns are `Material, Subtype, Value, MaxQty`")
 * — pure: text in, the preview's lines and the body's items out. Drawn by `core/import/ImportDialog`
 * through its `read` prop.
 *
 * - **Columns** split on a tab (what a copy from Excel gives). A line may stop early — the missing
 *   cells are blank — but never run past the four (`COLUMN_COUNT`).
 * - **Header:** a first line with no digit is skipped, and said on screen (the core rule).
 * - **Blank** subtype / value: `null`, so the row takes the promotion's default discount — the
 *   default as it reads when saved, not when pasted.
 * - **Subtype** is HungerStation's name in any case, a space for the underscore (`final price`).
 *   **Value** and **MaxQty** are numbers; MaxQty a whole one. Anything else is flagged on its line
 *   (`CELL`), never guessed. A value is sent as typed: its range and decimals are the server's
 *   checks (BackOffice 3212), not ours.
 * - **Material** is OUR material number, kept as typed — even one that is not a number: the server
 *   answers it on its row. Never the HungerStation SKU.
 * - **Repeats:** the LAST row of a material wins, in the material's first place, and is counted.
 * - **Cap:** past 20,000 materials is reported (never truncated) and refused before any send.
 */

/** The spec's columns, in file order. */
export const STRIKETHROUGH_COLUMNS = ['material', 'subtype', 'value', 'maxQuantity'] as const
export type StrikethroughColumn = (typeof STRIKETHROUGH_COLUMNS)[number]

export interface StrikethroughRead {
  /** The preview: one line per distinct material (the last row's), then every line in error.
   *  `line` is the line of the text, 1-based. */
  lines: ImportLine<StrikethroughColumn>[]
  /** The body's items, one per distinct material, first place kept. NEVER truncated. */
  items: HungerStationPromotionItemInput[]
  /** The first line, skipped as a header — else `null`. */
  header: string | null
  /** Every readable row, repeats included. */
  entries: number
  /** How many rows a later one of the same material replaced. */
  repeats: number
  /** How many materials past the cap; 0 when it may be used. */
  overBy: number
}

const SUBTYPES: readonly HungerStationDiscountSubtype[] = ['PERCENTAGE', 'ABSOLUTE', 'FINAL_PRICE']

const subtypeOf = (cell: string): HungerStationDiscountSubtype | null | undefined => {
  if (cell === '') return null
  const name = cell.toUpperCase().replace(/[\s-]+/g, '_')
  return SUBTYPES.find((s) => s === name)
}

const numberOf = (cell: string, whole = false): number | null | undefined => {
  if (cell === '') return null
  if (!/^-?\d+(\.\d+)?$/.test(cell)) return undefined
  const n = Number(cell)
  return whole && !Number.isInteger(n) ? undefined : n
}

/** A line's cells (as the reader passed them) as the body's item. */
export function itemOf(fields: Record<StrikethroughColumn, string>): HungerStationPromotionItemInput {
  return {
    materialNumber: fields.material,
    subtype: subtypeOf(fields.subtype) ?? null,
    value: numberOf(fields.value) ?? null,
    maxQuantity: numberOf(fields.maxQuantity, true) ?? null,
    buyQuantity: null,
    getQuantity: null,
  }
}

export function readStrikethrough(text: string, cap: number = HUNGERSTATION_PROMOTION_MAX_SKUS): StrikethroughRead {
  const rows = text
    .split(/\r?\n|\r/)
    .map((raw, i) => ({ line: i + 1, raw, cells: raw.split('\t').map((c) => c.trim()) }))
    .filter((r) => r.cells.some((c) => c !== ''))

  let header: string | null = null
  if (rows.length > 0 && isHeader(rows[0].cells[0])) header = rows.shift()!.raw.trim()

  const kept = new Map<string, { line: ImportLine<StrikethroughColumn>; item: HungerStationPromotionItemInput }>()
  const errors: ImportLine<StrikethroughColumn>[] = []
  let entries = 0
  for (const { line, cells } of rows) {
    if (cells.length > STRIKETHROUGH_COLUMNS.length) {
      errors.push({ line, cells, error: { code: 'COLUMN_COUNT', found: cells.length, expected: STRIKETHROUGH_COLUMNS.length } })
      continue
    }
    const [material = '', subtypeCell = '', valueCell = '', maxCell = ''] = cells
    const subtype = subtypeOf(subtypeCell)
    const value = numberOf(valueCell)
    const maxQuantity = numberOf(maxCell, true)
    const bad: StrikethroughColumn | null =
      material === '' ? 'material' : subtype === undefined ? 'subtype' : value === undefined ? 'value' : maxQuantity === undefined ? 'maxQuantity' : null
    if (bad) {
      errors.push({ line, cells, error: { code: 'CELL', column: bad } })
      continue
    }
    entries++
    const fields = { material, subtype: subtypeCell, value: valueCell, maxQuantity: maxCell }
    // `set` on a key already there keeps its place and takes the new row: the last row wins.
    kept.set(material, {
      line: { line, cells, action: 'upsert', fields },
      item: itemOf(fields),
    })
  }
  const items = [...kept.values()].map((k) => k.item)
  return {
    lines: [...[...kept.values()].map((k) => k.line), ...errors],
    items,
    header,
    entries,
    repeats: entries - items.length,
    overBy: Math.max(0, items.length - cap),
  }
}
