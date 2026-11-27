import { useState } from 'react'
import { useNavigate } from 'react-router'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Loader2, PlayCircle } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import {
  BAR_CHANNEL_GROUPS,
  BAR_ORDER_MARKS,
  BAR_SPLIT_MARKS,
  BAR_STEPS,
  type BarChannelGroup,
  type BarCloseRequest,
  type BarMark,
  type BarQuery,
  type BarReadOnly,
  type BarStep,
  type MinutesSpread,
} from '@/core/models/sourcing-results'
import { usePermissions } from '@/core/permissions'
import { canMarkCandidateSet, canOpenStoredRun } from '@/core/sourcing-advisor/access'
import { simulatorRunPath } from '@/core/sourcing-advisor/simulator-path'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatCount, formatParts, formatRange, fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import { barPeriodEnd, barReading, type BarLargestGroup, type BarLimitView, type BarReadingView, type BarRulingItem } from './bar-model'
import { barKey } from './ChecksTab'
import { Word } from './codes'
import { estimateWords } from './estimate-words'
import Fig from './Fig'
import type { ResultsTabProps } from './ResultsTabs'
import { countText, percentText } from './text'

const PILL = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap'
const STATE_PILL: Record<BarLimitView['state'], string> = {
  MET: `${PILL} border-primary/30 bg-primary-050 text-primary-800`,
  NOT_MET: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  CANNOT_READ_YET: `${PILL} border-dashed border-border bg-muted text-muted-foreground`,
}

/** A wire time (`yyyy-MM-dd HH:mm:ss`) as its date. */
const day = (time: string) => time.slice(0, 10)

/** A figure of a limit, as sent: a share where its name says so, else a count or a plain number; none is a dash. */
function figureText(name: string, value: number | null): string | null {
  if (value == null) return null
  if (/percent$/i.test(name)) return percentText(value)
  return Number.isInteger(value) ? countText(value) : String(value)
}

/**
 * The Phase 2 bar tab (ticket 973, spec 4354 §18, BO 4283 decisions 26–36; BO 4396 `Results/Phase2Bar`): its own picker
 * for 28 whole local days, a channel group and a step (the stores only, then the whole plan); each limit in words with
 * its figures and "met", "not met" or "cannot be read yet" with why; the period's causes; the things read that are no
 * limit, apart; the 30 largest differences each way in each view to open and mark; the rulings to write; the split
 * check; and "accept this reading", which keeps it. The server reads the bar; the owner judges.
 *
 * Marks, rulings, the split check and the accepted reading are written under the candidate-mark grant
 * (`[SourcingCandidateSet, 03]`, BO 4396 `Close` and `Accept`). No green and no red.
 */
export default function BarTab(_props: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const [from, setFrom] = useState<string | undefined>(undefined)
  const [channelGroup, setChannelGroup] = useState<BarChannelGroup>('APP_SITE')
  const [step, setStep] = useState<BarStep>('STORES_ONLY')
  const query: BarQuery = { from, channelGroup, step }
  const bar = useQuery({ queryKey: barKey(query), queryFn: () => sourcingResultsApi.bar(query), placeholderData: keepPreviousData, retry: false })
  const data = bar.data
  const shownFrom = from ?? (data ? day(data.reading.from) : '')

  return (
    <div className="flex flex-col gap-4" data-bar="">
      <p className="max-w-[90ch] text-xs text-muted-foreground">{t('bar.lede')}</p>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-md border border-border/60 bg-card/40 p-3" data-bar-picker="">
        <Field label={t('bar.picker.from')}>
          <Input type="date" value={shownFrom} onChange={(e) => setFrom(e.target.value || undefined)} className="w-44" data-bar-from="" />
        </Field>
        <p className="pb-1.5 text-xs text-muted-foreground" data-bar-period="">
          {shownFrom && <Trans t={t} i18nKey="bar.picker.period" components={{ range: <Fig value={formatRange(shownFrom, barPeriodEnd(shownFrom))} /> }} />}
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
          <span className="text-xs font-medium">{t('bar.picker.step')}</span>
          <div className="flex gap-1" role="group" aria-label={t('bar.picker.step')}>
            {BAR_STEPS.map((s) => (
              <Chip key={s} on={step === s} onClick={() => setStep(s)} data-bar-step={s}>
                {t(`bar.picker.steps.${s}`)}
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
          <Reading
            reading={barReading(data)}
            asked={{ from: day(data.reading.from), channelGroup: data.reading.channelGroup, step: data.reading.step }}
            candidate={data.reading.candidateName ? t('filters.set', { name: fsi(data.reading.candidateName), version: fsi(data.reading.candidateVersion ?? '') }) : null}
          />
        </div>
      )}
    </div>
  )
}

/** Writes on the bar (`Close`), then reads the bar again: `Close` answers the stores only's step whatever step is shown. */
function useClose(asked: Required<BarQuery>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Omit<BarCloseRequest, 'from' | 'channelGroup'>) =>
      sourcingResultsApi.closeOnBar({ from: asked.from, channelGroup: asked.channelGroup, ...body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sourcing-results', 'phase-2-bar'] }),
  })
}

function Reading({ reading, asked, candidate }: { reading: BarReadingView; asked: Required<BarQuery>; candidate: string | null }) {
  const { t } = useTranslation('sourcing-results')
  const may = canMarkCandidateSet(usePermissions())
  const range = formatRange(asked.from, barPeriodEnd(asked.from))

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
              cannot: <Fig bold value={countText(reading.tally.CANNOT_READ_YET)} />,
              range: <Fig value={range} />,
            }}
          />{' '}
          <span className={STATE_PILL[reading.state]} data-bar-state={reading.state}>
            {t('bar.barState', { state: t(`bar.states.${reading.state}`) })}
          </span>
        </p>
        {candidate && <span className="text-xs text-muted-foreground">{t('bar.candidate', { set: candidate })}</span>}
      </div>
      {reading.periodWhys.length > 0 && (
        <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" role="status" data-bar-period-causes="">
          <p className="font-semibold">{t('bar.periodCauses')}</p>
          <ul className="ms-4 list-disc">
            {reading.periodWhys.map((w) => (
              <li key={w.code} data-bar-cause={w.code}>
                <Word family="PHASE2_WHY" code={w.code} />
                {w.detail && (
                  <>
                    {': '}
                    <bdi>{w.detail}</bdi>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="flex flex-col divide-y divide-border/60 rounded-md border border-border" data-bar-limits="">
        {reading.limits.map((l) => (
          <Limit key={l.limit} limit={l} />
        ))}
      </ol>

      <ReadOnly read={reading.read} />
      <Largest groups={reading.largest} asked={asked} may={may} />
      <Rulings due={reading.rulings.due} written={reading.rulings.written} asked={asked} may={may} />
      <SplitCheck reading={reading} asked={asked} may={may} />
      <Accept reading={reading} asked={asked} may={may} />
      <p className="text-xs text-muted-foreground" data-bar-ruled-on="">
        <Trans t={t} i18nKey="bar.ruledOn" components={{ at: <Fig value={day(reading.figuresRuledOn)} /> }} />
      </p>
    </>
  )
}

function Limit({ limit: l }: { limit: BarLimitView }) {
  const { t, i18n } = useTranslation('sourcing-results')
  const figureName = (name: string) => {
    const [head, measure] = name.split('.')
    if (measure) return `${t(`checks.distance.bands.${head}`, { defaultValue: fsi(head) })} ${t(`bar.figures.${measure}`, { defaultValue: fsi(measure) })}`
    return i18n.exists(`bar.figures.${name}`, { ns: 'sourcing-results' }) ? t(`bar.figures.${name}`) : fsi(name)
  }
  return (
    <li className="grid gap-2 p-3 md:grid-cols-[2rem_minmax(0,1fr)_auto]" data-bar-limit={l.limit} data-bar-state={l.state}>
      <span className="text-sm font-semibold text-muted-foreground">
        <Ltr>{l.letter}</Ltr>
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{t(`bar.limits.${l.limit}.name`)}</p>
        <p className="text-xs text-muted-foreground">{t(`bar.limits.${l.limit}.rule`)}</p>
        {l.figures.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs" data-bar-figures="">
            {l.figures.map((f) => {
              const text = figureText(f.name, f.value)
              return (
                <li key={f.name} data-bar-figure={f.name}>
                  {figureName(f.name)}: {text == null ? <span className="text-muted-foreground">{t('dash')}</span> : <Ltr>{text}</Ltr>}
                </li>
              )
            })}
          </ul>
        )}
        {l.why.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs" data-bar-why="">
            {l.why.map((w) => (
              <li key={w} data-bar-why-code={w}>
                {w === 'UNSAID' || w === 'UNSENT' ? t(`bar.why.${w}`) : <Word family="PHASE2_WHY" code={w} />}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className={`${STATE_PILL[l.state]} self-start`} data-bar-pill="">
        {t(`bar.states.${l.state}`)}
      </span>
    </li>
  )
}

function Spread({ spread }: { spread: MinutesSpread | undefined }) {
  const { t } = useTranslation('sourcing-results')
  if (!spread) return <span className="text-muted-foreground">{t('dash')}</span>
  return (
    <>
      {estimateWords(t, spread.middle)} <span className="text-muted-foreground">(<Ltr>{formatRange(String(spread.low), String(spread.high))}</Ltr>)</span>
    </>
  )
}

function ReadOnly({ read }: { read: BarReadOnly }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <section className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3" data-bar-readings="">
      <h3 className="text-sm font-semibold">{t('bar.readingsTitle')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.readingsLede')}</p>
      <ul className="grid gap-2 text-xs sm:grid-cols-2">
        <li data-bar-reading="SAME_PLAN">
          <Trans
            t={t}
            i18nKey="bar.read.samePlan"
            components={{
              b: <b />,
              orders: <Fig value={countText(read.ordersCompared)} />,
              whole: <Fig value={percentText(read.samePlanWhole)} />,
              stores: <Fig value={percentText(read.sameStores)} />,
            }}
          />
        </li>
        <li data-bar-reading="ESTIMATES">
          <b>{t('bar.read.estimates')}</b> {t('views.WHOLE_PLAN')} <Spread spread={read.wholeEstimate} />; {t('views.STORES_ONLY')}{' '}
          <Spread spread={read.storesEstimate} />
        </li>
        <li data-bar-reading="MADE_BY">
          <b>{t('bar.read.madeBy')}</b>
          {read.byMadeBy.map((m) => (
            <span key={m.madeBy} className="ms-2 inline-flex gap-1">
              {t(`breakdowns.madeBy.${m.madeBy}`, { defaultValue: fsi(m.madeBy) })}: <Ltr>{countText(m.orders)}</Ltr>,{' '}
              <Ltr>{formatParts([percentText(m.samePlanWhole), percentText(m.sameStores)])}</Ltr>
            </span>
          ))}
        </li>
        <li data-bar-reading="FLEET_RATIO">
          <b>{t('bar.read.fleetRatio')}</b>
          {read.fleetRatios.map((f) => (
            <span key={f.mode} className="ms-2 inline-flex gap-1">
              {t(`modes.${f.mode}`)} <Ltr>{f.ratio == null ? t('dash') : f.ratio.toFixed(2)}</Ltr>
            </span>
          ))}
        </li>
        <li data-bar-reading="LATER_SLOTS">
          <Trans
            t={t}
            i18nKey="bar.read.laterSlots"
            components={{ b: <b />, n: <Ltr>{formatCount(countText(read.laterSlotCheaper), countText(read.ordersWithSlot))}</Ltr> }}
          />
        </li>
      </ul>
    </section>
  )
}

/**
 * Opens an order's stored run in the simulator. The bar names the order, not its run: the run is read off the order's
 * card (`Results/Order`, which carries it), under the run grant only — the results page opens under the view grant.
 */
function useOpenRun() {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: (orderNumber: string) => sourcingResultsApi.order(orderNumber),
    onSuccess: (card) => card.runId && navigate(simulatorRunPath(card.runId)),
  })
}

function Largest({ groups, asked, may }: { groups: BarLargestGroup[]; asked: Required<BarQuery>; may: boolean }) {
  const { t } = useTranslation('sourcing-results')
  const opensRun = canOpenStoredRun(usePermissions())
  const openRun = useOpenRun()
  const [open, setOpen] = useState(0)
  const group = groups[open]
  const mark = useClose(asked)
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3" data-bar-largest="">
      <h3 className="text-sm font-semibold">{t('bar.largest.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.largest.lede')}</p>
      <div role="tablist" aria-label={t('bar.largest.title')} className="flex flex-wrap gap-1">
        {groups.map((g, i) => (
          <Chip key={`${g.view}:${g.way}`} variant="tab" on={open === i} onClick={() => setOpen(i)} data-largest-group={`${g.view}:${g.way}`}>
            {t('bar.largest.group', { view: t(`views.${g.view}`), way: t(`bar.largest.ways.${g.way}`) })}{' '}
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
                  <th className={TH}>{t('drawer.cols.order')}</th>
                  <th className={`${TH} text-end`}>{t('drawer.cols.estimate')}</th>
                  <th className={TH}>{t('bar.largest.mark')}</th>
                  <th className={TH}>{t('bar.largest.markedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => (
                  <tr key={r.orderNumber} className="border-b border-border/60" data-largest-row={r.orderNumber} data-largest-mark={r.mark ?? ''}>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-2">
                        <Ltr>{r.orderNumber}</Ltr>
                        {/* Review 4354 #4: only once the simulator reads the stored run, and only under the run grant. */}
                        {opensRun && (
                          <Button
                            variant="secondary"
                            disabled={openRun.isPending}
                            onClick={() => openRun.mutate(r.orderNumber)}
                            aria-label={t('bar.largest.openLabel', { order: fsi(r.orderNumber) })}
                            data-largest-open=""
                          >
                            <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        )}
                      </span>
                    </td>
                    <td className={`${TD} text-end`}>{estimateWords(t, r.estimate)}</td>
                    <td className={TD}>
                      <Select
                        value={r.mark ?? ''}
                        disabled={!may || mark.isPending}
                        onChange={(e) => e.target.value && mark.mutate({ kind: 'ORDER', key: r.orderNumber, mark: e.target.value as BarMark, text: '' })}
                        className="w-48"
                        aria-label={t('bar.largest.markLabel', { order: fsi(r.orderNumber) })}
                        data-largest-select=""
                      >
                        <option value="">{t('bar.largest.notMarked')}</option>
                        {BAR_ORDER_MARKS.map((m) => (
                          <option key={m} value={m}>
                            {t(`bar.marks.${m}`)}
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
      {openRun.isError && <ErrorBanner message={apiErrorMessage(openRun.error, t('card.failed'))} />}
    </section>
  )
}

function RulingSubject({ item }: { item: BarRulingItem }) {
  const { t } = useTranslation('sourcing-results')
  const [a, b] = item.parts
  return (
    <>
      <span className="text-muted-foreground">{t(`bar.rulings.subjects.${item.kind}`)}</span>{' '}
      {item.kind === 'OUTSIDE_REASON' ? (
        <b>
          <Word family="PIN" code={a} />
          {b && (
            <>
              {': '}
              <Word k={`outsideRules.steps.${b}`} family="FILTER" code={b} />
            </>
          )}
        </b>
      ) : (
        <b>
          {t(`modes.${a}`, { defaultValue: fsi(a) })}, <Word k={`stockClasses.${b}`} family="STOCK_CLASS" code={b} />
        </b>
      )}
      {item.percent != null && (
        <>
          {' '}
          (<Ltr>{percentText(item.percent)}</Ltr>)
        </>
      )}
    </>
  )
}

function Rulings({ due, written, asked, may }: { due: BarRulingItem[]; written: BarRulingItem[]; asked: Required<BarQuery>; may: boolean }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <section className="flex flex-col gap-3 rounded-md border border-border p-3" data-bar-rulings="">
      <h3 className="text-sm font-semibold">{t('bar.rulings.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.rulings.lede')}</p>
      {due.length === 0 && <p className="text-xs text-muted-foreground">{t('bar.rulings.noneDue')}</p>}
      {due.map((r) => (
        <RulingForm key={`${r.kind}:${r.key}`} item={r} asked={asked} may={may} />
      ))}
      {written.length > 0 && (
        <ul className="flex flex-col gap-2 text-xs" data-bar-rulings-written="">
          {written.map((r) => (
            <li key={`${r.kind}:${r.key}`} className="border-s-2 border-border ps-2" data-bar-ruling-written={r.key}>
              <p>
                <RulingSubject item={r} />
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

function RulingForm({ item, asked, may }: { item: BarRulingItem; asked: Required<BarQuery>; may: boolean }) {
  const { t } = useTranslation('sourcing-results')
  const [text, setText] = useState('')
  const save = useClose(asked)
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-muted/40 p-2" data-bar-ruling-due={item.key}>
      <p className="text-xs">
        <RulingSubject item={item} />
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
        <Button
          variant="secondary"
          disabled={!may || !text.trim() || save.isPending}
          onClick={() => save.mutate({ kind: item.kind, key: item.key, mark: 'RULED', text: text.trim() })}
          data-bar-ruling-save=""
        >
          {t('bar.rulings.save')}
        </Button>
      </div>
      {save.isError && <ErrorBanner message={apiErrorMessage(save.error, t('bar.rulings.failed'))} />}
    </div>
  )
}

/** Limit f: the split check's result on the period, written by a person (BO 4396 `Close` kind `SPLIT_CHECK`). */
function SplitCheck({ reading, asked, may }: { reading: BarReadingView; asked: Required<BarQuery>; may: boolean }) {
  const { t } = useTranslation('sourcing-results')
  const [mark, setMark] = useState<BarMark | ''>('')
  const [text, setText] = useState('')
  const save = useClose(asked)
  const done = reading.splitCheck
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3" data-bar-split="">
      <h3 className="text-sm font-semibold">{t('bar.split.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.split.lede')}</p>
      {done && (
        <p className="text-xs" data-bar-split-done={done.mark}>
          <b>{t(`bar.marks.${done.mark}`)}</b> <bdi>{done.text}</bdi> <span className="text-muted-foreground">
            <bdi>{done.by}</bdi> <Ltr>{done.at}</Ltr>
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t('bar.split.result')}>
          <Select value={mark} onChange={(e) => setMark(e.target.value as BarMark | '')} disabled={!may} className="w-56" data-bar-split-mark="">
            <option value="">{t('bar.split.choose')}</option>
            {BAR_SPLIT_MARKS.map((m) => (
              <option key={m} value={m}>
                {t(`bar.marks.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="min-w-64 flex-1">
          <Field label={t('bar.split.text')}>
            <Input value={text} onChange={(e) => setText(e.target.value)} disabled={!may} data-bar-split-text="" />
          </Field>
        </div>
        <Button
          variant="secondary"
          disabled={!may || !mark || !text.trim() || save.isPending}
          onClick={() => mark && save.mutate({ kind: 'SPLIT_CHECK', key: '', mark, text: text.trim() })}
          data-bar-split-save=""
        >
          {t('bar.split.save')}
        </Button>
      </div>
      {save.isError && <ErrorBanner message={apiErrorMessage(save.error, t('bar.split.failed'))} />}
    </section>
  )
}

function Accept({ reading, asked, may }: { reading: BarReadingView; asked: Required<BarQuery>; may: boolean }) {
  const { t } = useTranslation('sourcing-results')
  const queryClient = useQueryClient()
  const [note, setNote] = useState('')
  const accept = useMutation({
    mutationFn: () => sourcingResultsApi.acceptBar({ ...asked, note: note.trim() }),
    onSuccess: () => {
      setNote('')
      return queryClient.invalidateQueries({ queryKey: ['sourcing-results', 'phase-2-bar'] })
    },
  })
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3" data-bar-accept="">
      <h3 className="text-sm font-semibold">{t('bar.accept.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('bar.accept.lede')}</p>
      <Field label={t('bar.accept.noteLabel')}>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} disabled={!may} data-bar-accept-note="" />
      </Field>
      <div>
        <Button variant="primary" disabled={!may || accept.isPending} onClick={() => accept.mutate()} data-bar-accept-button="">
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t('bar.accept.button')}
        </Button>
      </div>
      {accept.isError && <ErrorBanner message={apiErrorMessage(accept.error, t('bar.accept.failed'))} />}
      {reading.kept.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs" data-bar-kept="">
          {reading.kept.map((k) => (
            <li key={k.id} className="border-s-2 border-border ps-2" data-bar-kept-row={k.id}>
              <Trans
                t={t}
                i18nKey="bar.accept.kept"
                values={{ by: k.readBy, step: t(`bar.picker.steps.${k.step}`), state: t(k.met ? 'bar.states.MET' : 'bar.states.NOT_MET') }}
                components={{ by: <bdi />, at: <Fig value={k.readAt} /> }}
              />
              {k.note && (
                <>
                  {' '}
                  <bdi className="text-muted-foreground">{k.note}</bdi>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t('bar.accept.note')}</p>
    </section>
  )
}
