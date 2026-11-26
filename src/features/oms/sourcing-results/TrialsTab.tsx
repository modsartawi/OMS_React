import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { FlaskConical, Loader2, Play, Rows3 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { TrialRow, TrialsReply } from '@/core/models/sourcing-results'
import { usePermissions } from '@/core/permissions'
import { canSaveWeightSets } from '@/core/sourcing-advisor/access'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { TD, TH } from '@/core/ui/sheet-table'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatRange, fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import Fig from './Fig'
import { filtersFromParams, filtersToParams, setFromKey, setKey } from './filters'
import type { ResultsTabProps } from './ResultsTabs'
import { countText, percentText } from './text'
import { factorTable, trialResult, trialStart, trialsList, type TrialListRow } from './trials-model'

const TRIALS_KEY = ['sourcing-results', 'trials'] as const
const PILL = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap'
const STATE_PILL: Record<TrialRow['state'], string> = {
  DONE: `${PILL} border-primary/30 bg-primary-050 text-primary-800`,
  RUNNING: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  WAITING: `${PILL} border-border bg-muted text-muted-foreground`,
  FAILED: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
}

/**
 * The Trials tab (ticket 973, spec 4354 §18, BO 4283 decisions 3–18): the list of trials, the form that starts one (a
 * saved version and a period; the save grant's), a trial's result (orders solved, refused by reason, failed), its factor
 * table, and "open with this set beside it", which puts the tried set in the page's "Set beside it".
 *
 * 🚩 Built on stubs: the trial door (BO 4394) is not specified (`./api`). No riyal anywhere, no green and no red.
 */
export default function TrialsTab(_props: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const trials = useQuery({ queryKey: TRIALS_KEY, queryFn: () => sourcingResultsApi.trials(), retry: false })
  const [picked, setPicked] = useState<string | null>(null)
  const { update } = useUrlQuery(filtersFromParams, filtersToParams)

  if (trials.isError) return <ErrorBanner title={t('trials.failedTitle')} message={apiErrorMessage(trials.error, t('trials.failed'))} />
  if (!trials.data)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('trials.loading')}
      </p>
    )

  const list = trialsList(trials.data)
  const shown = list.rows.find((r) => r.trialId === picked) ?? list.rows.find((r) => r.state === 'DONE') ?? null
  const openBeside = (row: TrialListRow) => {
    update((prev) => ({ ...prev, set: null, beside: { name: row.set.name, version: row.set.version } }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-4" data-trials="">
      <p className="max-w-[90ch] text-xs text-muted-foreground">{t('trials.lede')}</p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <StartForm reply={trials.data} />
        <TrialsList list={list} shownId={shown?.trialId ?? null} onShow={setPicked} onBeside={openBeside} />
      </div>
      {shown && <TrialResultCard trial={shown} onBeside={openBeside} />}
    </div>
  )
}

function StartForm({ reply }: { reply: TrialsReply }) {
  const { t } = useTranslation('sourcing-results')
  const may = canSaveWeightSets(usePermissions())
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ set: '', from: '', to: '' })
  const start = trialStart({ set: setFromKey(form.set), from: form.from, to: form.to }, reply)
  const run = useMutation({
    mutationFn: sourcingResultsApi.startTrial,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIALS_KEY }),
  })
  const setLabel = (s: TrialsReply['versions'][number]) =>
    t(s.trial ? 'filters.setTrial' : s.candidate ? 'filters.setCandidate' : 'filters.set', { name: fsi(s.name), version: fsi(s.version) })

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border p-3" data-trial-form="">
      <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <FlaskConical className="h-4 w-4" aria-hidden />
        {t('trials.form.title')}
      </h3>
      {!may && (
        <p className="text-xs text-muted-foreground" data-trial-no-grant="">
          {t('trials.form.noGrant')}
        </p>
      )}
      <Field label={t('trials.form.version')} hint={t('trials.form.versionHint')}>
        <Select value={form.set} onChange={(e) => setForm({ ...form, set: e.target.value })} disabled={!may} data-trial-version="">
          <option value="">{t('trials.form.chooseVersion')}</option>
          {reply.versions.map((v) => (
            <option key={setKey(v)} value={setKey(v)}>
              {setLabel(v)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('trials.form.from')}>
          <Input
            type="date"
            value={form.from}
            min={reply.earliestDay}
            max={reply.latestDay}
            onChange={(e) => setForm({ ...form, from: e.target.value })}
            disabled={!may}
            data-trial-from=""
          />
        </Field>
        <Field label={t('trials.form.to')}>
          <Input
            type="date"
            value={form.to}
            min={reply.earliestDay}
            max={reply.latestDay}
            onChange={(e) => setForm({ ...form, to: e.target.value })}
            disabled={!may}
            data-trial-to=""
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground" data-trial-days="">
        {start.days != null && start.days > 0 ? (
          <Trans t={t} i18nKey="trials.form.days" components={{ n: <Fig value={countText(start.days)} />, max: <Fig value={countText(reply.maxDays)} /> }} />
        ) : (
          <Trans t={t} i18nKey="trials.form.limits" components={{ max: <Fig value={countText(reply.maxDays)} />, from: <Fig value={reply.earliestDay} /> }} />
        )}
      </p>
      {may && start.problem && start.problem !== 'NO_VERSION' && start.problem !== 'NO_PERIOD' && (
        <p className="text-xs text-attention-800" data-trial-problem={start.problem}>
          {t(`trials.form.problems.${start.problem}`, { max: fsi(reply.maxDays) })}
        </p>
      )}
      <div>
        <Button variant="primary" disabled={!may || !start.request || run.isPending} onClick={() => start.request && run.mutate(start.request)} data-trial-start="">
          {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {t('trials.form.start')}
        </Button>
      </div>
      {run.isError && <ErrorBanner title={t('trials.form.refusedTitle')} message={apiErrorMessage(run.error, t('trials.form.refused'))} />}
      {run.data && (
        <p className="rounded-md border border-primary/30 bg-primary-050 px-3 py-2 text-xs text-primary-800" role="status" data-trial-started={run.data.trialId}>
          {run.data.fromKept
            ? t('trials.form.fromKept')
            : run.data.state === 'WAITING'
              ? t('trials.form.waiting', { place: fsi(run.data.queuePosition ?? '') })
              : t('trials.form.started')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('trials.form.note')}</p>
    </section>
  )
}

function TrialsList({
  list,
  shownId,
  onShow,
  onBeside,
}: {
  list: ReturnType<typeof trialsList>
  shownId: string | null
  onShow: (id: string) => void
  onBeside: (row: TrialListRow) => void
}) {
  const { t } = useTranslation('sourcing-results')
  if (list.rows.length === 0)
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-trials-empty="">
        {t('trials.empty')}
      </p>
    )
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-xs text-muted-foreground" data-trials-queue="">
        {list.running ? t('trials.queue', { count: list.waiting, n: fsi(list.waiting) }) : t('trials.queueIdle')}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-trials-list="">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className={TH}>{t('trials.cols.set')}</th>
              <th className={TH}>{t('trials.cols.period')}</th>
              <th className={TH}>{t('trials.cols.state')}</th>
              <th className={TH}>{t('trials.cols.started')}</th>
              <th className={`${TH} text-end`}>{t('trials.cols.solved')}</th>
              <th className={`${TH} text-end`}>{t('trials.cols.refused')}</th>
              <th className={`${TH} text-end`}>{t('trials.cols.failed')}</th>
              <th className={TH}>
                <span className="sr-only">{t('trials.cols.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((r) => {
              const result = trialResult(r)
              return (
                <tr
                  key={r.trialId}
                  className={`border-b border-border/60 ${r.trialId === shownId ? 'bg-muted/60' : ''}`}
                  data-trial={r.trialId}
                  data-trial-state={r.state}
                >
                  <td className={TD}>
                    <bdi>{r.set.name}</bdi>{' '}
                    <span className="text-muted-foreground">{t('trials.version', { version: fsi(r.set.version) })}</span>
                    {r.set.trial && <span className={`${PILL} ms-1 border-attention-border bg-attention-050 text-attention-800`}>{t('trials.trialSet')}</span>}
                  </td>
                  <td className={TD}>
                    <Ltr>{formatRange(r.period.from, r.period.to)}</Ltr>{' '}
                    <span className="text-muted-foreground">{t('trials.days', { count: r.days, n: fsi(r.days) })}</span>
                  </td>
                  <td className={TD}>
                    <span className={STATE_PILL[r.state]}>
                      {r.state === 'WAITING' && r.queuePosition != null
                        ? t('trials.states.WAITING_AT', { place: fsi(r.queuePosition) })
                        : t(`trials.states.${r.state}`)}
                    </span>
                  </td>
                  <td className={TD}>
                    <bdi>{r.startedBy}</bdi> <Ltr>{r.startedAt}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{countText(result.solved)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{countText(result.refusedTotal)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{countText(result.failed)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <span className="inline-flex gap-1">
                      <Button variant="secondary" onClick={() => onShow(r.trialId)} aria-pressed={r.trialId === shownId} data-trial-show="">
                        {t('trials.show')}
                      </Button>
                      {r.canOpenBeside && (
                        <Button variant="secondary" onClick={() => onBeside(r)} data-trial-beside="">
                          {t('trials.openBeside')}
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrialResultCard({ trial, onBeside }: { trial: TrialListRow; onBeside: (row: TrialListRow) => void }) {
  const { t } = useTranslation('sourcing-results')
  const r = trialResult(trial)
  const setName = t(trial.set.trial ? 'filters.setTrial' : 'filters.set', { name: fsi(trial.set.name), version: fsi(trial.set.version) })
  return (
    <section className="flex flex-col gap-4 rounded-md border border-border p-3" data-trial-result={trial.trialId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          <Trans t={t} i18nKey="trials.result.title" values={{ set: setName }} components={{ set: <bdi />, period: <Fig value={formatRange(trial.period.from, trial.period.to)} /> }} />
        </h3>
        {trial.canOpenBeside && (
          <Button variant="primary" onClick={() => onBeside(trial)} data-trial-result-beside="">
            {t('trials.openBeside')}
          </Button>
        )}
      </div>
      {trial.set.trial && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-trial-set-banner="">
          {t('trials.result.trialSetBanner')}
        </p>
      )}
      {!r.done && <p className="text-xs text-muted-foreground">{t(`trials.result.notDone.${trial.state}`)}</p>}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-5" data-trial-counts="">
        {(
          [
            ['orders', r.orders],
            ['solved', r.solved],
            ['refused', r.refusedTotal],
            ['failed', r.failed],
            ['leftOut', r.leftOutNoPlan],
          ] as const
        ).map(([k, n]) => (
          <div key={k} className="flex flex-col" data-trial-count={k}>
            <dt className="text-xs text-muted-foreground">{t(`trials.result.counts.${k}`)}</dt>
            <dd className="font-semibold">
              <Ltr>{countText(n)}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
      {!r.addsUp && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-trial-mismatch="">
          {t('trials.result.mismatch')}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold">{t('trials.result.refusedTitle')}</h4>
        {r.refused.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('trials.result.noneRefused')}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-xs">
            {r.refused.map((x) => (
              <li key={x.reason} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1" data-trial-refusal={x.reason}>
                <span>{t(`trials.refusals.${x.reason}`)}</span>
                <b>
                  <Ltr>{countText(x.count)}</Ltr>
                </b>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('trials.result.refusedNote')}</p>
      </div>
      {r.done && <FactorTableSection trialId={trial.trialId} />}
    </section>
  )
}

function FactorTableSection({ trialId }: { trialId: string }) {
  const { t } = useTranslation('sourcing-results')
  const may = canSaveWeightSets(usePermissions())
  const queryClient = useQueryClient()
  const key = ['sourcing-results', 'factors', trialId]
  const factors = useQuery({ queryKey: key, queryFn: () => sourcingResultsApi.factors(trialId), retry: false })
  const start = useMutation({
    mutationFn: () => sourcingResultsApi.startFactors(trialId),
    onSuccess: (reply) => queryClient.setQueryData(key, reply),
  })

  return (
    <div className="flex flex-col gap-2" data-factor-table="">
      <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <Rows3 className="h-3.5 w-3.5" aria-hidden />
        {t('trials.factors.title')}
      </h4>
      <p className="text-xs text-muted-foreground">{t('trials.factors.lede')}</p>
      {factors.isError ? (
        <ErrorBanner title={t('trials.factors.failedTitle')} message={apiErrorMessage(factors.error, t('trials.factors.failed'))} />
      ) : !factors.data ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t('trials.factors.loading')}
        </p>
      ) : (
        (() => {
          const table = factorTable(factors.data)
          if (table.state !== 'DONE')
            return (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-factor-state={table.state}>
                {t(`trials.factors.states.${table.state}`)}
                {table.state === 'NOT_STARTED' && (
                  <Button variant="secondary" disabled={!may || start.isPending} onClick={() => start.mutate()} data-factor-start="">
                    {t('trials.factors.start')}
                  </Button>
                )}
                {start.isError && <ErrorBanner message={apiErrorMessage(start.error, t('trials.factors.failed'))} />}
              </div>
            )
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b border-border text-muted-foreground">
                  <tr>
                    <th className={TH}>{t('trials.factors.cols.factor')}</th>
                    <th className={`${TH} text-end`}>{t('trials.factors.cols.changed')}</th>
                    <th className={TH}>{t('trials.factors.cols.kinds')}</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row) => (
                    <tr key={row.key} className={`border-b border-border/60 ${row.changesNone ? 'text-muted-foreground' : ''}`} data-factor={row.key}>
                      <td className={TD}>
                        {row.measure
                          ? t('trials.factors.measure', { measure: t(`trials.factors.measures.${row.measure}`, { defaultValue: fsi(row.measure) }) })
                          : t(`trials.factors.names.${row.factor}`)}
                        {row.switched === 'ON' && <span className="ms-1 text-muted-foreground">{t('trials.factors.switchedOn')}</span>}
                      </td>
                      <td className={`${TD} text-end`}>
                        {row.changesNone ? (
                          <span data-factor-none="">{t('trials.factors.none')}</span>
                        ) : (
                          <>
                            <b>
                              <Ltr>{countText(row.changed.count)}</Ltr>
                            </b>{' '}
                            (<Ltr>{percentText(row.changed.percent)}</Ltr>)
                          </>
                        )}
                      </td>
                      <td className={`${TD} whitespace-normal`}>
                        {row.kinds.map((k) => (
                          <span key={k.kind} className="me-3 inline-flex gap-1">
                            {t(`classes.${k.kind}`)} <Ltr>{countText(k.count)}</Ltr>
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-muted-foreground">
                <Trans t={t} i18nKey="trials.factors.plans" components={{ n: <Fig value={countText(table.plans)} /> }} />
              </p>
            </div>
          )
        })()
      )}
    </div>
  )
}
