import type { TFunction } from 'i18next'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure, formatMoney3 } from '@/core/util/number-format'

// A HungerStation promotion's machine values, each formatted to ONE string so it is isolated once
// (.claude/rules/bidi.md): a discount with its unit, a part's buy/get, the window (ticket 665).
// Pure apart from the `t` a caller passes. The unit is a locale template (`units.*`), never glued
// on here; the figure goes in unisolated, so the result is safe in a grid cell too.

/** A discount's value with its unit: `50%`, `12.5%`, `5.000 SAR`. Blank when there is no value. */
export function discountText(t: TFunction, subtype: string | null, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  if (subtype === 'PERCENTAGE') return t('units.PERCENTAGE', { value: formatFigure(value) })
  if (subtype === 'ABSOLUTE' || subtype === 'FINAL_PRICE') return t('units.SAR', { value: formatMoney3(value) })
  return String(value)
}

/** A bundle part's buy and get as HungerStation's shorthand (`B2G1`); `null` for a strikethrough. */
export function buyGetText(c: { buyQuantity: number | null; getQuantity: number | null }): string | null {
  return c.buyQuantity === null || c.getQuantity === null ? null : `B${c.buyQuantity}G${c.getQuantity}`
}

/** The local start and end as one range; blank when neither is set yet (a draft), a dash for one. */
export function windowText(startAt: string | null, endAt: string | null): string {
  if (!startAt && !endAt) return ''
  return formatRange(startAt ? formatDateTime(startAt) : '—', endAt ? formatDateTime(endAt) : '—')
}
