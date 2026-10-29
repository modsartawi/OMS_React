import type { TFunction } from 'i18next'
import type { HungerStationDiscountSubtype } from '@/core/models/hungerstation'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { discountText } from './promotion-display'
import { isSubtype } from './promotion-words'

/** The combination a part stands for. A strikethrough's single part is "all": every field `null`.
 *  The Check preview carries these fields; the detail's part carries them as one string. */
export interface PartCombination {
  buyQuantity: number | null
  getQuantity: number | null
  subtype: HungerStationDiscountSubtype | null
  value: number | null
}

const NONE: PartCombination = { buyQuantity: null, getQuantity: null, subtype: null, value: null }

/** A detail part's `combination` (contract 3213): `"ALL"`, or `"B<buy>G<get>|<subtype>|<value>"`.
 *  What it cannot read is `null` (the part's name still says it). */
export function parseCombination(combination: string): PartCombination {
  const m = /^B(\d+)G(\d+)\|([^|]*)\|(.*)$/.exec(combination)
  if (!m) return NONE
  const value = m[4] !== '' && Number.isFinite(Number(m[4])) ? Number(m[4]) : null
  return { buyQuantity: Number(m[1]), getQuantity: Number(m[2]), subtype: isSubtype(m[3]) ? m[3] : null, value }
}

/**
 * A **HungerStation promotion part**'s combination in words (ticket 668): "Buy 2 get 1 at 50% off",
 * "Buy 1 get 1 free", "Buy 2 get 1 for 9.950 SAR". A strikethrough's single part (no buy / get) is
 * "All items". Each machine value is a `t()` interpolation, so each is isolated whole with `fsi`
 * (.claude/rules/bidi.md); the words carry the order. Pure apart from the `t` a caller passes.
 */
export function partLabel(t: TFunction<'hungerstation-promotions'>, c: PartCombination): string {
  if (c.buyQuantity === null || c.getQuantity === null) return t('detail.allItems')
  const buy = fsi(figure(c.buyQuantity))
  const get = fsi(figure(c.getQuantity))
  if (c.subtype === null || c.value === null) return t('parts.label.none', { buy, get })
  // 100% off the get items: they are free (buy-one-get-one-free is 1, 1, PERCENTAGE, 100).
  if (c.subtype === 'PERCENTAGE' && c.value === 100) return t('parts.label.free', { buy, get })
  return t(`parts.label.${c.subtype}`, { buy, get, value: fsi(discountText(t as unknown as TFunction, c.subtype, c.value)) })
}
