import { STOCK_MATERIAL_CAP } from '@/core/materials/stock-cap'

// The stock check's materials box (ticket 453): what a supply user pastes or types — one per line,
// comma- or space-separated, a column copied out of Excel — read as the list the door is asked
// about. Pure: no React, no `t`.

/** Newline, comma, space and tab (a pasted Excel row), plus a semicolon (a pasted mail list). */
const SEPARATORS = /[\s,;]+/

export interface MaterialList {
  /** The materials asked about: trimmed, each once, in the order first typed, at most 50. */
  materials: string[]
  /**
   * The distinct materials past the cap, in order — refused on the client BEFORE any call (the
   * door would answer `MAT-00002`). Non-empty means the check may not run.
   */
  refused: string[]
  /** How many pieces were typed more than once and folded away. */
  duplicates: number
}

/**
 * Read the box. Material numbers stay the strings they are typed as — `0100777` keeps its zero,
 * nothing is `Number()`-ed — and are matched for de-duplication as typed, after trimming.
 */
export function parseMaterialList(text: string | null | undefined): MaterialList {
  const pieces = (text ?? '').split(SEPARATORS).filter((p) => p !== '')
  const unique = [...new Set(pieces)]
  return {
    materials: unique.slice(0, STOCK_MATERIAL_CAP),
    refused: unique.slice(STOCK_MATERIAL_CAP),
    duplicates: pieces.length - unique.length,
  }
}

/** The box's text for a `?material=` prefill: one material per line, read back through the same
 *  `parseMaterialList` as anything typed. */
export const materialListText = (materials: readonly string[]): string => materials.join('\n')
