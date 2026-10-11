import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { runnersQuery } from './api'
import { runnerRows, type RunnerRow } from './runner-helpers'
import { figure } from './storeday-helpers'
import TokenBadgeView from './TokenBadgeView'

/**
 * The red banner over the fleet tiles (ticket 465): drawn when ANY runner is `down`, naming each.
 * It reads the same query as the card, so the two never disagree. A failed read raises no banner:
 * the card shows the error instead, and never an old answer beside it.
 */
export function RunnerBanner() {
  const { t } = useTranslation('sap-export-console')
  const runners = useQuery(runnersQuery())
  const items = runners.isError ? undefined : runners.data?.items
  const down = items ? runnerRows(items).down : []
  if (down.length === 0) return null
  return (
    <div data-runner-banner="">
      <ErrorBanner
        className="p-3"
        title={t('runners.banner.title', { count: down.length, n: fsi(figure(down.length)) })}
        message={t('runners.banner.detail')}
      >
        <p className="mt-1 flex flex-wrap gap-x-3 font-medium">
          {down.map((r) => (
            <span key={r.key} data-runner-down={r.key}>
              <RunnerName row={r} />
            </span>
          ))}
        </p>
      </ErrorBanner>
    </div>
  )
}

/**
 * The runner card (BackOffice spec 2579 stories 8–10, ticket 465): the legacy uploader, the three
 * IDoc stages and the census rollup, each with its liveness as the door judged it (`down` danger,
 * `up` success, `idle` muted — never red), its host, its last cycle and what that cycle did.
 * A row with no heartbeat yet says it is inferred. Read-only: nothing here starts or stops a runner.
 *
 * 🚩 A failed read shows NO rows (the sync console's worker-card rule): an old "up" beside the error
 * would make a dead runner look alive.
 */
export default function RunnerCard() {
  const { t } = useTranslation('sap-export-console')
  const runners = useQuery(runnersQuery())
  const items = runners.isError ? undefined : runners.data?.items
  const rows = items ? runnerRows(items).rows : null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-runner-card="">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold tracking-tight">{t('runners.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('runners.hint')}</p>
      </div>
      {runners.isError && <ErrorBanner className="p-3" message={apiErrorMessage(runners.error, t('runners.failed'))} />}
      {runners.isPending && (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('runners.loading')}
        </div>
      )}
      {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">{t('runners.empty')}</p>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-xs text-muted-foreground">
                <Th>{t('runners.columns.runner')}</Th>
                <Th>{t('runners.columns.liveness')}</Th>
                <Th>{t('runners.columns.host')}</Th>
                <Th>{t('runners.columns.lastCycleEnd')}</Th>
                <Th>{t('runners.columns.outcome')}</Th>
                <Th end>{t('runners.columns.lastMoved')}</Th>
                <Th end>{t('runners.columns.dueBacklog')}</Th>
                <Th end>{t('runners.columns.downAfter')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.key} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Th({ children, end = false }: { children: ReactNode; end?: boolean }) {
  return <th className={'px-2 py-1.5 font-medium ' + (end ? 'text-end' : 'text-start')}>{children}</th>
}

function RunnerName({ row }: { row: RunnerRow }) {
  const { t } = useTranslation('sap-export-console')
  return row.nameKey ? <>{t(row.nameKey)}</> : <Ltr>{row.key}</Ltr>
}

function Row({ row }: { row: RunnerRow }) {
  const { t } = useTranslation('sap-export-console')
  const r = row.runner
  const cell = 'px-2 py-2 align-top'
  const num = cell + ' text-end font-mono tabular-nums'
  return (
    <>
      <tr className={row.faultMessage ? '' : 'border-b border-border/40 last:border-b-0'} data-runner={row.key} data-liveness={r.liveness}>
        <td className={cell}>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              <RunnerName row={row} />
            </span>
            {row.inferred && (
              <span className="text-xs text-muted-foreground" title={t('runners.inferredHint')} data-runner-inferred="">
                {t('runners.inferred')}
              </span>
            )}
          </div>
        </td>
        <td className={cell} data-runner-liveness={r.liveness}>
          <TokenBadgeView badge={row.liveness} value={r.liveness} />
        </td>
        <td className={cell + ' font-mono text-xs'} data-runner-host="">
          {r.host && <Ltr>{r.host}</Ltr>}
        </td>
        <td className={cell + ' font-mono text-xs'} data-runner-ended="">
          {r.lastCycleEndedAt ? (
            <Ltr>{formatDateTime(r.lastCycleEndedAt)}</Ltr>
          ) : r.lastCycleStartedAt ? (
            // A first cycle still running has a start and no end yet: never "never".
            <Trans t={t} i18nKey="runners.startedAt" values={{ at: formatDateTime(r.lastCycleStartedAt) }} components={{ at: <Ltr /> }} />
          ) : (
            t('runners.never')
          )}
        </td>
        <td className={cell} data-runner-outcome={r.lastOutcome}>
          <TokenBadgeView badge={row.outcome} value={r.lastOutcome} />
        </td>
        <td className={num} data-runner-moved="">
          {r.lastMoved != null && <Ltr>{figure(r.lastMoved)}</Ltr>}
        </td>
        <td className={num} data-runner-backlog="">
          <Ltr>{figure(r.dueBacklog)}</Ltr>
        </td>
        <td className={num} data-runner-down-after="">
          <Trans t={t} i18nKey="runners.minutes" values={{ n: figure(r.downAfterMinutes) }} components={{ n: <Ltr /> }} />
        </td>
      </tr>
      {row.faultMessage && (
        <tr className="border-b border-border/40 last:border-b-0" data-runner-fault={row.key}>
          <td colSpan={8} className="px-2 pb-2">
            <div className="rounded-md bg-danger-050 px-2 py-1 text-xs text-danger-800">
              <span className="me-1.5 font-medium">{t('runners.fault')}</span>
              <bdi>{row.faultMessage}</bdi>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
