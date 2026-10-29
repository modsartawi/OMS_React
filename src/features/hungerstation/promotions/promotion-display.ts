import type { HungerStationPromotionCombination } from '@/core/models/hungerstation'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'

// A HungerStation promotion's machine values, each formatted to ONE string so it is isolated once
// (.claude/rules/bidi.md): a discount with its unit, a part's buy/get, the window (ticket 665).
// Pure: no React, no `t`. The unit (`%`, `SAR`) is a machine value beside the number, not copy.

/** A discount's value with its unit: `50%`, `5.000 SAR`. Blank when there is no value. */
export function discountText(subtype: string | null, value: number | null): string {
  if (value === null || !Number.isFinite(value)) return ''
  if (subtype === 'PERCENTAGE') return `${value}%`
  if (subtype === 'ABSOLUTE' || subtype === 'FINAL_PRICE') return `${formatMoney3(value)} SAR`
  return String(value)
}

/** A bundle part's buy and get as HungerStation's shorthand (`B2G1`); `null` for a strikethrough. */
export function buyGetText(c: Pick<HungerStationPromotionCombination, 'buyQuantity' | 'getQuantity'>): string | null {
  return c.buyQuantity === null || c.getQuantity === null ? null : `B${c.buyQuantity}G${c.getQuantity}`
}

/** The local start and end as one range. */
export function windowText(startAt: string, endAt: string): string {
  return formatRange(formatDateTime(startAt), formatDateTime(endAt))
}
