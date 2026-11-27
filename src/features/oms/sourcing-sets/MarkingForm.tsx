import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, CircleSlash, FlaskConical, Loader2, Stamp, XCircle } from 'lucide-react'
import { ApiError, apiErrorMessage, isBareDenial } from '@/core/api'
import type { WeightSetVersionRef } from '@/core/models/sourcing-run'
import type { CandidateLogEntry, MarkingCheck, MarkingShelfFigure } from '@/core/models/sourcing-sets'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { TD, TH } from '@/core/ui/sheet-table'
import Textarea from '@/core/ui/Textarea'
import { formatCount, formatRange, fsi } from '@/core/util/bidi'
import { markingQuery, setsQuery, sourcingSetsApi } from './api'
import { markingView, markRequest, markState, refusalLines, type MarkingView } from './marking-model'
import { CARD, CellName, count, CountList, H2, NS, pct, PromiseTable, ReadingBadge, SetRef, useSetLabel } from './parts'

const refKey = (r: WeightSetVersionRef) => `${r.name}|${r.version}`

/**
 * The marking screen (ticket 967; spec 4354 §10, §18; BO 4360, 4395), under the marking grant — the owner's variant A:
 * one long form read top to bottom. The four checks first, and Mark stays off while one fails, the refusal saying why;
 * then the trial's figures; every shelf chance figure that differs with "enough", "too few" or "not steady"; and ONE
 * written reason with a tick for each "too few" or "not steady" figure it speaks to. The server checks again at the
 * mark: a refusal there shows its reasons too.
 */
export default function MarkingForm({ target, onPick }: { target: WeightSetVersionRef | null; onPick: (ref: WeightSetVersionRef | null) => void }) {
  const { t } = useTranslation(NS)
  const label = useSetLabel()
  const sets = useQuery(setsQuery())
  const marking = useQuery(markingQuery(target))
  const [marked, setMarked] = useState<CandidateLogEntry | null>(null)

  // Every version that may be offered: not a retired set's, not the candidate set itself.
  const options = (sets.data ?? [])
    .filter((s) => !s.retired)
    .flatMap((s) => s.versions.filter((v) => v !== s.candidateVersion).map((v) => ({ name: s.name, version: v })))

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
      ) : marking.isError ? (
        <ErrorBanner title={t('mark.failedTitle')} message={apiErrorMessage(marking.error, t('mark.failed'))} />
      ) : !marking.data ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('mark.loading')}
        </p>
      ) : (
        <Form
          key={refKey(target)}
          view={markingView(marking.data)}
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
  const [ticked, setTicked] = useState<string[]>([])
  const state = markState(view, reason, ticked)
  const mark = useMutation({
    mutationFn: sourcingSetsApi.mark,
    onSuccess: (entry) => {
      onMarked(entry)
      void queryClient.invalidateQueries({ queryKey: ['sourcing-sets'] })
    },
  })
  const submit = () => {
    const body = markRequest(view, reason, ticked)
    if (body) mark.mutate(body)
  }
  const toggle = (key: string) => setTicked((x) => (x.includes(key) ? x.filter((k) => k !== key) : [...x, key]))

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
              {view.trialSet && <li data-refusal="TRIAL_SET">{t('why.TRIAL_SET')}</li>}
              {view.refusals.map((r) => (
                <li key={`${r.check}-${r.code}`} data-refusal={r.code}>
                  <Why code={r.code} figure={r.figure} />
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
        {view.lastCandidate && (
          <p className="mt-2 text-xs text-muted-foreground" data-mark-last="">
            {t('mark.lastCandidate', {
              until: fsi(view.lastCandidate.until),
              days: fsi(view.lastCandidate.daysAgo),
            })}
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
            data-mark-reason-text=""
          />
        </Field>
        {view.mustSpeakTo.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {view.mustSpeakTo.map((f) => (
              <li key={f.key}>
                <label className="inline-flex flex-wrap items-center gap-2 text-sm">
                  <input type="checkbox" disabled={!view.checksPass} checked={ticked.includes(f.key)} onChange={() => toggle(f.key)} data-speaks-to={f.key} />
                  {t('mark.speaksTo')} <CellName cell={f} /> <ReadingBadge reading={f.reading} />
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

/** One reason a marking is refused, in the screen's words, its figure isolated; a code it does not know as sent. */
function Why({ code, figure }: { code: string; figure: string | null }) {
  const { t, i18n } = useTranslation(NS)
  if (!i18n.exists(`${NS}:why.${code}`))
    return (
      <span>
        {t('why.unknown')} <Ltr>{figure ? `${code} ${figure}` : code}</Ltr>
      </span>
    )
  if (figure && i18n.exists(`${NS}:whyFigure.${code}`)) return <span>{t(`whyFigure.${code}`, { figure: fsi(figure) })}</span>
  return <span>{t(`why.${code}`)}</span>
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
        {!c.passed &&
          c.why.map((w) => (
            <p key={w.code} className="text-xs text-danger-800">
              <Why code={w.code} figure={w.figure ?? null} />
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
          period: fsi(formatRange(trial.period.from, trial.period.to)),
          days: fsi(trial.days),
          ago: fsi(trial.endedDaysAgo),
          orders: fsi(count(trial.orders)),
        })}
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.7fr)]">
        <section className={CARD} data-mark-plans-changed="">
          <h3 className={H2}>{t('mark.plansChanged')}</h3>
          <p className="mt-1 text-2xl font-semibold">
            <Ltr>{pct(trial.plansChanged.percent)}</Ltr>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('mark.plansOf', {
              share: fsi(formatCount(count(trial.plansChanged.count), count(trial.plansChanged.of))),
            })}
          </p>
          <CountList
            rows={trial.kinds.map((k) => ({
              key: k.kind,
              label: t(`kind.${k.kind}`),
              count: k.count,
            }))}
          />
        </section>
        <section className={CARD} data-mark-refused-orders="">
          <h3 className={H2}>{t('mark.refused')}</h3>
          <p className="mt-1 text-2xl font-semibold">
            <Ltr>{pct(trial.refused.percent)}</Ltr>
          </p>
          <p className="text-xs text-muted-foreground">
            {t('mark.refusedOf', {
              share: fsi(formatCount(count(trial.refused.count), count(trial.refused.of))),
            })}
          </p>
          <CountList
            rows={trial.refusedBy.map((r) => ({
              key: r.reason,
              label: t(`refusal.${r.reason}`),
              count: r.count,
            }))}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t('mark.stopFindings', { n: fsi(trial.stopFindings) })}</p>
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

function ShelfFigures({ shelf }: { shelf: readonly MarkingShelfFigure[] }) {
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
                <th className={`${TH} text-end`}>{t('shelf.candidate')}</th>
                <th className={`${TH} text-end`}>{t('shelf.version')}</th>
                <th className={TH}>{t('shelf.reading')}</th>
                <th className={`${TH} text-end`}>{t('shelf.lines')}</th>
                <th className={`${TH} text-end`}>{t('shelf.failed')}</th>
                <th className={`${TH} text-end`}>{t('shelf.expected')}</th>
                <th className={`${TH} text-end`}>{t('shelf.firstHalf')}</th>
                <th className={`${TH} text-end`}>{t('shelf.secondHalf')}</th>
              </tr>
            </thead>
            <tbody>
              {shelf.map((f) => (
                <tr key={f.key} className="border-b border-border" data-shelf-row={f.key}>
                  <td className={TD}>
                    <CellName cell={f} />
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{`${f.from.toFixed(2)}%`}</Ltr>
                  </td>
                  <td className={`${TD} text-end font-semibold`}>
                    <Ltr>{`${f.to.toFixed(2)}%`}</Ltr>
                  </td>
                  <td className={TD}>
                    <ReadingBadge reading={f.reading} />
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{count(f.lines)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{count(f.failed)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{count(f.expectedFailed)}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{pct(f.halves[0])}</Ltr>
                  </td>
                  <td className={`${TD} text-end`}>
                    <Ltr>{pct(f.halves[1])}</Ltr>
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

/** The mark door's refusal: each reason in the screen's words; a bare 403 is the grant filter, said in our words. */
function MarkRefusal({ err }: { err: unknown }) {
  const { t } = useTranslation(NS)
  if (isBareDenial(err)) return <ErrorBanner className="mt-3" title={t('mark.serverRefusedTitle')} message={t('mark.denied')} />
  const lines = refusalLines(err instanceof ApiError ? err.details : [])
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
                {l.known ? (
                  <Why code={l.code} figure={null} />
                ) : (
                  <>
                    <bdi>{l.message}</bdi> <Ltr>{l.code}</Ltr>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </ErrorBanner>
    </div>
  )
}
