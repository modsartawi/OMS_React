import type { TFunction } from 'i18next'
import { apiErrorCode, apiErrorData } from '@/core/api'
import {
  HUNGERSTATION_PROMOTION_CHECK_FIELDS,
  HUNGERSTATION_PROMOTION_ERRORS,
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  type HungerStationPromotionCheckResult,
  type HungerStationDiscountSubtype,
  type HungerStationPromotionFieldProblem,
  type HungerStationPromotionPartPreview,
  type HungerStationPromotionProblem,
} from '@/core/models/hungerstation'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'

/**
 * The Check panel's reading of a Check answer (ticket 667, BackOffice 3212) — pure. One shape for
 * both the `Check` door and a Send refused for its checks (DHS-00018), whose `data` is that same
 * answer (666's assumption). 🚩 Provisional until the contract's Check section lands.
 */

/** One item row, as the panel and the preview grid show it. */
export interface CheckedRow {
  refusals: HungerStationPromotionProblem[]
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
  /** Send waits while any refusal stands — or while the server says it is not sendable. */
  blocksSend: boolean
  /** Header refusals by field, in the order the server named them. */
  header: Map<string, HungerStationPromotionProblem[]>
  /** Rows with a refusal or a warning, by our material number. */
  rows: Map<string, CheckedRow>
  /** 668: the HungerStation promotion parts it will be sent as — the SERVER's split, in its order
   *  (a strikethrough is one part). The page never computes them. */
  parts: HungerStationPromotionPartPreview[]
  /** Every SKU it will send, over its parts. */
  skuCount: number
}

export function checkSummary(result: HungerStationPromotionCheckResult): CheckSummary {
  const header = new Map<string, HungerStationPromotionProblem[]>()
  for (const { field, code, message } of result.header) header.set(field, [...(header.get(field) ?? []), { code, message }])
  const rows = new Map<string, CheckedRow>()
  for (const r of result.rows) {
    const prev = rows.get(r.materialNumber) ?? { refusals: [], warningStores: [] }
    rows.set(r.materialNumber, {
      refusals: [...prev.refusals, ...r.refusals],
      warningStores: [...prev.warningStores, ...(r.priceWarning?.storeCodes ?? []).filter((c) => !prev.warningStores.includes(c))],
    })
  }
  const all = [...rows.values()]
  const refusals = result.header.length + all.reduce((n, r) => n + r.refusals.length, 0)
  return {
    refusals,
    warnings: all.filter((r) => r.warningStores.length > 0).length,
    refusedRows: all.filter((r) => r.refusals.length > 0).length,
    blocksSend: refusals > 0 || !result.sendable,
    header,
    rows,
    parts: result.parts ?? [],
    skuCount: result.skuCount,
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const problem = (p: unknown): HungerStationPromotionProblem => ({
  code: str((p as { code?: unknown })?.code),
  message: str((p as { message?: unknown })?.message),
})

const SUBTYPES: readonly HungerStationDiscountSubtype[] = ['PERCENTAGE', 'ABSOLUTE', 'FINAL_PRICE']
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** A part of the preview, read defensively: one with no name or SKU count is dropped; a
 *  combination field it cannot read is `null`. */
const partPreview = (p: unknown): HungerStationPromotionPartPreview[] => {
  const o = (typeof p === 'object' && p !== null ? p : {}) as Record<string, unknown>
  if (typeof o.name !== 'string' || typeof o.skuCount !== 'number') return []
  return [
    {
      name: o.name,
      skuCount: o.skuCount,
      buyQuantity: num(o.buyQuantity),
      getQuantity: num(o.getQuantity),
      subtype: SUBTYPES.find((s) => s === o.subtype) ?? null,
      value: num(o.value),
    },
  ]
}

/** The Check answer a Send refused for its checks (DHS-00018) carries, or `null` for any other
 *  failure or a body that is not an object. Read defensively: what it cannot read is nothing. */
export function checkOfRefusal(err: unknown): HungerStationPromotionCheckResult | null {
  if (apiErrorCode(err) !== HUNGERSTATION_PROMOTION_ERRORS.checkFailed) return null
  const d = apiErrorData(err)
  if (typeof d !== 'object' || d === null || Array.isArray(d)) return null
  const o = d as Record<string, unknown>
  return {
    // A refused Send is never sendable, whatever the body says.
    sendable: false,
    header: list(o.header)
      .filter((h) => typeof (h as { field?: unknown })?.field === 'string')
      .map((h): HungerStationPromotionFieldProblem => ({ field: (h as { field: string }).field, ...problem(h) })),
    rows: list(o.rows)
      .filter((r) => typeof (r as { materialNumber?: unknown })?.materialNumber === 'string')
      .map((r) => {
        const row = r as { materialNumber: string; refusals?: unknown; priceWarning?: { storeCodes?: unknown } | null }
        const stores = list(row.priceWarning?.storeCodes).filter((c): c is string => typeof c === 'string')
        return { materialNumber: row.materialNumber, refusals: list(row.refusals).map(problem), priceWarning: row.priceWarning ? { storeCodes: stores } : null }
      }),
    parts: list(o.parts).flatMap(partPreview),
    skuCount: typeof o.skuCount === 'number' ? o.skuCount : 0,
  }
}

/** A check problem in our words; a code we do not know in the server's. */
export function problemWords(t: TFunction<'hungerstation-promotions'>, p: HungerStationPromotionProblem): string {
  return p.code ? t(`check.codes.${p.code}`, { defaultValue: p.message, max: fsi(figure(HUNGERSTATION_PROMOTION_MAX_SKUS)) }) : p.message
}

export const knownField = (f: string): f is (typeof HUNGERSTATION_PROMOTION_CHECK_FIELDS)[number] =>
  (HUNGERSTATION_PROMOTION_CHECK_FIELDS as readonly string[]).includes(f)

/** A header field's check refusals in words, for the Field's error line; `undefined` when none. */
export function fieldWords(t: TFunction<'hungerstation-promotions'>, summary: CheckSummary | null, ...fields: string[]): string | undefined {
  const words = fields.flatMap((f) => summary?.header.get(f) ?? []).map((p) => problemWords(t, p))
  return words.length ? words.join(' ') : undefined
}
