import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import type { HourTotals } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { fleetLastHourQuery } from './api'
import { figure } from './helpers'

/** The totals in the order the prototype reads them: push, then pull, then the failures. */
const METRICS = [
  'pushPasses',
  'actionsPushed',
  'chunksPushed',
  'pullPasses',
  'trxPulled',
  'connectFailures',
  'errors',
] as const satisfies readonly (keyof HourTotals)[]

/** The two failure measures, drawn in the danger ink when they are not zero. */
const FAILURES: ReadonlySet<(typeof METRICS)[number]> = new Set(['connectFailures', 'errors'] as const)

/**
 * The whole fleet's last-hour totals (ticket 445): the current hour beside the
 * previous one, so a sudden drop or a burst of failures reads at a glance.
 */
export default function LastHourPanel() {
  const { t } = useTranslation('sync-console')
  const lastHour = useQuery(fleetLastHourQuery())
  const data = lastHour.data

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-last-hour="">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('lastHour.title')}</h2>
      {lastHour.isError && (
        <ErrorBanner className="p-3" message={apiErrorMessage(lastHour.error, t('lastHour.failed'))} />
      )}
      {data && (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pe-6 text-start font-medium">{t('lastHour.metric')}</th>
                <th className="pe-6 text-end font-medium">
                  <span className="block">{t('lastHour.current')}</span>
                  <span className="block font-mono">
                    <Ltr>{formatDateTime(data.current.hour)}</Ltr>
                  </span>
                </th>
                <th className="text-end font-medium">
                  <span className="block">{t('lastHour.previous')}</span>
                  <span className="block font-mono">
                    <Ltr>{formatDateTime(data.previous.hour)}</Ltr>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {METRICS.map((m) => (
                <tr key={m} data-metric={m}>
                  <td className="py-0.5 pe-6 text-muted-foreground">{t(`lastHour.metrics.${m}`)}</td>
                  <Figure value={data.current[m]} failure={FAILURES.has(m)} />
                  <Figure value={data.previous[m]} failure={FAILURES.has(m)} last />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Figure({ value, failure, last = false }: { value: number; failure: boolean; last?: boolean }) {
  return (
    <td
      className={
        'py-0.5 text-end font-mono tabular-nums ' +
        (last ? '' : 'pe-6 ') +
        (failure && value > 0 ? 'text-danger-800' : '')
      }
    >
      <Ltr>{figure(value)}</Ltr>
    </td>
  )
}
