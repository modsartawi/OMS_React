import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { CandidateLogEntry } from '@/core/models/sourcing-sets'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatRange, fsi } from '@/core/util/bidi'
import { logQuery } from './api'
import { orderedTrial } from './marking-model'
import { CARD, count, CountList, NS, pct, PromiseTable, SetRef } from './parts'

/**
 * The candidate log (ticket 967, the owner's variant A: rows that open): who, when, the version before and after, the
 * trial's number and its headline figures; a row opens onto the written reason, the trial's period, the orders refused
 * by reason and the promise check per mode under the new version. Never edited (BO 4360).
 */
export default function CandidateLog() {
  const { t } = useTranslation(NS)
  const log = useQuery(logQuery())
  const [open, setOpen] = useState<string | null>(null)

  if (log.isError) return <ErrorBanner title={t('log.failedTitle')} message={apiErrorMessage(log.error, t('log.failed'))} />
  if (!log.data)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('log.loading')}
      </p>
    )
  if (log.data.length === 0) return <p className={`${CARD} text-sm text-muted-foreground`}>{t('log.empty')}</p>

  const opened = open ?? log.data[0].at
  return (
    <div className={`${CARD} overflow-x-auto p-0`}>
      <table className="w-full text-xs" data-log="">
        <thead className="border-b border-border text-muted-foreground">
          <tr>
            <th className={TH}>{t('log.cols.when')}</th>
            <th className={TH}>{t('log.cols.who')}</th>
            <th className={TH}>{t('log.cols.before')}</th>
            <th className={TH}>{t('log.cols.after')}</th>
            <th className={TH}>{t('log.cols.trial')}</th>
            <th className={`${TH} text-end`}>{t('log.cols.plansChanged')}</th>
            <th className={`${TH} text-end`}>{t('log.cols.refused')}</th>
            <th className={`${TH} text-end`}>{t('log.cols.dawaaNow')}</th>
            <th className={TH}>{t('log.cols.bar')}</th>
          </tr>
        </thead>
        <tbody>
          {log.data.map((e) => (
            <LogRows key={e.at} entry={e} isOpen={opened === e.at} onToggle={() => setOpen(opened === e.at ? '' : e.at)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LogRows({ entry: e, isOpen, onToggle }: { entry: CandidateLogEntry; isOpen: boolean; onToggle: () => void }) {
  const { t } = useTranslation(NS)
  const trial = e.trial && orderedTrial(e.trial)
  const dawaaNow = trial?.promise.find((p) => p.mode === 'DAWAA_NOW')
  return (
    <Fragment>
      <tr className="border-b border-border" data-log-row={e.at}>
        <td className={TD}>
          <Button variant="text" onClick={onToggle} aria-expanded={isOpen} data-log-toggle={e.at}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />}
            <Ltr>{e.at}</Ltr>
          </Button>
        </td>
        <td className={TD}>{e.by ? <Ltr>{e.by}</Ltr> : <span className="text-muted-foreground">{t('log.seed')}</span>}</td>
        <td className={TD}>{e.before ? <SetRef r={e.before} /> : <span className="text-muted-foreground">{t('log.nothing')}</span>}</td>
        <td className={TD} data-log-after="">
          <SetRef r={e.after} strong />
        </td>
        <td className={TD} data-log-trial="">
          {trial ? (
            <Ltr>{trial.trialId}</Ltr>
          ) : (
            <span className="text-muted-foreground">{t(e.exception ? `exceptionShort.${e.exception}` : 'log.noTrial')}</span>
          )}
        </td>
        <td className={`${TD} text-end`}>{trial ? <Ltr>{pct(trial.plansChanged.percent)}</Ltr> : '—'}</td>
        <td className={`${TD} text-end`}>{trial ? <Ltr>{pct(trial.refused.percent)}</Ltr> : '—'}</td>
        <td className={`${TD} text-end`}>{dawaaNow ? <Ltr>{pct(dawaaNow.percent)}</Ltr> : '—'}</td>
        <td className={TD} data-log-bar="">
          {e.barDay !== null ? <span>{t('log.barRestarted', { day: fsi(e.barDay) })}</span> : <span className="text-muted-foreground">{t('log.barNone')}</span>}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-border bg-muted/40" data-log-detail={e.at}>
          <td className="px-4 py-3" colSpan={9}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t('log.reason')}</p>
                <p className="mt-1 text-sm" data-log-reason="">
                  <bdi>{e.reason}</bdi>
                </p>
                {e.exception && <p className="mt-2 text-xs text-muted-foreground">{t(`exception.${e.exception}`)}</p>}
                {trial && (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('log.trialPeriod', {
                        trial: fsi(trial.trialId),
                        period: fsi(formatRange(trial.period.from, trial.period.to)),
                        days: fsi(trial.days),
                      })}
                    </p>
                    <p className="mt-2 text-xs font-medium">
                      {t('log.ordersRefused')} <Ltr>{count(trial.refused.count)}</Ltr>
                    </p>
                    <CountList
                      rows={trial.refusedBy.map((r) => ({
                        key: r.reason,
                        label: t(`refusal.${r.reason}`),
                        count: r.count,
                      }))}
                    />
                  </>
                )}
              </div>
              {trial && <PromiseTable rows={trial.promise} />}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
