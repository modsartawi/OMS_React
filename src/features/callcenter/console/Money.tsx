/**
 * Engine money — VAT-inclusive, tabular, currency named.
 *
 * 🚩 `SAR` is **reserved for this register** (135 amendment 1): a figure that has
 * not been near the engine — the item search's ex-VAT estimate — never carries a
 * currency word, and carries `≈` instead. Which is why this is one component
 * rather than a formatting call at each site: the register is the guarantee, and
 * a guarantee spelled per call site is one edit away from being spent on an
 * estimate.
 *
 * It draws a number it is GIVEN. Nothing here adds anything to anything (§2.1 —
 * the console never sums lines).
 */
import { useTranslation } from 'react-i18next'
import { formatMoney } from '@/core/util/number-format'

export default function Money({ value, size = 'md' }: { value: number; size?: 'md' | 'lg' }) {
  const { t } = useTranslation('callcenter')
  const scale = size === 'lg' ? 'text-xl font-semibold' : 'text-sm font-medium'
  return (
    <span data-numeric className={scale}>
      {formatMoney(value)}
      <span className="ms-1 text-[0.7em] font-normal text-ink-3">{t('money.currency')}</span>
    </span>
  )
}
