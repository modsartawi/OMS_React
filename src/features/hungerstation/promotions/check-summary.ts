import type { TFunction } from 'i18next'
import { apiErrorCode } from '@/core/api'
import {
  HUNGERSTATION_PROMOTION_CHECK_FIELDS,
  HUNGERSTATION_PROMOTION_ERRORS,
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  HUNGERSTATION_PROMOTION_PRICE_WARNING,
  type HungerStationPromotionCheck,
  type HungerStationPromotionCheckIssue,
  type HungerStationPromotionPartPreview,
} from '@/core/models/hungerstation'
import { fsi, stripIsolates } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'

/**
 * The Check panel's reading of a Check answer (ticket 667; BackOffice 3212, reconciled to the door
 * contract 2026-10-29) — pure. The answer of the `Check` door, and the `check` key of a Save's
 * answer, are the same shape. A refused Send (DHS-00018 / 00019) carries only its message: the
 * page re-runs Check for the per-row detail.
 */

/** One item row, as the panel and the preview grid show it. */
export interface CheckedRow {
  refusals: HungerStationPromotionCheckIssue[]
  /** The stores where HungerStation will refuse this material (a warning: never blocks Send). */
  warningStores: string[]
}

export interface CheckSummary {
  /** Every refusal, header and rows. */
  refusals: number
  /** Rows with a price warning. */
  warnings: number
  /** Rows with at least one refusal. */
  refusedRows: number
  /** Send waits while any refusal stands — or while the server says it cannot send. */
  blocksSend: boolean
  /** Header refusals (`rowNo` null) by field, in the order the server named them. */
  header: Map<string, HungerStationPromotionCheckIssue[]>
  /** Rows with a refusal or a warning, by our material number. */
  rows: Map<string, CheckedRow>
  /** 668: the HungerStation promotion parts it will be sent as — the SERVER's plan, in send order
   *  (a strikethrough is one part). The page never computes them. */
  parts: HungerStationPromotionPartPreview[]
  /** The active item rows checked. */
  itemCount: number
}

const isRow = (i: HungerStationPromotionCheckIssue): i is HungerStationPromotionCheckIssue & { materialNumber: string } => i.materialNumber !== null

export function checkSummary(c: HungerStationPromotionCheck): CheckSummary {
  const header = new Map<string, HungerStationPromotionCheckIssue[]>()
  const rows = new Map<string, CheckedRow>()
  const rowOf = (m: string) => {
    let r = rows.get(m)
    if (!r) rows.set(m, (r = { refusals: [], warningStores: [] }))
    return r
  }
  for (const i of c.refusals) {
    if (isRow(i)) rowOf(i.materialNumber).refusals.push(i)
    else header.set(i.field, [...(header.get(i.field) ?? []), i])
  }
  for (const w of c.warnings) {
    if (w.code !== HUNGERSTATION_PROMOTION_PRICE_WARNING || !isRow(w)) continue
    const r = rowOf(w.materialNumber)
    for (const s of w.storeCodes) if (!r.warningStores.includes(s)) r.warningStores.push(s)
  }
  const all = [...rows.values()]
  return {
    refusals: c.refusals.length,
    warnings: all.filter((r) => r.warningStores.length > 0).length,
    refusedRows: all.filter((r) => r.refusals.length > 0).length,
    blocksSend: c.refusals.length > 0 || !c.canSend,
    header,
    rows,
    parts: c.parts ?? [],
    itemCount: c.itemCount,
  }
}

/** A Send, or an in-place edit, refused for its checks (DHS-00018, or DHS-00019 for the name). */
export const checkRefused = (err: unknown): boolean => {
  const code = apiErrorCode(err)
  return code === HUNGERSTATION_PROMOTION_ERRORS.checkFailed || code === HUNGERSTATION_PROMOTION_ERRORS.nameInUse
}

/** A check issue in our words; a code we do not know in the server's. Its machine values are
 *  isolated with `fsi`: a sentence sink — a grid cell takes `checkCellText`. */
export function problemWords(t: TFunction<'hungerstation-promotions'>, p: Pick<HungerStationPromotionCheckIssue, 'code' | 'message' | 'storeCodes'>): string {
  if (!p.code) return p.message
  return t(`check.codes.${p.code}`, {
    defaultValue: p.message,
    max: fsi(figure(HUNGERSTATION_PROMOTION_MAX_SKUS)),
    stores: fsi((p.storeCodes ?? []).join(', ')),
  })
}

/** The preview grid's Check cell: the row's refusals in words, else its price warning counted.
 *  NO isolate characters — they would reach Ctrl+C; the grid base isolates the cell. */
export function checkCellText(t: TFunction<'hungerstation-promotions'>, r: CheckedRow | null): string {
  if (!r) return ''
  if (r.refusals.length) return stripIsolates(r.refusals.map((p) => problemWords(t, p)).join(' '))
  return r.warningStores.length ? t('check.warningCell', { count: r.warningStores.length, n: figure(r.warningStores.length) }) : ''
}

export const knownField = (f: string): f is (typeof HUNGERSTATION_PROMOTION_CHECK_FIELDS)[number] =>
  (HUNGERSTATION_PROMOTION_CHECK_FIELDS as readonly string[]).includes(f)

/** A header field's check refusals in words, for the Field's error line; `undefined` when none. */
export function fieldWords(t: TFunction<'hungerstation-promotions'>, summary: CheckSummary | null, ...fields: string[]): string | undefined {
  const words = fields.flatMap((f) => summary?.header.get(f) ?? []).map((p) => problemWords(t, p))
  return words.length ? words.join(' ') : undefined
}
