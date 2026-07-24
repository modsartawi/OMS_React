import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { formatMoney } from '@/core/util/number-format'
import type { SimulationResultItem } from '@/core/models/simulation'
import { aggregateConditions, countStatistical } from './aggregate'
import ConditionCard from './ConditionCard'

// Per-line pricing detail (ticket 014): a title + four summary tiles (base price,
// total discounts = salesDiscount + promotionDiscount, tax, net total), the applied
// pricing rules as aggregated condition cards, a statistical-conditions toggle
// reporting the hidden count, and any per-line pricing messages. Mount with a
// `key={item.itemNumber}` so the toggle resets when the selected line changes.
interface Props {
  item: SimulationResultItem
  currency: string
}

export default function SimItemDetail({ item, currency }: Props) {
  const { t } = useTranslation('simulation')
  const [showStatistical, setShowStatistical] = useState(false)

  const groups = useMemo(() => aggregateConditions(item.conditions), [item.conditions])
  const hiddenCount = countStatistical(groups)
  const visible = showStatistical ? groups : groups.filter((g) => !g.isStatistics)

  const totalDiscounts = item.salesDiscount + item.promotionDiscount

  const tiles: { label: string; value: number; tone?: string }[] = [
    { label: t('detail.tiles.base'), value: item.netPrice },
    { label: t('detail.tiles.discounts'), value: totalDiscounts, tone: 'text-destructive' },
    { label: t('detail.tiles.tax'), value: item.taxValue },
    { label: t('detail.tiles.net'), value: item.netTotal, tone: 'text-success-800' },
  ]

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <h2 className="text-sm font-semibold tracking-tight">
        {t('detail.title', { item: item.itemNumber, material: item.materialNumber })}
      </h2>

      {/* Four summary tiles. */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-md border border-border/60 bg-muted/40 px-3 py-2">
            <div className="text-[11px] text-muted-foreground">{tile.label}</div>
            <div className={`mt-1 text-sm font-semibold tabular-nums ${tile.tone ?? ''}`}>
              {formatMoney(tile.value)} <span className="text-[10px] text-muted-foreground">{currency}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Applied pricing rules — the aggregated condition cards. */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground">{t('detail.rulesTitle')}</h3>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowStatistical((s) => !s)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {showStatistical
                ? t('detail.hideStatistical', { count: hiddenCount })
                : t('detail.showStatistical', { count: hiddenCount })}
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
            {t('detail.noRules')}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {visible.map((card) => (
              <ConditionCard key={`${card.conditionType}-${card.conditionRate}-${card.conditionRateUnit}-${card.conditionOrigin}`} card={card} />
            ))}
          </div>
        )}
      </div>

      {/* Per-line pricing messages. */}
      {item.pricingStatusMessages.length > 0 ? (
        <div className="mt-4 rounded-md border border-attention-border bg-attention-050 p-3 text-xs text-attention-800">
          <div className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('detail.messagesTitle')}
          </div>
          <ul className="ms-5 list-disc space-y-0.5">
            {item.pricingStatusMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
