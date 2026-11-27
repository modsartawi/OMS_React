import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, CircleSlash, FlaskConical, Loader2, Stamp, XCircle } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { WeightSetVersionRef } from '@/core/models/sourcing-run'
import type { CandidateLogEntry, MarkRefusalReason, ShelfChanceFigure } from '@/core/models/sourcing-sets'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { TD, TH } from '@/core/ui/sheet-table'
import Textarea from '@/core/ui/Textarea'
import { formatCount, formatRange, fsi } from '@/core/util/bidi'
import { markScreenQuery, setsQuery, sourcingSetsApi } from './api'
import {
  candidateOf,
  KNOWN_REFUSALS,
  markableVersions,
  markingView,
  markRequest,
  markState,
  refusalLines,
  speaksTo,
  withFigure,
  withoutFigure,
  type MarkingCheck,
  type MarkingView,
} from './marking-model'
import { CARD, chance, count, CountList, day, EvidenceBadge, FigureLabel, H2, NS, Pct, PromiseTable, SetRef, useSetLabel } from './parts'

const refKey = (r: WeightSetVersionRef) => `${r.name}|${r.version}`

/**
 * The marking screen (ticket 967; spec 4354 §10, §18; BO 4360, 4395 `GET WeightSets/MarkScreen`), under the marking
 * grant — the owner's variant A: one long form read top to bottom. The four checks first, and Mark stays off while one
 * fails, the refusal saying why; then the trial's figures; every shelf chance figure that differs with what its
 * evidence says; and ONE written reason with a tick for each "too few" or "not steady" figure — the tick writes the
 * figure's name into the reason, which is what the server reads. The server checks again at the mark.
 */
export default function MarkingForm({ target, onPick }: { target: WeightSetVersionRef | null; onPick: (ref: WeightSetVersionRef | null) => void }) {
  const { t } = useTranslation(NS)
  const label = useSetLabel()
  const sets = useQuery(setsQuery())
  const screen = useQuery(markScreenQuery(target))
  const [marked, setMarked] = useState<CandidateLogEntry | null>(null)

  const options = markableVersions(sets.data ?? [])

  return (
    <div className="flex flex-col gap-4" data-marking="">
      <label className="inline-flex flex-wrap items-center gap-2 text-sm">
        {t('mark.pick')}
        <Select
          className="w-80"
          value={target ? refKey(target) : ''}
          onChange={(e) => {
            const o = options.find((x) => refKey(x) === e.target.value)
            setMarked(null)
            onPick(o ?? null)
          }}
          data-mark-pick=""
        >
          <option value="">{t('mark.pickNone')}</option>
          {target && !options.some((o) => refKey(o) === refKey(target)) && <option value={refKey(target)}>{label(target)}</option>}
          {options.map((o) => (
            <option key={refKey(o)} value={refKey(o)}>
              {label(o)}
            </option>
          ))}
        </Select>
      </label>

      {marked && (
        <p className="rounded-md border border-primary/40 bg-primary-050 px-3 py-2 text-sm text-primary-800" role="status" data-marked="">
          {t('mark.done', { set: label(marked.after) })}
        </p>
      )}

      {!target ? (
        <p className={`${CARD} text-sm text-muted-foreground`} data-mark-empty="">
          {t('mark.empty')}
        </p>
      ) : screen.isError ? (
        <ErrorBanner title={t('mark.failedTitle')} message={apiErrorMessage(screen.error, t('mark.failed'))} />
      ) : !screen.data ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('mark.loading')}
        </p>
      ) : (
        <Form
          key={refKey(target)}
          view={markingView(screen.data, candidateOf(sets.data ?? []))}
          onMarked={(entry) => {
            // Marked: the version is the candidate set now, so the form closes on the confirmation.
            setMarked(entry)
            onPick(null)
          }}
        />
      )}
    </div>
  )
}

function Form({ view, onMarked }: { view: MarkingView; onMarked: (entry: CandidateLogEntry) => void }) {
  const { t } = useTranslation(NS)
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const state = markState(view, reason)
  const mark = useMutation({
    mutationFn: sourcingSetsApi.mark,
    onSuccess: (entry) => {
      onMarked(entry)
      void queryClient.invalidateQueries({ queryKey: ['sourcing-sets'] })
    },
  })
  const submit = () => {
    const body = markRequest(view, reason)
    if (body) mark.mutate(body)
  }
  const toggle = (figure: string) => setReason((r) => (speaksTo(r, figure) ? withoutFigure(r, figure) : withFigure(r, figure)))

  return (
    <>
      <div className={CARD} data-mark-head="">
        <h2 className="text-base font-semibold">
          {t('mark.title')} <SetRef r={view.target} strong />
        </h2>
        {view.candidate && (
          <p className="text-sm text-muted-foreground">
            {t('mark.replaces')} <SetRef r={view.candidate} />
          </p>
        )}
        {view.trialSet && (
          <p className="mt-2 rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-mark-trial-set="">
            <FlaskConical className="me-1 inline h-3.5 w-3.5" aria-hidden />
            {t('mark.trialSetBanner')}
          </p>
        )}
      </div>

      {!view.checksPass && (
        <div data-mark-refused="">
          <ErrorBanner className="px-3 py-2" title={t('mark.refusedTitle')} message={t('mark.refusedHint')}>
            <ul className="mt-1 list-disc ps-5">
              {view.refusals.map((r) => (
                <li key={r.code} data-refusal={r.code}>
                  <Why r={r} />
                </li>
              ))}
            </ul>
          </ErrorBanner>
        </div>
      )}

      <section className={CARD} data-mark-checks="">
        <h3 className={H2}>{t('mark.checks')}</h3>
        <ul className="mt-2 flex flex-col gap-2">
          {view.checks.map((c) => (
            <CheckLine key={c.check} c={c} />
          ))}
        </ul>
        {view.candidateUntil && (
          <p className="mt-2 text-xs text-muted-foreground" data-mark-last="">
            {t('mark.lastCandidate', { until: fsi(view.candidateUntil) })}
          </p>
        )}
        {view.bar.counted && (
          <p className="mt-2 text-xs text-muted-foreground" data-mark-bar="">
            {t('mark.barRestarts', { from: fsi(day(view.bar.from ?? '')) })}
          </p>
        )}
      </section>

      {view.trial ? <TrialFigures view={view} /> : <p className="text-xs text-muted-foreground">{t('mark.noTrial')}</p>}

      <ShelfFigures shelf={view.shelf} />

      <section className={CARD} data-mark-reason="">
        <h3 className={H2}>{t('mark.reasonTitle')}</h3>
        <Field label={t('mark.reasonLabel')} hint={t('mark.reasonHint')}>
          <Textarea
            rows={4}
            className="w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={!view.checksPass}
            dir="auto"
            data-mark-reason-text=""
          />
        </Field>
        {view.mustSpeakTo.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {view.mustSpeakTo.map((f) => (
              <li key={f.figure}>
                <label className="inline-flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={!view.checksPass}
                    checked={speaksTo(reason, f.figure)}
                    onChange={() => toggle(f.figure)}
                    data-speaks-to={f.figure}
                  />
                  {t('mark.speaksTo')} <FigureLabel figure={f.figure} /> <Ltr>{f.figure}</Ltr> <EvidenceBadge evidence={f.evidence} />
                </label>
              </li>
            ))}
          </ul>
        )}

        {mark.isError && <MarkRefusal err={mark.error} />}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" disabled={!state.canMark || mark.isPending} onClick={submit} data-mark-button="">
            {mark.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Stamp className="h-3.5 w-3.5" aria-hidden />}
            {t('mark.button')}
          </Button>
          <span className="text-xs text-muted-foreground" data-mark-state={state.waitingFor ?? 'ready'}>
            {state.waitingFor === 'checks'
              ? t('state.checks')
              : t(state.waitingFor === 'reason' ? 'state.reason' : state.waitingFor === 'figures' ? 'state.figures' : 'state.ready', {
                  spoken: fsi(formatCount(state.spoken, state.of)),
                })}
          </span>
        </div>
      </section>
    </>
  )
}

/** One reason a marking is refused, in the screen's words; a code it does not know in the server's words. */
function Why({ r }: { r: MarkRefusalReason }) {
  const { t } = useTranslation(NS)
  if (KNOWN_REFUSALS.includes(r.code)) return <span>{t(`why.${r.code}`)}</span>
  return (
    <span>
      {t('why.unknown')} <bdi>{r.why}</bdi> <Ltr>{r.code}</Ltr>
    </span>
  )
}

function CheckLine({ c }: { c: MarkingCheck }) {
  const { t } = useTranslation(NS)
  const Icon = c.passed ? (c.exception ? CircleSlash : CheckCircle2) : XCircle
  return (
    <li className="flex items-start gap-2 text-sm" data-check={c.check} data-passed={c.passed}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${c.passed ? 'text-primary' : 'text-danger-800'}`} aria-hidden />
      <div>
        <p className={c.passed ? '' : 'font-medium text-danger-800'}>{t(`check.${c.check}`)}</p>
        {c.exception && <p className="text-xs text-muted-foreground">{t(`exception.${c.exception}`)}</p>}
        {c.refusals.map((r) => (
          <p key={r.code} className="text-xs text-danger-800">
            <Why r={r} />
          </p>
        ))}
      </div>
    </li>
  )
}

function TrialFigures({ view }: { view: MarkingView }) {
  const { t } = useTranslation(NS)
  const trial = view.trial!
  return (
    <>
      <p className="text-xs text-muted-foreground" data-mark-trial={trial.trialId}>
        {t('mark.trialLine', {
          trial: fsi(trial.trialId),
          period: fsi(formatRange(day(trial.from), day(trial.to))),
          days: fsi(trial.days),
          orders: fsi(count(trial.orders)),
          beside: t('setRef', { name: fsi(trial.besideCandidate), version: fsi(trial.besideCandidateVersion) }),
        })}
      </p>
      {trial.fails.length > 0 && (
        <ul className="list-disc ps-5 text-xs text-danger-800" data-mark-trial-fails="">
          {trial.fails.map((code) => (
            <li key={code}>
              <Why r={{ code, why: code }} />
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <section className={CARD} data-mark-plans-changed="">
          <h3 className={H2}>{t('mark.plansChanged')}</h3>
          {trial.candidateTrialId ? (
            <>
              <p className="mt-1 text-2xl font-semibold">
                <Pct n={trial.plansChangedShare} />
              </p>
              <p className="text-xs text-muted-foreground">
                {t('mark.plansOf', { share: fsi(formatCount(count(trial.plansChanged), count(trial.plansCompared))), beside: fsi(trial.candidateTrialId) })}
              </p>
              <CountList rows={view.changedBy} prefix="kind" />
            </>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground" data-mark-plans-unread="">
              {t('mark.plansUnread')}
            </p>
          )}
        </section>
        <section className={CARD} data-mark-refused-orders="">
          <h3 className={H2}>{t('mark.refused')}</h3>
          <p className="mt-1 text-2xl font-semibold">
            <Pct n={trial.refusedShare} />
          </p>
          <p className="text-xs text-muted-foreground">{t('mark.refusedOf', { share: fsi(formatCount(count(trial.refused), count(trial.orders))) })}</p>
          <CountList rows={view.refusedBy} prefix="refusal" />
          <p className="mt-2 text-xs text-muted-foreground">{t('mark.stopFindings', { n: fsi(trial.stopFindings) })}</p>
          <p className="text-xs text-muted-foreground" data-mark-plan-checked={trial.planChecked}>
            {t(trial.planChecked ? 'mark.planChecked' : 'mark.planNotChecked')}
          </p>
        </section>
        <section className={CARD} data-mark-promise="">
          <h3 className={H2}>{t('mark.promise')}</h3>
          <div className="mt-1">
            <PromiseTable rows={trial.promise} />
          </div>
        </section>
      </div>
    </>
  )
}

function ShelfFigures({ shelf }: { shelf: readonly ShelfChanceFigure[] }) {
  const { t } = useTranslation(NS)
  return (
    <section className={CARD} data-mark-shelf="">
      <h3 className={H2}>{t('mark.shelf')}</h3>
      <p className="text-xs text-muted-foreground">{t('mark.shelfLede')}</p>
      {shelf.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t('mark.shelfNone')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="mt-2 w-full text-xs">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className={TH}>{t('shelf.figure')}</th>
                <th className={TH}>{t('shelf.name')}</th>
                <th className={`${TH} text-end`}>{t('shelf.candidate')}</th>
                <th className={`${TH} text-end`}>{t('shelf.version')}</th>
                <th className={TH}>{t('shelf.evidence')}</th>
              </tr>
            </thead>
            <tbody>
              {shelf.map((f) => (
                <tr key={f.figure} className="border-b border-border" data-shelf-row={f.figure}>
                  <td className={TD}>
                    <FigureLabel figure={f.figure} />
                  </td>
                  <td className={TD}>
                    <Ltr>{f.figure}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>{typeof f.candidate === 'number' ? <Ltr>{chance(f.candidate)}</Ltr> : <Dash />}</td>
                  <td className={`${TD} text-end font-semibold`}>{typeof f.version === 'number' ? <Ltr>{chance(f.version)}</Ltr> : <Dash />}</td>
                  <td className={TD}>
                    <EvidenceBadge evidence={f.evidence} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Dash() {
  const { t } = useTranslation(NS)
  return <span className="text-muted-foreground">{t('dash')}</span>
}

/** The mark door's refusal: each reason in the screen's words; a bare 403 is the grant filter, said in our words. */
function MarkRefusal({ err }: { err: unknown }) {
  const { t } = useTranslation(NS)
  if (isBareDenial(err)) return <ErrorBanner className="mt-3" title={t('mark.serverRefusedTitle')} message={t('mark.denied')} />
  const lines = refusalLines(err)
  return (
    <div className="mt-3" data-mark-server-refused="">
      <ErrorBanner
        title={t('mark.serverRefusedTitle')}
        message={lines.length ? t('mark.serverRefusedHint') : apiErrorMessage(err, t('mark.serverRefusedHint'))}
      >
        {lines.length > 0 && (
          <ul className="mt-1 list-disc ps-5">
            {lines.map((l) => (
              <li key={l.code} data-server-refusal={l.code}>
                <Why r={{ code: l.code, why: l.why }} />
              </li>
            ))}
          </ul>
        )}
      </ErrorBanner>
    </div>
  )
}
