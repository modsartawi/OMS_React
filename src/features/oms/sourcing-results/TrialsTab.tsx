import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { FlaskConical, Loader2, Play, Rows3 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { TrialReply, TrialStartRequest } from '@/core/models/sourcing-results'
import { usePermissions } from '@/core/permissions'
import { canSaveWeightSets } from '@/core/sourcing-advisor/access'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatRange, fsi } from '@/core/util/bidi'
import { sourcingResultsApi, TRIALS_KEY } from './api'
import Fig from './Fig'
import { filtersFromParams, filtersToParams } from './filters'
import type { ResultsTabProps } from './ResultsTabs'
import { countText, percentText } from './text'
import { candidateTrialFor, factorTable, RECORD_KEPT_DAYS, TRIAL_LONGEST_DAYS, trialResult, trialStart, trialsList, type TrialListRow } from './trials-model'

const PILL = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap'
const STATE_PILL: Record<TrialReply['state'], string> = {
  DONE: `${PILL} border-primary/30 bg-primary-050 text-primary-800`,
  RUNNING: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  WAITING: `${PILL} border-border bg-muted text-muted-foreground`,
  FAILED: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
}

/** A wire day (`yyyy-MM-dd HH:mm:ss`) as its date. */
const day = (time: string) => time.slice(0, 10)
/** Today's local date, `yyyy-MM-dd`. */
function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The Trials tab (ticket 973, spec 4354 §18, BO 4283 decisions 3–18; BO 4394's trial doors): the list of trials, the
 * form that starts one (a saved version and a period; the save grant's), a trial's result (orders solved, refused by
 * reason, no plan, failed), its factor table, and "open with this set beside it", which reads the trial beside the
 * candidate set's trial over the same period and puts both in the page's "Set beside it". No riyal anywhere, no green
 * and no red.
 */
export default function TrialsTab(_props: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const trials = useQuery({ queryKey: TRIALS_KEY, queryFn: sourcingResultsApi.trials, retry: false })
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
  const openBeside = (row: TrialListRow, against: TrialReply) => {
    update((prev) => ({ ...prev, beside: { against: against.trialId, beside: row.trialId } }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="flex flex-col gap-4" data-trials="">
      <p className="max-w-[90ch] text-xs text-muted-foreground">{t('trials.lede')}</p>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <StartForm trials={trials.data} />
        <TrialsList list={list} shownId={shown?.trialId ?? null} onShow={setPicked} />
      </div>
      {shown && <TrialResultCard trial={shown} trials={trials.data} onBeside={openBeside} />}
    </div>
  )
}

function useStartTrial() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TrialStartRequest) => sourcingResultsApi.startTrial(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TRIALS_KEY }),
  })
}

function StartForm({ trials }: { trials: TrialReply[] }) {
  const { t } = useTranslation('sourcing-results')
  const may = canSaveWeightSets(usePermissions())
  const listId = useId()
  const [form, setForm] = useState({ name: '', version: '', from: '', to: '' })
  const now = today()
  const start = trialStart({ name: form.name, version: Number(form.version), from: form.from, to: form.to }, now)
  const run = useStartTrial()
  // SERVER GAP (spec 4354): the trial doors list no saved versions, and the weight-set list is the run grant's; the
  // form takes a name and a number, offering the names already tried.
  const names = [...new Set(trials.flatMap((x) => [x.name, x.besideCandidate]).filter(Boolean))]

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
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <Field label={t('trials.form.name')} hint={t('trials.form.versionHint')}>
          <Input value={form.name} list={listId} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!may} data-trial-name="" />
        </Field>
        <Field label={t('trials.form.version')}>
          <Input
            type="number"
            min={1}
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            disabled={!may}
            data-trial-version=""
          />
        </Field>
        <datalist id={listId}>
          {names.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t('trials.form.from')}>
          <Input type="date" value={form.from} max={now} onChange={(e) => setForm({ ...form, from: e.target.value })} disabled={!may} data-trial-from="" />
        </Field>
        <Field label={t('trials.form.to')}>
          <Input type="date" value={form.to} max={now} onChange={(e) => setForm({ ...form, to: e.target.value })} disabled={!may} data-trial-to="" />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground" data-trial-days="">
        {start.days != null && start.days > 0 ? (
          <Trans t={t} i18nKey="trials.form.days" components={{ n: <Fig value={countText(start.days)} />, max: <Fig value={countText(TRIAL_LONGEST_DAYS)} /> }} />
        ) : (
          <Trans t={t} i18nKey="trials.form.limits" components={{ max: <Fig value={countText(TRIAL_LONGEST_DAYS)} />, kept: <Fig value={countText(RECORD_KEPT_DAYS)} /> }} />
        )}
      </p>
      {may && start.problem && start.problem !== 'NO_VERSION' && start.problem !== 'NO_PERIOD' && (
        <p className="text-xs text-attention-800" data-trial-problem={start.problem}>
          {t(`trials.form.problems.${start.problem}`, { max: fsi(TRIAL_LONGEST_DAYS), kept: fsi(RECORD_KEPT_DAYS) })}
        </p>
      )}
      <div>
        <Button variant="primary" disabled={!may || !start.request || run.isPending} onClick={() => start.request && run.mutate(start.request)} data-trial-start="">
          {run.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {t('trials.form.start')}
        </Button>
      </div>
      {run.isError && <ErrorBanner title={t('trials.form.refusedTitle')} message={apiErrorMessage(run.error, t('trials.form.refused'))} />}
      {run.data && <Started trial={run.data} />}
      <p className="text-xs text-muted-foreground">{t('trials.form.note')}</p>
    </section>
  )
}

function Started({ trial }: { trial: TrialReply }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <p className="rounded-md border border-primary/30 bg-primary-050 px-3 py-2 text-xs text-primary-800" role="status" data-trial-started={trial.trialId}>
      {trial.repeat
        ? t('trials.form.fromKept')
        : trial.state === 'WAITING'
          ? t('trials.form.waiting', { count: trial.ahead ?? 0, ahead: fsi(trial.ahead ?? 0) })
          : t('trials.form.started')}
    </p>
  )
}

function TrialsList({ list, shownId, onShow }: { list: ReturnType<typeof trialsList>; shownId: string | null; onShow: (id: string) => void }) {
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
            {list.rows.map((r) => (
              <tr
                key={r.trialId}
                className={`border-b border-border/60 ${r.trialId === shownId ? 'bg-muted/60' : ''}`}
                data-trial={r.trialId}
                data-trial-state={r.state}
              >
                <td className={TD}>
                  <bdi>{r.name}</bdi> <span className="text-muted-foreground">{t('trials.version', { version: fsi(r.version) })}</span>
                  {r.trialSet && <span className={`${PILL} ms-1 border-attention-border bg-attention-050 text-attention-800`}>{t('trials.trialSet')}</span>}
                </td>
                <td className={TD}>
                  <Ltr>{formatRange(day(r.from), day(r.to))}</Ltr>
                </td>
                <td className={TD}>
                  <span className={STATE_PILL[r.state]}>
                    {r.state === 'WAITING' && r.ahead != null ? t('trials.states.WAITING_AHEAD', { count: r.ahead, ahead: fsi(r.ahead) }) : t(`trials.states.${r.state}`)}
                  </span>
                </td>
                <td className={TD}>
                  <bdi>{r.startedBy}</bdi> <Ltr>{r.addedAt}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <Ltr>{countText(r.solved)}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <Ltr>{countText(r.refused)}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <Ltr>{countText(r.failed)}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <Button variant="secondary" onClick={() => onShow(r.trialId)} aria-pressed={r.trialId === shownId} data-trial-show="">
                    {t('trials.show')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TrialResultCard({
  trial,
  trials,
  onBeside,
}: {
  trial: TrialListRow
  trials: TrialReply[]
  onBeside: (row: TrialListRow, against: TrialReply) => void
}) {
  const { t } = useTranslation('sourcing-results')
  const may = canSaveWeightSets(usePermissions())
  const tryCandidate = useStartTrial()
  const r = trialResult(trial)
  const setName = t('filters.set', { name: fsi(trial.name), version: fsi(trial.version) })
  const candidate = candidateTrialFor(trial, trials)
  return (
    <section className="flex flex-col gap-4 rounded-md border border-border p-3" data-trial-result={trial.trialId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          <Trans t={t} i18nKey="trials.result.title" values={{ set: setName }} components={{ set: <bdi />, period: <Fig value={formatRange(day(trial.from), day(trial.to))} /> }} />
        </h3>
        {trial.canOpenBeside && candidate && (
          <Button variant="primary" onClick={() => onBeside(trial, candidate)} data-trial-result-beside="">
            {t('trials.openBeside')}
          </Button>
        )}
      </div>
      {trial.canOpenBeside && !candidate && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-trial-no-candidate="">
          {t('trials.result.noCandidateTrial', { set: t('filters.set', { name: fsi(trial.besideCandidate), version: fsi(trial.besideCandidateVersion) }) })}
          <Button
            variant="secondary"
            disabled={!may || tryCandidate.isPending}
            onClick={() => tryCandidate.mutate({ name: trial.besideCandidate, version: trial.besideCandidateVersion, from: trial.from, to: trial.to })}
            data-trial-try-candidate=""
          >
            {t('trials.result.tryCandidate')}
          </Button>
          {tryCandidate.isError && <ErrorBanner message={apiErrorMessage(tryCandidate.error, t('trials.form.refused'))} />}
          {tryCandidate.data && <Started trial={tryCandidate.data} />}
        </div>
      )}
      {trial.trialSet && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-trial-set-banner="">
          {t('trials.result.trialSetBanner')}
        </p>
      )}
      {!r.done && <p className="text-xs text-muted-foreground">{t(`trials.result.notDone.${trial.state}`)}</p>}
      {trial.error && (
        <p className="text-xs text-attention-800" data-trial-error="">
          <bdi>{trial.error}</bdi>
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-6" data-trial-counts="">
        {(
          [
            ['orders', r.orders],
            ['solved', r.solved],
            ['refused', r.refusedTotal],
            ['noPlan', r.noPlan],
            ['notEnded', r.notEnded],
            ['failed', r.failed],
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
      {r.asStored > 0 && (
        <p className="text-xs text-muted-foreground" data-trial-as-stored="">
          <Trans t={t} i18nKey="trials.result.asStored" components={{ n: <Fig value={countText(r.asStored)} /> }} />
        </p>
      )}
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
                <span>{t(`trials.refusals.${x.reason}`, { defaultValue: fsi(x.reason) })}</span>
                <b>
                  <Ltr>{countText(x.count)}</Ltr>
                </b>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">{t('trials.result.refusedNote')}</p>
      </div>
      {r.done && <FactorTableSection trial={trial} />}
    </section>
  )
}

function FactorTableSection({ trial }: { trial: TrialReply }) {
  const { t } = useTranslation('sourcing-results')
  const may = canSaveWeightSets(usePermissions())
  const queryClient = useQueryClient()
  const key = ['sourcing-results', 'factor-table', trial.trialId]
  const factors = useQuery({ queryKey: key, queryFn: () => sourcingResultsApi.factorTable(trial.trialId), retry: false })
  const start = useMutation({
    mutationFn: () => sourcingResultsApi.startFactorTable({ name: trial.name, version: trial.version, from: trial.from, to: trial.to }),
    onSuccess: (reply) => queryClient.setQueryData(key, reply),
  })
  const table = factors.data ? factorTable(factors.data) : null

  return (
    <div className="flex flex-col gap-2" data-factor-table="">
      <h4 className="inline-flex items-center gap-1.5 text-xs font-semibold">
        <Rows3 className="h-3.5 w-3.5" aria-hidden />
        {t('trials.factors.title')}
      </h4>
      <p className="text-xs text-muted-foreground">{t('trials.factors.lede')}</p>
      {factors.isError ? (
        <ErrorBanner title={t('trials.factors.failedTitle')} message={apiErrorMessage(factors.error, t('trials.factors.failed'))} />
      ) : !table ? (
        <p className="text-xs text-muted-foreground" role="status">
          {t('trials.factors.loading')}
        </p>
      ) : !table.started ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-factor-state="NOT_STARTED">
          {t('trials.factors.notStarted')}
          <Button variant="secondary" disabled={!may || start.isPending} onClick={() => start.mutate()} data-factor-start="">
            {t('trials.factors.start')}
          </Button>
          {start.isError && <ErrorBanner message={apiErrorMessage(start.error, t('trials.factors.failed'))} />}
        </div>
      ) : (
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
                <tr key={row.factor} className={`border-b border-border/60 ${row.changesNone ? 'text-muted-foreground' : ''}`} data-factor={row.factor} data-factor-state={row.state}>
                  <td className={TD}>{t(`trials.factors.names.${row.factor}`, { defaultValue: fsi(row.factor) })}</td>
                  <td className={`${TD} text-end`}>
                    {row.state !== 'DONE' ? (
                      <span>{t(`trials.factors.states.${row.state || 'NOT_STARTED'}`)}</span>
                    ) : row.changesNone ? (
                      <span data-factor-none="">{t('trials.factors.none')}</span>
                    ) : (
                      <>
                        <b>
                          <Ltr>{countText(row.changed)}</Ltr>
                        </b>{' '}
                        (<Ltr>{percentText(row.share)}</Ltr>)
                      </>
                    )}
                  </td>
                  <td className={`${TD} whitespace-normal`}>
                    {row.kinds.map((k) => (
                      <span key={k.kind} className="me-3 inline-flex gap-1">
                        {t(`classes.${k.kind}`, { defaultValue: fsi(k.kind) })} <Ltr>{countText(k.count)}</Ltr>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
