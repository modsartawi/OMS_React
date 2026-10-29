import type { TFunction } from 'i18next'
import type { HungerStationPromotionCombination } from '@/core/models/hungerstation'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { discountText } from './promotion-display'

/**
 * A **HungerStation promotion part**'s combination in words (ticket 668): "Buy 2 get 1 at 50% off",
 * "Buy 1 get 1 free", "Buy 2 get 1 for 9.950 SAR". A strikethrough's single part (no buy / get) is
 * "All items". Each machine value is a `t()` interpolation, so each is isolated whole with `fsi`
 * (.claude/rules/bidi.md); the words carry the order. Pure apart from the `t` a caller passes.
 */
export function partLabel(t: TFunction<'hungerstation-promotions'>, c: HungerStationPromotionCombination): string {
  if (c.buyQuantity === null || c.getQuantity === null) return t('detail.allItems')
  const buy = fsi(figure(c.buyQuantity))
  const get = fsi(figure(c.getQuantity))
  if (c.subtype === null || c.value === null) return t('parts.label.none', { buy, get })
  // 100% off the get items: they are free (buy-one-get-one-free is 1, 1, PERCENTAGE, 100).
  if (c.subtype === 'PERCENTAGE' && c.value === 100) return t('parts.label.free', { buy, get })
  return t(`parts.label.${c.subtype}`, { buy, get, value: fsi(discountText(c.subtype, c.value)) })
}
