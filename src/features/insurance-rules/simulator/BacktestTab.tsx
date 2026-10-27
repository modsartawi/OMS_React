import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import {
  BACKTEST_DAYS,
  backtestFires,
  backtestIsCurrent,
  backtestProgressPct,
  backtestRunning,
  maskedKey,
  type BacktestDays,
  type GuardBacktest,
} from '@/core/insurance-rules/backtest'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import { GUARD_SEVERITY_TONE } from '@/core/insurance-rules/tones'
import { backtestQuery, simulatorApi } from './api'
import { Tile } from './parts'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'


/**
 * Back-test (ticket 612): replay the last 30 / 90 / 180 days of real requests through the guard DRAFT
 * (`POST InsuranceRules/Guards/Backtests` → `{ id }`), follow the job (`GET …/Backtests/{id}`, read every second
 * while it runs) and read the report — fires by severity, the requests it would have stopped (patient key masked),
 * their SAR, distinct patients / stores / pharmacists, and the overlap with live guards. The job's id is in the
 * address; the report says which draft revision it replayed and whether that is still the draft's (611's Submit
 * needs a back-test of the current revision).
 */
export default function BacktestTab({ days, id, onDays, onStarted }: { days: BacktestDays; id: string | null; onDays: (d: BacktestDays) => void; onStarted: (id: string) => void }) {
  const { t } = useTranslation('insurance-simulator')
  const start = useMutation({ mutationFn: (d: BacktestDays) => simulatorApi.startBacktest(d), onSuccess: (r) => onStarted(r.id) })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card p-4" data-backtest-start="">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 text-xs text-muted-foreground">{t('backtest.days')}</legend>
          {BACKTEST_DAYS.map((d) => (
            <Chip key={d} on={days === d} onClick={() => onDays(d)} data-days={d}>
              {t('backtest.daysOption', { n: fsi(d) })}
            </Chip>
          ))}
        </fieldset>
        <Button type="button" variant="primary" className="ms-auto" disabled={start.isPending} onClick={() => start.mutate(days)} data-start-backtest="">
          <Play className="h-4 w-4" aria-hidden />
          {start.isPending ? t('backtest.starting') : t('backtest.start')}
        </Button>
      </div>

      {start.isError && isBareDenial(start.error) ? (
        <DeniedCard ns="insurance-simulator" hook="backtest-denied" />
      ) : start.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(start.error, t('backtest.startFailed'))} />
      ) : id ? (
        <Report id={id} />
      ) : (
        <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-backtest-none="">
          {t('backtest.none')}
        </p>
      )}
    </div>
  )
}

function Report({ id }: { id: string }) {
  const { t } = useTranslation('insurance-simulator')
  const bt = useQuery(backtestQuery(id))
  const draft = useQuery(guardDraftQuery())

  if (bt.isError && isBareDenial(bt.error)) return <DeniedCard ns="insurance-simulator" hook="backtest-denied" />
  if (bt.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(bt.error, t('backtest.failed'))} />
  if (!bt.data) return <Loading text={t('backtest.loading')} />
  const b = bt.data
  if (backtestRunning(b)) {
    const pct = backtestProgressPct(b)
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" role="status" data-backtest-running={b.status} data-job={id}>
        <div className="flex items-center justify-between text-sm">
          <span>{t(`backtest.status.${b.status}`)}</span>
          <span data-progress={pct}>{t('backtest.progress', { pct: fsi(pct) })}</span>
        </div>
        <span className="block h-2 w-full overflow-hidden rounded-sm bg-muted" aria-hidden>
          <span className="block h-full bg-primary" style={{ inlineSize: `${pct}%` }} />
        </span>
      </div>
    )
  }
  if (b.status === 'failed')
    return (
      <p className="rounded-md border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" role="alert" data-backtest-failed="">
        {t('backtest.jobFailed')}
      </p>
    )
  return <Done b={b} id={id} draftRevision={draft.data?.revision ?? null} />
}

function Done({ b, id, draftRevision }: { b: GuardBacktest; id: string; draftRevision: number | null }) {
  const { t } = useTranslation(['insurance-simulator', 'insurance-rules'])
  const fires = backtestFires(b)
  const current = draftRevision !== null && backtestIsCurrent(b, draftRevision)
  return (
    <section className="flex flex-col gap-4" data-backtest-report={id} data-revision={b.revision}>
      <p
        className={`rounded-md border p-3 text-sm ${current || draftRevision === null ? 'border-border/60 bg-card' : 'border-attention-border bg-attention-050 text-attention-800'}`}
        data-backtest-revision={draftRevision === null ? 'unknown' : current ? 'current' : 'stale'}
      >
        {t('backtest.revision', { revision: fsi(b.revision) })}{' '}
        {draftRevision === null ? null : current ? t('backtest.current') : t('backtest.stale', { revision: fsi(draftRevision) })}
      </p>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Tile label={t('tiles.fires')} hook="fires">
          <Ltr>{formatNumber(fires.total)}</Ltr>
        </Tile>
        {fires.rows.map(([sev, n]) => (
          <Tile key={sev} label={t(`insurance-rules:severity.${sev}`)} hook={sev} tone={GUARD_SEVERITY_TONE[sev].text}>
            <Ltr>{formatNumber(n)}</Ltr>
          </Tile>
        ))}
        <Tile label={t('tiles.sar')} hook="sar">
          <Ltr>{formatMoney(b.sar)}</Ltr>
        </Tile>
        <Tile label={t('tiles.patients')} hook="patients">
          <Ltr>{formatNumber(b.distinct.patients)}</Ltr>
        </Tile>
        <Tile label={t('tiles.stores')} hook="stores">
          <Ltr>{formatNumber(b.distinct.stores)}</Ltr>
        </Tile>
        <Tile label={t('tiles.pharmacists')} hook="pharmacists">
          <Ltr>{formatNumber(b.distinct.pharmacists)}</Ltr>
        </Tile>
      </div>
      <p className="text-sm text-muted-foreground" data-overlap={b.overlap}>
        {t('tiles.overlap', { n: fsi(formatNumber(b.overlap)), total: fsi(formatNumber(fires.total)) })}
      </p>

      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold tracking-tight">{t('stopped.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('stopped.masked')}</p>
        {b.stopped.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-stopped-none="">
            {t('stopped.none')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
            <table className="w-full text-sm" data-stopped="">
              <thead>
                <tr>
                  <th className={TH}>{t('stopped.on')}</th>
                  <th className={TH}>{t('stopped.patient')}</th>
                  <th className={TH}>{t('stopped.store')}</th>
                  <th className={TH}>{t('stopped.item')}</th>
                  <th className={`${TH} text-end`}>{t('stopped.sar')}</th>
                </tr>
              </thead>
              <tbody>
                {b.stopped.map((s, i) => (
                  <tr key={i} className="border-t border-border/60" data-stopped-row={i}>
                    <td className={TD} data-col="on">
                      <Ltr>{s.on.includes('T') ? formatDateTime(s.on) : formatDay(s.on)}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`} data-col="patient">
                      <Ltr>{maskedKey(s.maskedKey)}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`} data-col="store">
                      <Ltr>{s.store}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`} data-col="item">
                      <Ltr>{s.item}</Ltr>
                    </td>
                    <td className={NUM} data-col="sar">
                      <Ltr>{formatMoney(s.sar)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
