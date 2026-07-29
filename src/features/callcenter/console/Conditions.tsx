/**
 * **Why a price is what it is** — the pricing conditions behind one figure, drawn
 * the one way.
 *
 * It exists because two surfaces ask the identical question about the identical
 * type: a basket line's *priced by* run (170) and the *about this item* panel's
 * quote (185). They are the same fact — the store price and VAT as **separate
 * things**, because VAT is a separate 15% condition (§2.1) and that separation is
 * exactly what explains the ~13% gap to the search row's ex-VAT estimate. Drawn
 * twice it would be one rule with two chances to drift; the third caller would
 * copy whichever it found first.
 *
 * 🚩 **The figures carry no currency word.** `SAR` is reserved for the register
 * `Money.tsx` owns (135 amendment 1) — a condition is a component of a price, not
 * the price the caller pays, and the total beside it is where the currency is
 * said, once.
 *
 * 🚩 **`isStatistical` is said in WORDS, not by tone.** An informational
 * condition did not move the money; that is a different fact, not a quieter one.
 */
import { useTranslation } from 'react-i18next'
import type { LineCondition } from '@/core/models/callcenter'
import { formatMoney } from '@/core/util/number-format'

export default function Conditions({ conditions }: { conditions: LineCondition[] }) {
  const { t } = useTranslation('callcenter')
  if (conditions.length === 0) return null
  return (
    <>
      <span className="uppercase tracking-wide opacity-70">{t('line.pricedBy')}</span>
      {conditions.map((condition, index) => (
        // Keyed on type AND position: a line can carry the same condition type
        // more than once, and the pair is stable across a re-price.
        <span key={`${condition.type}-${index}`} data-cc-condition={condition.type}>
          {/* Server text, passed through — the condition's own description. */}
          {condition.description}
          <span data-numeric className="ms-1 text-foreground/80">
            {formatMoney(condition.value)}
          </span>
          {condition.isStatistical && <span className="ms-1">{t('line.statistical')}</span>}
        </span>
      ))}
    </>
  )
}
