import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import type { LoopHealth, StoreDetail, SyncLoop } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { figure } from './helpers'
import { passOutcomeBadge } from './store-helpers'
import CodeBadgeView from './CodeBadgeView'

/**
 * A worker store's health summary (ticket 446): reachable and its backoff, the push
 * lag with its oldest pending action, the last transaction pulled, and each loop's
 * last pass and last error — every value as the door sent it.
 *
 * A WPF store never reaches here: it has no health row (`StorePage`).
 */
export default function StoreHealth({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={t('health.label')} data-store-health="">
      {row.healthUpdatedAt ? (
        <p className="text-xs text-muted-foreground" data-health-as-of="">
          <Trans t={t} i18nKey="store.healthAsOf" values={{ at: formatDateTime(row.healthUpdatedAt) }} components={{ at: <Ltr /> }} />
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('store.noHealth')}</p>
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-4">
        <Block title={t('health.reachable')} data="reachable">
          <Fact label={t('health.lastConnectOk')}>
            <Time value={row.lastConnectOkAt} />
          </Fact>
          <Fact label={t('health.lastConnectFail')}>
            <Time value={row.lastConnectFailAt} />
          </Fact>
          {row.backoffUntil && (
            <Fact label={t('health.backoffUntil')}>
              <Time value={row.backoffUntil} />
            </Fact>
          )}
          {row.lastConnectError && <bdi className="block text-sm break-words text-danger-800">{row.lastConnectError}</bdi>}
        </Block>
        <Block title={t('health.push')} data="push">
          <p className="text-sm tabular-nums">
            <Trans
              t={t}
              i18nKey="health.pendingActions"
              count={row.pendingActions}
              values={{ n: figure(row.pendingActions) }}
              components={{ n: <Ltr /> }}
            />
          </p>
          <Fact label={t('health.oldestPending')}>
            <Time value={row.oldestPendingActionAt} />
          </Fact>
        </Block>
        <Block title={t('health.pull')} data="pull">
          <Fact label={t('health.lastTrxPulled')}>
            <Time value={row.lastTrxPulledAt} />
          </Fact>
        </Block>
        <Block title={t('health.lastErrors')} data="last-errors">
          <LoopError loop="push" health={row.push} />
          <LoopError loop="pull" health={row.pull} />
        </Block>
      </div>
    </div>
  )
}

function Block({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-health-block={data}>
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums">{children}</span>
    </p>
  )
}

/** A server time, or "Never" when the door sent `null`. */
function Time({ value }: { value: string | null }) {
  const { t } = useTranslation('sync-console')
  return value ? <Ltr>{formatDateTime(value)}</Ltr> : <span className="text-muted-foreground">{t('health.never')}</span>
}

/** One loop's last pass (time and outcome) and its last error with its time. */
function LoopError({ loop, health }: { loop: SyncLoop; health: LoopHealth }) {
  const { t } = useTranslation('sync-console')
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-loop={loop}>
      <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
        <span className="font-medium">{t(`loops.${loop}`)}</span>
        <span className="text-xs text-muted-foreground">{t('health.lastPass')}</span>
        <Time value={health.lastPassAt} />
        {/* A loop that never ran already reads "Never"; its `None` badge would say it twice. */}
        {health.lastPassAt && (
          <CodeBadgeView badge={passOutcomeBadge(health.lastPassOutcome)} code={health.lastPassOutcome} />
        )}
      </p>
      {health.lastError ? (
        <p className="min-w-0 text-sm">
          {health.lastErrorAt && (
            <>
              <span className="text-xs text-muted-foreground">
                <Ltr>{formatDateTime(health.lastErrorAt)}</Ltr>
              </span>{' '}
            </>
          )}
          <bdi className="break-words text-danger-800" data-loop-error={loop}>
            {health.lastError}
          </bdi>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">{t('health.noError')}</p>
      )}
    </div>
  )
}
