/**
 * How a smart-box search was resolved, as a chip (ticket 451, spec 2544 § Search). Pure.
 *
 * The server says how it read `q` in `resolvedAs`. Only three answers need explaining — a scanned
 * GS1 string, a barcode, an SFDA/Wasfaty code — because only then does the material shown differ
 * from what was typed. `text` and `material` were matched as typed, and `null` means no text was
 * sent: no chip.
 *
 * The chip is a SENTENCE in the locale with each value in its own `<Trans>` slot ("Barcode 628…
 * resolves to material 101234") — never an arrow glued between two values, which would reverse
 * under RTL.
 */
import type { MaterialSearchResult } from '@/core/models/materials'

export type ResolvedChipKind = 'gs1' | 'barcode' | 'code'

export interface ResolvedChip {
  kind: ResolvedChipKind
  /** The `materials-search` key: `resolved.<kind>` for one material, `resolved.<kind>Many` otherwise. */
  labelKey: string
  /** What was resolved: the GTIN of a GS1 scan, the barcode, or the code as typed. */
  from: string
  /** The one material it resolved to, or `null` when the answer holds none or several. */
  material: string | null
  /** How many materials the answer holds (a code can match several; filters can leave none). */
  count: number
}

const CHIP_KINDS: ReadonlySet<string> = new Set<ResolvedChipKind>(['gs1', 'barcode', 'code'])

export function resolvedChip(
  result: Pick<MaterialSearchResult, 'resolvedAs' | 'resolvedFrom' | 'rows'> | null | undefined,
  q: string,
): ResolvedChip | null {
  const kind = result?.resolvedAs
  if (!result || !kind || !CHIP_KINDS.has(kind)) return null
  const typed = q.trim()
  const from =
    kind === 'gs1'
      ? (result.resolvedFrom?.gtin ?? typed)
      : kind === 'barcode'
        ? (result.resolvedFrom?.barcode ?? typed)
        : typed
  const count = result.rows.length
  const material = count === 1 ? result.rows[0].materialNumber : null
  return {
    kind: kind as ResolvedChipKind,
    labelKey: material !== null ? `resolved.${kind}` : `resolved.${kind}Many`,
    from,
    material,
    count,
  }
}
