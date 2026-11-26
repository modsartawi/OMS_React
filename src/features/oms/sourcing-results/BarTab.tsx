import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import {
  BAR_CHANNEL_GROUPS,
  BAR_MARKS,
  BAR_RUNS,
  type BarChannelGroup,
  type BarFigure,
  type BarMark,
  type BarQuery,
  type BarReply,
  type BarRuling,
  type BarRuns,
} from '@/core/models/sourcing-results'
import { usePermissions } from '@/core/permissions'
import { canSaveWeightSets } from '@/core/sourcing-advisor/access'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatCount, formatRange, fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import { barPeriodEnd, barReading, type BarLargestGroup, type BarLimitView, type BarWhy } from './bar-model'
import Fig from './Fig'
import type { ResultsTabProps } from './ResultsTabs'
import { storedRunInSimulator } from './simulator-link'
import { countText, percentText } from './text'

const PILL = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap'
const STATE_PILL: Record<BarLimitView['state'], string> = {
  MET: `${PILL} border-primary/30 bg-primary-050 text-primary-800`,
  NOT_MET: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  CANNOT_READ: `${PILL} border-dashed border-border bg-muted text-muted-foreground`,
}

/** A figure as text: a share with one decimal, a count (against its whole), per thousand, a ratio, minutes. */
function useFigureText() {
  const { t } = useTranslation('sourcing-results')
  return (f: Pick<BarFigure, 'value' | 'unit' | 'of'>): string => {
    switch (f.unit) {
      case 'PERCENT':
        return percentText(f.value)
      case 'PER_THOUSAND':
        return t('bar.perThousand', { n: fsi(f.value.toFixed(1)) })
      case 'RATIO':
        return f.value.toFixed(2)
      case 'MINUTES':
        return t('bar.minutes', { n: fsi(f.value) })
      default:
        return f.of != null ? formatCount(countText(f.value), countText(f.of)) : countText(f.value)
    }
  }
}

/**
 * The Phase 2 bar tab (ticket 973, spec 4354 §18, BO 4283 decisions 31–33, BO 4396): its own picker for 28 whole local
 * days and a channel group; each limit in words with its figure and "met", "not met" or "cannot be read yet" with why;
 * the things read that are no limit, apart; the 30 largest differences each way in each view to open and mark; the
 * rulings to write; and "accept this reading", which keeps it. The page says what is met; the owner judges.
 *
 * 🚩 Built on stubs: the bar's doors (BO 4396) are not specified (`./api`). The marks, rulings and the accepted reading
 * are written under the save grant until a grant is named for them (PROVISIONAL). No green and no red.
 */
export default function BarTab(_props: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const [from, setFrom] = useState<string | undefined>(undefined)
  const [channelGroup, setChannelGroup] = useState<BarChannelGroup>('APP_SITE')
  const [runs, setRuns] = useState<BarRuns>('OMS')
  const query: BarQuery = { from, channelGroup, runs }
  const key = ['sourcing-results', 'phase-2-bar', query]
  const bar = useQuery({ queryKey: key, queryFn: () => sourcingResultsApi.bar(query), placeholderData: keepPreviousData, retry: false })
  const data = bar.data
  const shownFrom = from ?? data?.period.from ?? ''

  return (
    <div className="flex flex-col gap-4" data-bar="">
      <p className="max-w-[90ch] text-xs text-muted-foreground">{t('bar.lede')}</p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-md border border-border/60 bg-card/40 p-3" data-bar-picker="">
        <Field label={t('bar.picker.from')}>
          <Input type="date" value={shownFrom} onChange={(e) => setFrom(e.target.value || undefined)} className="w-44" data-bar-from="" />
        </Field>
        <p className="pb-1.5 text-xs text-muted-foreground" data-bar-period="">
          {shownFrom && (
            <Trans t={t} i18nKey="bar.picker.period" components={{ range: <Fig value={formatRange(shownFrom, barPeriodEnd(shownFrom))} /> }} />
          )}
        </p>
        <Field label={t('bar.picker.channel')}>
          <Select value={channelGroup} onChange={(e) => setChannelGroup(e.target.value as BarChannelGroup)} className="w-60" data-bar-channel="">
            {BAR_CHANNEL_GROUPS.map((g) => (
              <option key={g} value={g}>
                {t(`filters.channelGroups.${g}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium">{t('bar.picker.runs')}</span>
          <div className="flex gap-1" role="group" aria-label={t('bar.picker.runs')}>
            {BAR_RUNS.map((r) => (
              <Chip key={r} on={runs === r} onClick={() => setRuns(r)} data-bar-runs={r}>
                {t(`bar.picker.runsBy.${r}`)}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {bar.isError ? (
        <ErrorBanner title={t('bar.failedTitle')} message={apiErrorMessage(bar.error, t('bar.failed'))} />
      ) : !data ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('bar.loading')}
        </p>
      ) : (
        <div className={`flex flex-col gap-4 ${bar.isFetching ? 'opacity-60' : ''}`} aria-busy={bar.isFetching}>
          <Reading reply={data} query={query} queryKey={key} />
        </div>
      )}
    </div>
  )
}

function Reading({ reply, query, queryKey }: { reply: BarReply; query: BarQuery; queryKey: unknown[] }) {
  const { t, i18n } = useTranslation('sourcing-results')
  const figureText = useFigureText()
  const reading = barReading(reply)
  const may = canSaveWeightSets(usePermissions())
  const queryClient = useQueryClient()
  const keep = (next: BarReply) => queryClient.setQueryData(queryKey, next)
  const asked = { ...query, from: reply.period.from }
  const accept = useMutation({ mutationFn: () => sourcingResultsApi.acceptBar({ ...asked, to: reply.period.to }), onSuccess: keep })
  const words = (w: { en: string; ar: string }) => (i18n.language === 'ar' && w.ar) || w.en

  const whyText = (w: BarWhy, limit: BarLimitView['limit']): string => {
    switch (w.kind) {
      case 'cause':
        return t(`bar.causes.${w.cause}`)
      case 'figure':
        return t('bar.whyFigure', { part: t(`bar.parts.${limit}.${w.part}`, { defaultValue: fsi(w.part) }), value: fsi(figureText(w)) })
      case 'unsaid':
        return t('bar.whyUnsaid')
      case 'unsent':
        return t('bar.whyUnsent')
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3" data-bar-tally="">
        <p className="text-sm">
          <Trans
            t={t}
            i18nKey="bar.tally"
            components={{
              met: <Fig bold value={countText(reading.tally.MET)} />,
              notMet: <Fig bold value={countText(reading.tally.NOT_MET)} />,
              cannot: <Fig bold value={countText(reading.tally.CANNOT_READ)} />,
              range: <Fig value={formatRange(reply.period.from, reply.period.to)} />,
            }}
          />
        </p>
        {reply.candidate && (
          <span className="text-xs text-muted-foreground">
            {t('bar.candidate', { set: t('filters.set', { name: fsi(reply.candidate.name), version: fsi(reply.candidate.version) }) })}
          </span>
        )}
      </div>
      {reading.periodCauses.length > 0 && (
        <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" role="status" data-bar-period-causes="">
          <p className="font-semibold">{t('bar.periodCauses')}</p>
          <ul className="ms-4 list-disc">
            {reading.periodCauses.map((c) => (
              <li key={c} data-bar-cause={c}>
                {t(`bar.causes.${c}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col divide-y divide-border/60 rounded-md border border-border" data-bar-limits="">
        {reading.limits.map((l) => (
          <li key={l.limit} className="grid gap-2 p-3 md:grid-cols-[2rem_minmax(0,1fr)_auto]" data-bar-limit={l.limit} data-bar-state={l.state}>
            <span className="text-sm font-semibold text-muted-foreground">
              <Ltr>{l.letter}</Ltr>
            </span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t(`bar.limits.${l.limit}.name`)}</p>
              <p className="text-xs text-muted-foreground">{t(`bar.limits.${l.limit}.rule`)}</p>
              {l.figures.length > 0 && (
                <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" data-bar-figures="">
                  {l.figures.map((f) => (
                    <li key={f.part} className={f.meets === false ? 'font-semibold' : ''} data-bar-figure={f.part}>
                      {t(`bar.parts.${l.limit}.${f.part}`, { defaultValue: fsi(f.part) })}: <Ltr>{figureText(f)}</Ltr>
                      {f.unit === 'PERCENT' && f.of != null && (
                        <span className="text-muted-foreground">
                          {' '}
                          {t('bar.ofShipments', { n: fsi(countText(f.of)) })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {l.why.length > 0 && (
                <ul className="flex flex-col gap-0.5 text-xs" data-bar-why="">
                  {l.why.map((w, i) => (
                    <li key={i} data-bar-why-kind={w.kind}>
                      {whyText(w, l.limit)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <span className={`${STATE_PILL[l.state]} self-start`} data-bar-pill="">
              {t(`bar.states.${l.state}`)}
            </span>
          </li>
        ))}
      </ol>

      <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3" data-bar-readings="">
        <h3 className="text-sm font-semibold">{t('bar.readingsTitle')}</h3>
        <p className="text-xs text-muted-foreground">{t('bar.readingsLede')}</p>
        <ul className="grid gap-2 text-xs sm:grid-cols-2">
          {reading.readings.map((r) => (
            <li key={r.reading} data-bar-reading={r.reading}>
              <b>{t(`bar.readings.${r.reading}.name`)}</b>{' '}
              {r.figures.map((f) => (
                <span key={f.part} className="me-3 inline-flex gap-1">
                  {t(`bar.readings.${r.reading}.parts.${f.part}`, { defaultValue: fsi(f.part) })} <Ltr>{figureText(f)}</Ltr>
                </span>
              ))}
            </li>
          ))}
        </ul>
      </section>

      <Largest groups={reading.largest} query={asked} may={may} onSaved={keep} />
      <Rulings due={reading.rulings.due} written={reading.rulings.written} query={asked} may={may} onSaved={keep} words={words} />

      <section className="flex flex-col gap-2 rounded-md border border-border p-3" data-bar-accept="">
        <h3 className="text-sm font-semibold">{t('bar.accept.title')}</h3>
        {reading.accepted ? (
          <p className="text-sm" data-bar-accepted="">
            <Trans
              t={t}
              i18nKey="bar.accept.kept"
              values={{ by: reading.accepted.by }}
              components={{ by: <bdi />, at: <Fig value={reading.accepted.at} />, range: <Fig value={formatRange(reading.accepted.period.from, reading.accepted.period.to)} /> }}
            />
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{reading.canAccept ? t('bar.accept.can') : t('bar.accept.cannot')}</p>
            <div>
              <Button variant="primary" disabled={!may || !reading.canAccept || accept.isPending} onClick={() => accept.mutate()} data-bar-accept-button="">
                <Check className="h-3.5 w-3.5" aria-hidden />
                {t('bar.accept.button')}
              </Button>
            </div>
            {accept.isError && <ErrorBanner message={apiErrorMessage(accept.error, t('bar.accept.failed'))} />}
          </>
        )}
        <p className="text-xs text-muted-foreground">{t('bar.accept.note')}</p>
        {reading.lastChangedAt && (
          <p className="text-xs text-muted-foreground" data-bar-last-changed="">
            <Trans t={t} i18nKey="bar.lastChanged" components={{ at: <Fig value={reading.lastChangedAt} /> }} />
          </p>
        )}
      </section>
    </>
  )
}

function Largest({ groups, query, may, onSaved }: { groups: BarLargestGroup[]; query: BarQuery; may: boolean; onSaved: (r: BarReply) => void }) {
  const { t } = useTranslation('sourcing-results')
  const [open, setOpen] = useState(0)
  const group = groups[open]
  const mark = useMutation({
    mutationFn: (body: { orderNumber: string; mark: BarMark }) =>
      sourcingResultsApi.markLargest(query, { ...body, view: group.view, direction: group.direction }),
    onSuccess: onSaved,
  })
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3" data-bar-largest="">
      <h3 className="text-sm font-semibold">{t('bar.largest.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.largest.lede')}</p>
      <div role="tablist" aria-label={t('bar.largest.title')} className="flex flex-wrap gap-1">
        {groups.map((g, i) => (
          <Chip key={`${g.view}:${g.direction}`} variant="tab" on={open === i} onClick={() => setOpen(i)} data-largest-group={`${g.view}:${g.direction}`}>
            {t('bar.largest.group', { view: t(`views.${g.view}`), direction: t(`bar.largest.directions.${g.direction}`) })}{' '}
            <Ltr>{formatCount(countText(g.marked), countText(g.rows.length))}</Ltr>
          </Chip>
        ))}
      </div>
      {group && group.rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('bar.largest.none')}</p>
      ) : (
        group && (
          <div className="overflow-x-auto" role="tabpanel">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-muted-foreground">
                <tr>
                  <th className={TH}>{t('drawer.cols.orderNumber')}</th>
                  <th className={`${TH} text-end`}>{t('drawer.cols.estimateMinutes')}</th>
                  <th className={TH}>{t('bar.largest.mark')}</th>
                  <th className={TH}>{t('bar.largest.markedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={r.orderNumber} className="border-b border-border/60" data-largest-row={r.orderNumber} data-largest-mark={r.mark ?? ''}>
                    <td className={TD}>
                      <Link to={storedRunInSimulator(r.runId)} className="underline decoration-dotted underline-offset-2 hover:text-primary" data-largest-open="">
                        <Ltr>{r.orderNumber}</Ltr>
                      </Link>
                    </td>
                    <td className={`${TD} text-end`}>
                      {r.estimateMinutes > 0
                        ? t('drawer.estimate.earlier', { minutes: fsi(r.estimateMinutes) })
                        : t('drawer.estimate.later', { minutes: fsi(-r.estimateMinutes) })}
                    </td>
                    <td className={TD}>
                      <Select
                        value={r.mark ?? ''}
                        disabled={!may || mark.isPending}
                        onChange={(e) => e.target.value && mark.mutate({ orderNumber: r.orderNumber, mark: e.target.value as BarMark })}
                        className="w-48"
                        aria-label={t('bar.largest.markLabel', { order: fsi(r.orderNumber) })}
                        data-largest-select=""
                      >
                        <option value="">{t('bar.largest.notMarked')}</option>
                        {BAR_MARKS.map((m) => (
                          <option key={m} value={m}>
                            {t(`bar.largest.marks.${m}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className={TD}>
                      {r.markedBy ? (
                        <>
                          <bdi>{r.markedBy}</bdi> <Ltr>{r.markedAt ?? ''}</Ltr>
                        </>
                      ) : (
                        <span className="text-muted-foreground">{t('dash')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {mark.isError && <ErrorBanner message={apiErrorMessage(mark.error, t('bar.largest.failed'))} />}
    </section>
  )
}

function Rulings({
  due,
  written,
  query,
  may,
  onSaved,
  words,
}: {
  due: BarRuling[]
  written: BarRuling[]
  query: BarQuery
  may: boolean
  onSaved: (r: BarReply) => void
  words: (w: { en: string; ar: string }) => string
}) {
  const { t } = useTranslation('sourcing-results')
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border p-3" data-bar-rulings="">
      <h3 className="text-sm font-semibold">{t('bar.rulings.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.rulings.lede')}</p>
      {due.length === 0 && <p className="text-xs text-muted-foreground">{t('bar.rulings.noneDue')}</p>}
      {due.map((r) => (
        <RulingForm key={`${r.subject}:${r.key}`} ruling={r} query={query} may={may} onSaved={onSaved} words={words} />
      ))}
      {written.length > 0 && (
        <ul className="flex flex-col gap-2 text-xs" data-bar-rulings-written="">
          {written.map((r) => (
            <li key={`${r.subject}:${r.key}`} className="border-s-2 border-border ps-2" data-bar-ruling-written={r.key}>
              <p>
                <span className="text-muted-foreground">{t(`bar.rulings.subjects.${r.subject}`)}</span> <bdi className="font-medium">{words(r.label)}</bdi>
                {r.percent != null && (
                  <>
                    {' '}
                    (<Ltr>{percentText(r.percent)}</Ltr>)
                  </>
                )}
              </p>
              <p>
                <bdi>{r.ruling?.text}</bdi>
              </p>
              <p className="text-muted-foreground">
                <bdi>{r.ruling?.by}</bdi> <Ltr>{r.ruling?.at ?? ''}</Ltr>
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RulingForm({
  ruling,
  query,
  may,
  onSaved,
  words,
}: {
  ruling: BarRuling
  query: BarQuery
  may: boolean
  onSaved: (r: BarReply) => void
  words: (w: { en: string; ar: string }) => string
}) {
  const { t } = useTranslation('sourcing-results')
  const [text, setText] = useState('')
  const save = useMutation({
    mutationFn: () => sourcingResultsApi.writeRuling(query, { subject: ruling.subject, key: ruling.key, text: text.trim() }),
    onSuccess: onSaved,
  })
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2" data-bar-ruling-due={ruling.key}>
      <p className="text-xs">
        <span className="text-muted-foreground">{t(`bar.rulings.subjects.${ruling.subject}`)}</span> <bdi className="font-medium">{words(ruling.label)}</bdi>
        {ruling.percent != null && (
          <>
            {' '}
            (<Ltr>{percentText(ruling.percent)}</Ltr>)
          </>
        )}
      </p>
      <Field label={t('bar.rulings.text')} hideLabel>
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={!may}
          placeholder={t('bar.rulings.placeholder')}
          data-bar-ruling-text=""
        />
      </Field>
      <div>
        <Button variant="secondary" disabled={!may || !text.trim() || save.isPending} onClick={() => save.mutate()} data-bar-ruling-save="">
          {t('bar.rulings.save')}
        </Button>
      </div>
      {save.isError && <ErrorBanner message={apiErrorMessage(save.error, t('bar.rulings.failed'))} />}
    </div>
  )
}
