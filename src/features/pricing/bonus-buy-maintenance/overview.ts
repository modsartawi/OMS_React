/**
 * The promotion overview's pure half (ticket 416): status reading, the multi-select loop,
 * the promotion-flip reading and the delete gate. No React, no i18n — the Page resolves
 * every key through `t()`.
 */
import { apiErrorMessage } from '@/core/api'
import { bbyStatusSeverity, readBbyStatus, type BbyStatusReading } from '@/core/bonus-buy/status'
import type {
  BbyMaintainOutcome,
  BbyOverviewRow,
  BbyPromotion,
  BbyRefusal,
} from '@/core/models/bonus-buy-maintenance'

/** `BbyPromotion.Name` is `NVARCHAR(40)` (spec 2374 §Schema). */
export const PROMOTION_NAME_MAX = 40

/** The status reading lives in core now (ticket 442: the BBY Inquiry reads it too); the
 *  overview keeps its own names for it. */
export type OverviewStatus = BbyStatusReading
export const overviewStatus = readBbyStatus
export const overviewSeverity = bbyStatusSeverity

/**
 * The overview's Activate (one or many rows): not offered while the selection holds a Planned
 * bonus buy, since only a Tested one can go live (spec 2396, ADR 0063). The server refuses it
 * too; the screen just never offers the act. Any other status is the server's to judge.
 */
export function canActivateSelection(statuses: readonly OverviewStatus[]): boolean {
  return statuses.length > 0 && !statuses.includes('planned')
}

/**
 * The overview's Mark Tested (one or many rows): only the selection's Planned bonus buys are
 * sent, since only Planned → Tested exists (ADR 0063). A select-all over a big promotion then
 * marks just the Planned ones instead of drowning the report in refusals for the rest. The
 * tester vouches for every one sent; the server still re-checks each (validator, four-eyes).
 */
export function testableNumbers(
  rows: readonly { number: string; status: OverviewStatus }[],
): string[] {
  return rows.filter((r) => r.status === 'planned').map((r) => r.number)
}

/** One number's outcome in a multi-select act. */
export interface EachOutcome {
  number: string
  kind: 'done' | 'refused' | 'notFound' | 'failed'
  refusals: BbyRefusal[]
  /** Only on `failed`: the thrown error's message. */
  message?: string
}

/** Read one in-band outcome. `refused`/`notFound` are business answers; anything else done. */
export function classifyOutcome(number: string, outcome: BbyMaintainOutcome): EachOutcome {
  const refusals = outcome.refusals ?? []
  if (outcome.status === 'refused') return { number, kind: 'refused', refusals }
  if (outcome.status === 'notFound') return { number, kind: 'notFound', refusals }
  return { number, kind: 'done', refusals: [] }
}

/**
 * The multi-select loop: one call per number, in order, and **it keeps going** — a refusal,
 * a not-found or a thrown call is that number's outcome, never the end of the run. A 401 is
 * not ours (the api layer redirects); everything else becomes a `failed` row.
 */
export async function runEach(
  numbers: readonly string[],
  call: (number: string) => Promise<BbyMaintainOutcome>,
  /** The caller's translated words for a throw that carries no server message. */
  fallback: string,
  onEach?: (outcome: EachOutcome, done: number) => void,
): Promise<EachOutcome[]> {
  const out: EachOutcome[] = []
  for (const number of numbers) {
    let row: EachOutcome
    try {
      row = classifyOutcome(number, await call(number))
    } catch (err) {
      row = {
        number,
        kind: 'failed',
        refusals: [],
        message: apiErrorMessage(err, fallback),
      }
    }
    out.push(row)
    onEach?.(row, out.length)
  }
  return out
}

/** A promotion-level activate/deactivate, read for the screen. */
export interface PromotionFlipView {
  /** False when refused or not found: all-or-nothing, so not one bonus buy changed. */
  changed: boolean
  /** The promotion itself is gone (deleted elsewhere) — its own sentence, not a refusal. */
  notFound: boolean
  /** Every refused bonus buy with all of its refusals, in the server's order. */
  refused: { number: string; refusals: BbyRefusal[] }[]
}

/**
 * Promotion activation is all-or-nothing (BackOffice 2380): one refusal activates none,
 * and the answer lists every refused bonus buy. So a refused outcome is `changed: false`
 * and **every** refusal is kept, per bonus buy — none dropped, none collapsed to "the
 * first". The shipped result names them in `bonusBuys[]` (`BbyMaintainItemResult`); its flat
 * `refusals[]` names no bonus buy. A refusal outside every item (a promotion-level one) is
 * listed under the promotion, so it is never lost either.
 */
export function readPromotionFlip(promoNumber: string, outcome: BbyMaintainOutcome): PromotionFlipView {
  if (outcome.status === 'notFound') return { changed: false, notFound: true, refused: [] }
  if (outcome.status !== 'refused') return { changed: true, notFound: false, refused: [] }
  const refused = (outcome.bonusBuys ?? [])
    .filter((b) => (b.refusals ?? []).length > 0)
    .map((b) => ({ number: b.number, refusals: b.refusals }))
  const loose: BbyRefusal[] = (outcome.refusals ?? []).filter(
    (r) => !refused.some((g) => g.refusals.some((x) => sameRefusal(x, r))),
  )
  if (loose.length > 0) refused.push({ number: promoNumber, refusals: loose })
  return { changed: false, notFound: false, refused }
}

const sameRefusal = (a: BbyRefusal, b: BbyRefusal) =>
  a.code === b.code && a.english === b.english && a.arabic === b.arabic

/** Delete promotion is offered only while it holds no bonus buys (spec 2374, SAP's rule). */
export function canDeletePromotion(promo: Pick<BbyPromotion, 'bonusBuys'> | null | undefined): boolean {
  return !!promo && (promo.bonusBuys ?? []).length === 0
}

/** GET Promotion/{number} answers a gone promotion in-band (`status: 'notFound'`), not as a 404. */
export const isPromotionNotFound = (promo: Pick<BbyPromotion, 'status'> | null | undefined): boolean =>
  promo?.status === 'notFound'

/**
 * The overview's status chips: `all`, or one status. A promotion of 500+ bonus buys needs a
 * filter; the chips narrow by status, the search box by number, text, tester and note, and the
 * grid's own column filters do the rest.
 */
export type OverviewChip = 'all' | OverviewStatus

/** The chips in their order. `unknown` is offered only while a row actually reads unknown. */
export function overviewChips(counts: Readonly<Record<OverviewStatus, number>>): OverviewChip[] {
  const known: OverviewChip[] = ['all', 'planned', 'tested', 'activated', 'deactivated']
  return counts.unknown > 0 ? [...known, 'unknown'] : known
}

/** Each status's count over the WHOLE promotion, so a chip's count never moves while typing. */
export function overviewStatusCounts(
  rows: readonly Pick<BbyOverviewRow, 'bbyStatus'>[],
): Record<OverviewStatus, number> {
  const counts: Record<OverviewStatus, number> = { activated: 0, planned: 0, tested: 0, deactivated: 0, unknown: 0 }
  for (const r of rows) counts[overviewStatus(r.bbyStatus)]++
  return counts
}

/** The search box (case-insensitive "contains" on number, text, tester and note) AND the chip. */
export function matchesOverview(row: BbyOverviewRow, query: string, chip: OverviewChip): boolean {
  if (chip !== 'all' && overviewStatus(row.bbyStatus) !== chip) return false
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [row.bbyNumber, row.description, row.testedBy, row.testNote].some((v) => !!v && v.toLowerCase().includes(q))
}

/**
 * `agDateColumnFilter` comparator for the overview's day and datetime columns: the cell is
 * compared by its local calendar day. A blank or unreadable cell sorts before any filter date,
 * so it falls out of every range.
 */
export function overviewDayComparator(filterDate: Date, cellValue: unknown): number {
  if (typeof cellValue !== 'string' || cellValue === '') return -1
  const parsed = new Date(cellValue)
  if (Number.isNaN(parsed.getTime())) return -1
  const diff = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime() - filterDate.getTime()
  return diff < 0 ? -1 : diff > 0 ? 1 : 0
}

/** The editor page (ticket 417) for a mode. `new` is Create; Display rides a query flag. */
export type EditorMode = 'create' | 'change' | 'display'

export const BBY_MAINTAIN_ROOT = '/pricing/bonus-buy-maintenance'

export const promotionPath = (promoNumber: string) => `${BBY_MAINTAIN_ROOT}/${encodeURIComponent(promoNumber)}`

export function editorPath(promoNumber: string, mode: EditorMode, bbyNumber?: string): string {
  const base = `${promotionPath(promoNumber)}/bonus-buy`
  if (mode === 'create' || !bbyNumber) return `${base}/new`
  const path = `${base}/${encodeURIComponent(bbyNumber)}`
  return mode === 'display' ? `${path}?mode=display` : path
}
