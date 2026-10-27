import { useTranslation } from 'react-i18next'
import { guardSeverityTone } from '@/core/insurance-rules/tones'
import { fsi } from '@/core/util/bidi'
import { METRICS_OUTCOMES, outcomeShares, totalFires, type FiresBySeverity, type MetricsOutcome, type OutcomeMix } from './model'

// Horizontal bars drawn as plain blocks on the theme tokens (ticket 615): the app has no chart library, and a
// flex row of blocks sized by `inlineSize` follows the text direction by itself (under RTL it grows from the
// right). Each bar is a picture of numbers the row also writes out, so the bar itself is `aria-hidden`.

export const OUTCOME_FILL: Record<MetricsOutcome, string> = {
  removed: 'bg-danger',
  changed: 'bg-attention',
  overridden: 'bg-post',
  acknowledged: 'bg-primary',
  exception: 'bg-muted-foreground',
}

/** A row's fires, stacked heaviest first, the bar's length its share of the busiest row. */
export function FiresBar({ fires, max }: { fires: FiresBySeverity; max: number }) {
  const total = totalFires(fires)
  const share = max > 0 ? total / max : 0
  return (
    <span className="flex h-2.5 w-full overflow-hidden rounded-sm bg-muted" aria-hidden data-fires-bar={String(total)}>
      <span className="flex h-full" style={{ inlineSize: `${share * 100}%` }}>
        {(['refuse', 'override', 'warn'] as const).map((s) =>
          fires[s] > 0 ? <span key={s} className={`h-full ${guardSeverityTone(s).fill}`} style={{ inlineSize: `${(fires[s] / total) * 100}%` }} data-segment={s} /> : null,
        )}
      </span>
    </span>
  )
}

/** The outcome mix as one full-width stacked bar; its tooltip names every share. */
export function OutcomeBar({ mix }: { mix: OutcomeMix }) {
  const { t } = useTranslation('insurance-metrics')
  const shares = outcomeShares(mix)
  if (shares.length === 0) return <span className="text-muted-foreground">{t('dash')}</span>
  const title = shares
    .filter((s) => s.count > 0)
    .map((s) => t('outcomeShare', { outcome: t(`outcome.${s.outcome}`), n: fsi(s.count), pct: fsi(Math.round(s.share * 100)) }))
    .join(t('listSeparator'))
  return (
    <span className="flex h-2.5 w-full min-w-24 overflow-hidden rounded-sm bg-muted" title={title} data-outcome-bar="">
      {shares.map((s) =>
        s.count > 0 ? <span key={s.outcome} className={`h-full ${OUTCOME_FILL[s.outcome]}`} style={{ inlineSize: `${s.share * 100}%` }} data-segment={s.outcome} data-count={s.count} /> : null,
      )}
    </span>
  )
}

/** The legend for both bars. */
export function Legend({ kind }: { kind: 'severity' | 'outcome' }) {
  const { t } = useTranslation(['insurance-metrics', 'insurance-rules'])
  const items =
    kind === 'severity'
      ? (['refuse', 'override', 'warn'] as const).map((s) => ({ key: s, fill: guardSeverityTone(s).fill, label: t(`insurance-rules:severity.${s.toUpperCase()}`) }))
      : METRICS_OUTCOMES.map((o) => ({ key: o, fill: OUTCOME_FILL[o], label: t(`insurance-metrics:outcome.${o}`) }))
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" data-legend={kind}>
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-sm ${i.fill}`} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
