import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { SyncWorker } from '@/core/models/sync-console'
import { formatCount } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { workersQuery } from './api'
import { workerBanner } from './helpers'

/**
 * The worker card (ticket 445): each worker's heartbeat, version, gate, push and
 * pull widths with what is in flight, and its settings — read-only, there is no
 * door that changes them.
 *
 * 🚩 The red banner rides the door's `isStale` and nothing else (`workerBanner`):
 * a dead worker must never look like a quiet fleet (story 3).
 */
export default function WorkerCard() {
  const { t } = useTranslation('sync-console')
  const workers = useQuery(workersQuery())
  // 🚩 A failed read shows NO worker rows: react-query keeps the last good answer,
  // and drawing an old fresh heartbeat beside the error would make a dead worker
  // look like a quiet one. The red error is all the card says until a read lands.
  const items = workers.isError ? undefined : workers.data?.items
  const banner = items ? workerBanner(items) : null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-worker-card="">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('worker.title')}</h2>
      {banner && (
        <div data-worker-banner={banner.kind}>
          <ErrorBanner
            className="p-3"
            title={banner.kind === 'stale' ? t('banner.staleTitle') : t('banner.noneTitle')}
            message={banner.kind === 'stale' ? t('banner.staleDetail') : t('banner.noneDetail')}
          >
            {banner.kind === 'stale' && (
              <p className="mt-1 font-mono text-xs">
                {banner.instances.map((i) => (
                  <span key={i} className="me-2">
                    <Ltr>{i}</Ltr>
                  </span>
                ))}
              </p>
            )}
          </ErrorBanner>
        </div>
      )}
      {workers.isError && (
        <ErrorBanner className="p-3" message={apiErrorMessage(workers.error, t('worker.failed'))} />
      )}
      {items?.map((w) => <WorkerRow key={w.instance} worker={w} />)}
    </section>
  )
}

function WorkerRow({ worker: w }: { worker: SyncWorker }) {
  const { t } = useTranslation('sync-console')
  const settings = Object.entries(w.settings)
  return (
    <div className="flex flex-col gap-2" data-worker={w.instance}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
        <span className="font-mono font-semibold">
          <Ltr>{w.instance}</Ltr>
        </span>
        <Fact label={t('worker.lastFlush')}>
          {w.lastFlushAt ? <Ltr>{formatDateTime(w.lastFlushAt)}</Ltr> : t('worker.never')}
        </Fact>
        <Fact label={t('worker.version')}>
          <Ltr>{w.version}</Ltr>
        </Fact>
        <Fact label={t('worker.gate')}>
          <StatusBadge sev={w.gateOn ? 'ok' : 'mute'}>{w.gateOn ? t('worker.gateOn') : t('worker.gateOff')}</StatusBadge>
        </Fact>
        <Fact label={t('worker.push')}>
          <Ltr>{formatCount(w.pushInFlight, w.pushWidth)}</Ltr>
        </Fact>
        <Fact label={t('worker.pull')}>
          <Ltr>{formatCount(w.pullInFlight, w.pullWidth)}</Ltr>
        </Fact>
      </div>
      {settings.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label={t('worker.settings')}>
          {settings.map(([key, value]) => (
            <div key={key} className="flex gap-1.5">
              <dt>
                <Ltr>{key}</Ltr>
              </dt>
              <dd className="font-mono text-foreground">
                <Ltr>{value}</Ltr>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="tabular-nums">{children}</span>
    </span>
  )
}
