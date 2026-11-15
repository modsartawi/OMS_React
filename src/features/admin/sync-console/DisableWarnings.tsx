import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Ltr from '@/core/ui/Ltr'
import type { LoopHealth } from '@/core/models/sync-console'
import { formatPair } from '@/core/util/bidi'
import { syncConsoleApi } from './api'
import { disableWarnings, type DisableWork } from './control-helpers'
import CodeBadgeView from './CodeBadgeView'
import { figure } from './helpers'
import { passOutcomeBadge } from './store-helpers'
import { Time } from './StoreHealth'

const TH = 'px-2 py-1.5 font-medium whitespace-nowrap'
const TD = 'px-2 py-1 whitespace-nowrap'

/** The four counts, in column order, with the `DisableWork` each one raises. */
const COUNTS: { work: DisableWork; column: string }[] = [
  { work: 'pendingActions', column: 'pendingActions' },
  { work: 'tillBacklog', column: 'tillBacklog' },
  { work: 'deadLetters', column: 'deadLetters' },
  { work: 'scriptsWaiting', column: 'scriptsWaiting' },
]

/**
 * "Disable warns, then allows" (BackOffice 3913, ticket 901): inside the Disable dialog, one row
 * per store of what HQ may not have yet, read from `POST ActionSync/Stores/Disable/Preview`. The rows
 * still holding work are highlighted, under a one-line count.
 *
 * It only informs. Confirm is never gated on it (`disableConfirmReady`): not on what it shows, not
 * while it is read, not when the read fails — a closed store is often unreachable, and refusing would
 * make it impossible to disable.
 */
export default function DisableWarnings({ codes }: { codes: readonly string[] }) {
  const { t } = useTranslation('sync-console')
  const preview = useQuery({
    queryKey: ['sync-console', 'disable-preview', [...codes]] as const,
    queryFn: () => syncConsoleApi.disablePreview({ codes: [...codes] }),
    // Read fresh on every opening, and not retried: a failure is shown at once and holds nothing back.
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })

  if (preview.isPending) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" data-disable-warnings="loading">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t('disableWarnings.loading')}
      </p>
    )
  }
  if (preview.isError) {
    return (
      <p className="rounded-md bg-attention-050 px-3 py-2 text-xs text-attention-800" data-disable-warnings="failed">
        {t('disableWarnings.failed')} <bdi>{apiErrorMessage(preview.error, t('disableWarnings.failedHint'))}</bdi>
      </p>
    )
  }

  const w = disableWarnings(preview.data.stores)
  const col = (k: string) => t(`disableWarnings.columns.${k}`)
  return (
    <section className="flex flex-col gap-2" data-disable-warnings="read">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('disableWarnings.title')}</h3>
      <p
        className={'text-sm ' + (w.outstanding > 0 ? 'font-medium text-attention-800' : 'text-muted-foreground')}
        aria-live="polite"
        data-disable-summary={`${w.outstanding}/${w.total}`}
      >
        <Trans
          t={t}
          i18nKey={w.outstanding > 0 ? 'disableWarnings.summary' : 'disableWarnings.summaryNone'}
          values={{ n: figure(w.outstanding), total: figure(w.total) }}
          components={{ n: <Ltr />, total: <Ltr /> }}
        />
      </p>
      <div className="max-h-72 overflow-auto rounded-md border border-border/60">
        <table className="w-full text-xs" aria-label={t('disableWarnings.title')} data-disable-table="">
          <thead className="sticky top-0 bg-muted text-muted-foreground">
            <tr>
              <th className={`${TH} text-start`}>{col('store')}</th>
              <th className={`${TH} text-start`}>{col('lastConnectOk')}</th>
              <th className={`${TH} text-start`}>{col('lastPush')}</th>
              <th className={`${TH} text-start`}>{col('lastPull')}</th>
              <th className={`${TH} text-start`}>{col('lastTrxPulled')}</th>
              {COUNTS.map((c) => (
                <th key={c.column} className={`${TH} text-end`}>
                  {col(c.column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {w.rows.map(({ store, work }) => {
              const held = work.length > 0
              const counts: Record<DisableWork, number | null> = {
                pendingActions: store.pendingActions,
                tillBacklog: store.tillBacklogCount,
                deadLetters: store.openDeadLetters,
                scriptsWaiting: store.scriptsWaiting,
              }
              return (
                <tr
                  key={store.code}
                  className={'border-t border-border/60 ' + (held ? 'bg-attention-050' : '')}
                  data-disable-row={store.code}
                  data-outstanding={String(held)}
                >
                  <td className={`${TD} font-mono`}>
                    {/* A pair led by a machine value: isolated once, as a whole. */}
                    <Ltr>{formatPair(store.code, store.description)}</Ltr>
                  </td>
                  <td className={TD}>
                    <Time value={store.lastConnectOkAt} />
                  </td>
                  <td className={TD} data-disable-loop="push">
                    <LastPass health={store.push} />
                  </td>
                  <td className={TD} data-disable-loop="pull">
                    <LastPass health={store.pull} />
                  </td>
                  <td className={TD}>
                    <Time value={store.lastTrxPulledAt} />
                  </td>
                  {COUNTS.map((c) => {
                    const n = counts[c.work]
                    const on = work.includes(c.work)
                    return (
                      <td
                        key={c.column}
                        className={`${TD} text-end font-mono tabular-nums ` + (on ? 'font-semibold text-attention-800' : '')}
                        data-disable-count={c.column}
                        data-held={String(on)}
                      >
                        {n === null ? (
                          <span className="font-sans text-muted-foreground">{t('disableWarnings.notMeasured')}</span>
                        ) : (
                          <Ltr>{figure(n)}</Ltr>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground" data-disable-allowed="">
        {t('disableWarnings.allowed')}
      </p>
    </section>
  )
}

/** A loop's last pass: when, and its outcome. */
function LastPass({ health }: { health: LoopHealth }) {
  return (
    <span className="flex items-center gap-1.5">
      <Time value={health.lastPassAt} />
      <CodeBadgeView badge={passOutcomeBadge(health.lastPassOutcome)} code={health.lastPassOutcome} />
    </span>
  )
}
