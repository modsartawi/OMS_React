import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { formatMoney } from '@/core/util/number-format'
import type { AggregatedCondition } from './aggregate'

// One aggregated pricing rule (ticket 014) — a faithful port of the WPF card:
// index + category + type + description, a record-count pill + origin badge + the
// aggregate value in the header; a multi-record group (`count > 1`) expands to its
// rate/base line and the individual sub-records. Single-record groups don't expand.

/** Rate is shown to 3 decimals (the WPF `N3`); base/value use the shared 2-dp money. */
function formatRate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : ''
}

interface Props {
  card: AggregatedCondition
}

export default function ConditionCard({ card }: Props) {
  const { t } = useTranslation('simulation')
  const [open, setOpen] = useState(false)
  const expandable = card.count > 1
  const badgeLabel = card.badge ? t(`detail.badge.${card.badge}`) : null

  const header = (
    <div className="flex items-center gap-2">
      {expandable ? (
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
          aria-hidden
        />
      ) : (
        <span className="w-4 shrink-0" aria-hidden />
      )}

      <span className="min-w-0 flex-1 text-start text-sm">
        <span className="font-bold text-muted-foreground">{card.index}. </span>
        <span className="font-semibold">{t(`detail.category.${card.category}`)}: </span>
        <span className="font-bold">{card.conditionType}</span>
        {card.description ? <span className="text-muted-foreground"> — {card.description}</span> : null}
      </span>

      {card.count > 1 ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">
          {t('detail.countPill', { count: card.count })}
        </span>
      ) : null}

      {badgeLabel ? (
        <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {badgeLabel}
        </span>
      ) : null}

      <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(card.conditionValue)}</span>
    </div>
  )

  return (
    <div className="rounded-md border border-border/60 bg-background">
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="w-full rounded-md px-3 py-2 hover:bg-accent"
        >
          {header}
        </button>
      ) : (
        <div className="px-3 py-2">{header}</div>
      )}

      {expandable && open ? (
        <div className="border-t border-border/60 px-3 py-2">
          {/* Rate / base summary line. */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {t('detail.rateBase', {
                rate: formatRate(card.conditionRate),
                unit: card.conditionRateUnit,
                base: formatMoney(card.conditionBaseValue),
              })}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary tabular-nums">
              {t('detail.records', { count: card.count })}
            </span>
          </div>

          {/* Individual sub-records. */}
          <ul className="mt-2 flex flex-col gap-1">
            {card.subs.map((sub, i) => (
              <li
                key={`${sub.stepNumber}-${sub.conditionCounter}-${i}`}
                className="flex items-center justify-between gap-3 rounded bg-muted/50 px-2 py-1 text-xs"
              >
                <span className="min-w-0 text-muted-foreground">
                  {sub.description}
                  <span className="text-muted-foreground/70">
                    {' '}
                    — {t('detail.subRate', { rate: formatRate(sub.conditionRate), unit: sub.conditionRateUnit })}
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatMoney(sub.conditionValue)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
