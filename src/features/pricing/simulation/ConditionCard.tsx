import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { formatMoney } from '@/core/util/number-format'
import type { AggregatedCondition } from './aggregate'

/**
 * One aggregated pricing rule — a **flat** card (ticket 116, spec 110 §Disclosure).
 *
 * The card's own second expansion is retired. The rework's disclosure idiom is one
 * idiom, exactly one level deep, and the line expansion is already that level: a
 * twisty inside it would be a second. What the twisty hid falls into two halves and
 * they are settled differently:
 *
 * - **Rate and base come OUT onto the card**, always visible. They are the two figures
 *   an analyst wants every time — "the discount is 10 % of 638.80" is the whole reading
 *   — and they were behind a click that only ever appeared on a multi-record group, so
 *   a single-record card could not show them at all.
 * - **The sub-records go.** They are the same rule stated N times; the `×N` pill already
 *   says the rule applied N times for the summed value, and the per-application split is
 *   the promotions rail's job (ticket 117), not a nested list inside a nested list.
 *
 * A **statistical** group carries a small neutral uppercase `STAT` key. The toggle that
 * used to hide these is gone with `countStatistical`, so nothing is hidden any more —
 * but the distinction is real (a statistical row is priced and NOT charged), and this is
 * the one place the rework would otherwise be strictly worse. No hue: the two-hue budget
 * is spent on a fired promotion and a `W` line, and "this row is statistical" is neither.
 */

/** Rate is shown to 3 decimals (the WPF `N3`); base/value use the shared 2-dp money. */
function formatRate(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : ''
}

interface Props {
  card: AggregatedCondition
}

export default function ConditionCard({ card }: Props) {
  const { t } = useTranslation('simulation')
  const badgeLabel = card.badge ? t(`detail.badge.${card.badge}`) : null

  return (
    <div
      data-condition-card={card.conditionType}
      data-statistical={card.isStatistics ? 'yes' : 'no'}
      className="rounded-md border border-border/60 bg-background px-3 py-1.5"
    >
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 text-start text-sm">
          <span className="font-bold text-muted-foreground">{card.index}. </span>
          <span className="font-semibold">{t(`detail.category.${card.category}`)}: </span>
          <span className="font-bold">{card.conditionType}</span>
          {/* The same raw server description the elements trace and the promotion card
              carry (`70% 2nd PCS`), isolated for the same reason (ticket 121). Here it
              measures SAFE unwrapped — the em-dash is a neutral and the condition type
              in front of it is strong Latin in the same paragraph run, so bidi W7/N1
              hold it in place — but that immunity is a property of the DATA beside it,
              not of the value, so the value is wrapped like its two siblings.
              Over-application is free; a call site that depends on its neighbours is
              not a rule anyone can review. */}
          {card.description ? (
            <span className="text-muted-foreground">
              {' — '}
              <Ltr>{card.description}</Ltr>
            </span>
          ) : null}
        </span>

        {/* Deliberately the SAME chip as the origin badge two elements along, rather
            than the promo-kind chip ground: `STAT` and `PROMOTION` are both "a fact
            about this rule", and coupling a statistical marker to the promotion-kind
            vocabulary would tie two unrelated things together. */}
        {card.isStatistics ? (
          <span
            data-stat-key
            data-upper-mark
            className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
          >
            {t('detail.stat')}
          </span>
        ) : null}

        {/* The `×N` pill survives the retirement of the sub-records: it is the statement
            that the rule applied N times for the summed value beside it. */}
        {card.count > 1 ? (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary tabular-nums">
            {t('detail.countPill', { count: card.count })}
          </span>
        ) : null}

        {badgeLabel ? (
          <span
            data-upper-mark
            className="shrink-0 rounded bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground"
          >
            {badgeLabel}
          </span>
        ) : null}

        <span className="shrink-0 text-sm font-bold tabular-nums">{formatMoney(card.conditionValue)}</span>
      </div>

      {/* Rate + base, on the card at rest — no second click. */}
      <div data-rate-base className="text-[11px] leading-4 text-muted-foreground tabular-nums">
        {t('detail.rateBase', {
          rate: formatRate(card.conditionRate),
          unit: card.conditionRateUnit,
          base: formatMoney(card.conditionBaseValue),
        })}
      </div>
    </div>
  )
}
