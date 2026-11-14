/**
 * The Bupa line outcomes drill-down and labels (oms 899). Pure, pinned by `outcomes.test.ts`.
 *
 * - **Drill-down:** a detail line belongs to the summary row with the same `kind`, the same **sent** item and the same
 *   `dispensed.materialNumber` (the brief). "The same sent item" is the door's grouping (3888 D5): our material, else
 *   the SFDA code, else the free text trimmed and case-folded — the summary row carries the first line's text, so the
 *   text is compared folded, never as typed.
 * - **Acts:** the stored codes are shown by their own key. `PICK` is the pharmacist's **Resolve** (BackOffice glossary: *Pick*
 *   is the physical scan), so its key reads "Resolve" / "حلّ", never "Pick".
 */
import { BUPA_OUTCOME_ACTS, BUPA_OUTCOME_KINDS, type BupaOutcomeDetail, type BupaOutcomeSummaryRow } from '@/core/models/bupa-line-outcome'

type SentItem = { materialNumber?: string | null; sfdaCode?: string | null; text?: string | null }

/** What was sent, as the door groups it: material, else SFDA code, else the text trimmed and case-folded. */
export function sentKey(sent: SentItem | null | undefined): string {
  const material = sent?.materialNumber?.trim()
  if (material) return `m:${material}`
  const sfda = sent?.sfdaCode?.trim()
  if (sfda) return `s:${sfda}`
  return `t:${(sent?.text ?? '').trim().toLocaleLowerCase()}`
}

/** One summary row's identity: kind, what was sent, and the material dispensed (blank when nothing was). */
export function summaryKey(row: { kind: string; sent: SentItem; dispensed: { materialNumber?: string | null } | null }): string {
  return `${row.kind}|${sentKey(row.sent)}|${row.dispensed?.materialNumber?.trim() ?? ''}`
}

/** The detail lines behind a summary row, in the door's order. */
export function linesOf(row: BupaOutcomeSummaryRow, details: readonly BupaOutcomeDetail[]): BupaOutcomeDetail[] {
  const key = summaryKey(row)
  return details.filter((d) => summaryKey(d) === key)
}

/** The locale key a kind reads by; a kind the screen does not know yet reads `kind.unknown`, never a raw key. */
const KNOWN_KINDS: ReadonlySet<string> = new Set(BUPA_OUTCOME_KINDS)
export const kindKey = (kind: string): string => (KNOWN_KINDS.has(kind) ? `kind.${kind}` : 'kind.unknown')

/** The locale key an act code reads by: `act.PICK` is "Resolve", an unknown code its own `act.unknown`. */
const KNOWN_ACTS: ReadonlySet<string> = new Set(BUPA_OUTCOME_ACTS)
export const actKey = (act: string): string => (KNOWN_ACTS.has(act) ? `act.${act}` : 'act.unknown')
