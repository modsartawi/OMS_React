/**
 * The promotion overview's pure half (ticket 416): status reading, the multi-select loop,
 * the promotion-flip reading and the delete gate. No React, no i18n — the Page resolves
 * every key through `t()`.
 */
import { apiErrorMessage } from '@/core/api'
import type { Severity } from '@/core/ui/severity'
import type {
  BbyMaintainOutcome,
  BbyPromotion,
  BbyRefusal,
  BbyStatusCode,
} from '@/core/models/bonus-buy-maintenance'

/** `BbyPromotion.Name` is `NVARCHAR(40)` (spec 2374 §Schema). */
export const PROMOTION_NAME_MAX = 40

export type OverviewStatus = 'activated' | 'planned' | 'deactivated' | 'unknown'

/**
 * SAP's status column: **blank** = Activated, `1` = Planned, `2` = Deactivated. Blank means a
 * PRESENT empty (or space-padded, as SAP pads) string. A missing field is `unknown`, never
 * Activated: while the wire shape is unconfirmed, a renamed field must not paint every bonus
 * buy as live at the tills. Any other code is `unknown` too, never guessed into one of three.
 */
export function overviewStatus(code: BbyStatusCode | null | undefined): OverviewStatus {
  if (code == null) return 'unknown'
  const c = code.trim()
  if (c === '') return 'activated'
  if (c === '1') return 'planned'
  if (c === '2') return 'deactivated'
  return 'unknown'
}

/** Activated prices at the tills (`ok`); Planned waits for a human (`warn`); paused and
 *  unknown are neutral. The label always renders beside the colour. */
export function overviewSeverity(status: OverviewStatus): Severity {
  if (status === 'activated') return 'ok'
  if (status === 'planned') return 'warn'
  return 'mute'
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
