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
import { CARD, count, CountList, day, NS, Pct, PromiseTable, SetRef } from './parts'

const byCount = (counts: Record<string, number> | undefined): [string, number][] =>
  Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))

/**
 * The candidate log (ticket 967, the owner's variant A: rows that open): who, when, the version before and after, the
 * trial's number and its headline figures; a row opens onto the written reason, the trial's period, the orders refused
 * by reason and the promise check per mode under the new version. Never edited (BO 4360 `GET WeightSets/CandidateLog`;
 * the trial's figures are BO 4395's `review`, absent for a marking logged before it).
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

  const opened = open ?? log.data[0].markedAt
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
            <LogRows key={e.markedAt} entry={e} isOpen={opened === e.markedAt} onToggle={() => setOpen(opened === e.markedAt ? '' : e.markedAt)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LogRows({ entry: e, isOpen, onToggle }: { entry: CandidateLogEntry; isOpen: boolean; onToggle: () => void }) {
  const { t } = useTranslation(NS)
  const review = e.review ?? null
  const trial = review?.trial ?? null
  const dawaaNow = trial?.promise.find((p) => p.mode === 'DAWAA_NOW')
  return (
    <Fragment>
      <tr className="border-b border-border" data-log-row={e.markedAt}>
        <td className={TD}>
          <Button variant="text" onClick={onToggle} aria-expanded={isOpen} data-log-toggle={e.markedAt}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />}
            <Ltr>{e.markedAt}</Ltr>
          </Button>
        </td>
        <td className={TD}>{e.markedBy ? <Ltr>{e.markedBy}</Ltr> : <span className="text-muted-foreground">{t('log.seed')}</span>}</td>
        <td className={TD}>{e.before ? <SetRef r={e.before} /> : <span className="text-muted-foreground">{t('log.nothing')}</span>}</td>
        <td className={TD} data-log-after="">
          <SetRef r={e.after} strong />
        </td>
        <td className={TD} data-log-trial="">
          {review?.exception ? (
            <span className="text-muted-foreground">{t(`exceptionShort.${review.exception}`)}</span>
          ) : trial ? (
            <Ltr>{trial.trialId}</Ltr>
          ) : (
            <span className="text-muted-foreground">{t('log.noTrial')}</span>
          )}
        </td>
        <td className={`${TD} text-end`}>
          <Pct n={trial?.candidateTrialId ? trial.plansChangedShare : null} />
        </td>
        <td className={`${TD} text-end`}>
          <Pct n={trial?.refusedShare} />
        </td>
        <td className={`${TD} text-end`}>
          <Pct n={dawaaNow?.share} />
        </td>
        <td className={TD} data-log-bar="">
          {review?.barPeriodCounted ? (
            <span>{t('log.barRestarted', { from: fsi(day(review.barCountedFrom ?? '')) })}</span>
          ) : (
            <span className="text-muted-foreground">{t('log.barNone')}</span>
          )}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-border bg-muted/40" data-log-detail={e.markedAt}>
          <td className="px-4 py-3" colSpan={9}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t('log.reason')}</p>
                <p className="mt-1 text-sm whitespace-pre-line" data-log-reason="">
                  <bdi>{e.reason}</bdi>
                </p>
                {review?.exception && <p className="mt-2 text-xs text-muted-foreground">{t(`exception.${review.exception}`)}</p>}
                {trial && !review?.exception && (
                  <>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t('log.trialPeriod', {
                        trial: fsi(trial.trialId),
                        period: fsi(formatRange(day(trial.from), day(trial.to))),
                        days: fsi(trial.days),
                      })}
                    </p>
                    <p className="mt-2 text-xs font-medium">
                      {t('log.ordersRefused')} <Ltr>{count(trial.refused)}</Ltr>
                    </p>
                    <CountList rows={byCount(trial.refusedBy)} prefix="refusal" />
                  </>
                )}
              </div>
              {trial && !review?.exception && <PromiseTable rows={trial.promise} />}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  )
}
