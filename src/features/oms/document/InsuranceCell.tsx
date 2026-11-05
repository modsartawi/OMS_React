import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import type { MoneyCell } from './insurance-section'

/**
 * One money cell of the Insurance section: a figure in an `Ltr` isolate, or the word for its
 * absence — "Unpriced" or the caller's none word — never a blank and never `0.00`. `gap` adds the ⚠
 * a gap between current and engine money wears, with its words for a screen reader.
 */
export default function InsuranceCell({
  cell,
  noneKey = 'insurance.money.none',
  gap = false,
}: {
  cell: MoneyCell
  /** The word for `none` here: "Not sent" for the channel's money, "None" elsewhere. */
  noneKey?: string
  gap?: boolean
}) {
  const { t } = useTranslation('document')
  return (
    <span className="inline-flex items-baseline gap-1" data-money-cell={cell.kind} data-money-gap={gap ? '' : undefined}>
      {cell.kind === 'amount' ? (
        <span className="tabular-nums">
          <Ltr>{cell.text}</Ltr>
        </span>
      ) : (
        <span className="text-muted-foreground italic">{t(cell.kind === 'unpriced' ? 'insurance.money.unpriced' : noneKey)}</span>
      )}
      {gap && (
        <AlertTriangle
          className="h-3.5 w-3.5 shrink-0 self-center text-attention-800"
          role="img"
          aria-label={t('insurance.money.gap')}
        />
      )}
    </span>
  )
}
