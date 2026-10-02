/* PROTOTYPE 371 · C — "Activity spine": the timeline and the feed are ONE vertical
 * spine. Time flows down; a Log row that reached a step is a milestone node, an earlier
 * pass superseded by a rewind is struck through, a rewind is an amber node; a "Now"
 * divider carries the composer; unreached steps hang below it as hollow future nodes.
 * Facts are a dense column at the end; the commands are a sticky bottom bar (083
 * grammar, nothing hidden: Back top-start, Cancel order bottom-end). */
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Ban, CalendarClock, Check, ChevronLeft, Flag, History, Loader2, MessageSquare, Plus, Reply, RotateCcw, Store, XCircle, Zap } from 'lucide-react'
import type { ButtonVariant } from '@/core/ui/Button'
import type { CommandKind } from '../actions'
import { feed, fmtDayTime, type FeedItem, type Step } from './derive'
import { AllStatuses, Cmd, Composer, ConditionsGrid, DueTag, FactList, ItemsGrid, JobBanners, NowBadge, SubIds, Tags, useFacts, type VariantProps } from './parts'

export const NAME = 'Activity spine — timeline + feed as one, facts beside, sticky command bar'

const STEP_CODES: Record<string, string[]> = {
  created: ['DCRT'], ready: ['DRDY', 'DTXC'], out: ['DOFD'], delivered: ['DDLR'],
  requested: ['DRCL'], cancelled: ['DCLS', 'DFCL', 'DCNI', 'DCAD'],
}
const REWIND = ['DRBK', 'DRSC', 'DCHC']
const ICON: Record<CommandKind, typeof Plus> = {
  reschedule: CalendarClock, 'change-store': Store, 'request-close': Flag, 'cancel-close-request': Flag,
  'add-note': Plus, 'return-document': Reply, 'force-close': XCircle, close: Ban,
}
const CLUSTER: Record<string, ButtonVariant> = { fulfilment: 'fulfilment', 'cancel-request': 'cancel-request', notes: 'ghost' }
const HINT: Partial<Record<CommandKind, string>> = { reschedule: 'R', 'request-close': 'C', 'add-note': 'N' }

type Node =
  | { type: 'milestone'; item: FeedItem; step: Step }
  | { type: 'superseded'; item: FeedItem; stepLabel: string }
  | { type: 'rewind'; item: FeedItem }
  | { type: 'event'; item: FeedItem }

function spine(p: VariantProps): { past: Node[]; future: Step[] } {
  const items = feed(p.logs, p.jobs, false).concat(p.postedNotes).sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  // The LATEST log row per reached step is its milestone; earlier ones are superseded passes.
  const latestId: Record<string, string> = {}
  for (const it of items) for (const [k, codes] of Object.entries(STEP_CODES)) if (codes.includes(it.code)) latestId[k] = it.id
  const past: Node[] = items.map((item) => {
    if (REWIND.includes(item.code)) return { type: 'rewind', item }
    const k = Object.entries(STEP_CODES).find(([, codes]) => codes.includes(item.code))?.[0]
    if (!k || item.id.startsWith('j')) return { type: 'event', item }
    // Only lifecycle steps have superseded passes; a request that was then carried out is just an event.
    const lifecycle = ['created', 'ready', 'out', 'delivered'].includes(k)
    const step = p.steps.find((s) => s.key === k && ['done', 'current', 'requested', 'cancelled'].includes(s.state))
    if (step && latestId[k] === item.id) return { type: 'milestone', item, step }
    if (!lifecycle) return { type: 'event', item }
    return { type: 'superseded', item, stepLabel: p.steps.find((s) => s.key === k)?.label ?? item.title }
  })
  return { past, future: p.steps.filter((s) => s.state === 'next' || s.state === 'later') }
}

const MILESTONE: Record<string, string> = {
  done: 'border-primary bg-primary text-primary-foreground',
  current: 'border-(--cursor) bg-card text-foreground ring-4 ring-primary-050',
  requested: 'border-attention bg-attention-050 text-attention-800',
  cancelled: 'border-danger bg-danger text-primary-foreground',
}
const EVENT_ICON: Record<FeedItem['kind'], { I: typeof History; cls: string }> = {
  log: { I: History, cls: 'text-muted-foreground' },
  note: { I: MessageSquare, cls: 'text-primary' },
  'job-ok': { I: Zap, cls: 'text-success-800' },
  'job-failed': { I: AlertTriangle, cls: 'text-danger-800' },
  'job-retrying': { I: Loader2, cls: 'text-attention-800' },
  'job-queued': { I: Zap, cls: 'text-muted-foreground' },
}

function Row({ dot, children }: { dot: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="relative grid grid-cols-[28px_minmax(0,1fr)] gap-2 pb-2.5">
      <span aria-hidden className="absolute inset-y-0 start-[13px] w-0.5 bg-border" />
      <span className="relative z-[1] grid place-items-start justify-center pt-0.5">{dot}</span>
      <div className="min-w-0">{children}</div>
    </li>
  )
}
function Meta({ item }: { item: FeedItem }) {
  return (
    <span className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground">
      {item.by !== 'job' && <span className="me-2 text-ink-3">{item.by}</span>}
      {fmtDayTime(item.at)}
    </span>
  )
}

export default function VariantC(p: VariantProps) {
  const { t } = useTranslation('document')
  const { doc, bar } = p
  const facts = useFacts(doc)
  const { past, future } = useMemo(() => spine(p), [p])

  return (
    <div className="grid gap-2.5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2">
        <Link to="/oms/deliveries" aria-label={t('back')} title={`${t('back')} (Esc)`} className="grid h-7 w-7 place-items-center rounded-md border border-border hover:bg-accent">
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
        </Link>
        <span className="font-mono text-lg font-semibold">{doc.documentNo}</span>
        <NowBadge steps={p.steps} />
        <DueTag doc={doc} />
        <Tags doc={doc} />
        <SubIds doc={doc} className="basis-full ps-10 lg:basis-auto lg:ps-2" />
        <span className="ms-auto">
          <AllStatuses doc={doc} />
        </span>
      </header>

      <div className="grid items-start gap-2.5 lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]">
        {/* the spine */}
        <section aria-label="Timeline and activity" className="grid gap-2 rounded-lg border border-border bg-card p-3">
          <JobBanners jobs={p.jobs} showRetrySlot={p.showRetrySlot} />
          <ol className="mt-1">
            {past.map((n) => {
              const it = n.item
              if (n.type === 'milestone')
                return (
                  <Row key={it.id} dot={<span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${MILESTONE[n.step.state]}`}>{n.step.state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n.step.state === 'cancelled' ? <XCircle className="h-3.5 w-3.5" /> : n.step.state === 'requested' ? <Flag className="h-3 w-3" /> : null}</span>}>
                    <div className="flex items-baseline gap-2 pt-0.5">
                      <b className={'text-sm font-semibold ' + (n.step.state === 'cancelled' ? 'text-danger-800' : n.step.state === 'requested' ? 'text-attention-800' : '')}>{n.step.label}</b>
                      {n.step.state === 'current' && <span className="rounded bg-primary-050 px-1.5 text-[0.625rem] font-bold uppercase text-primary-800">now</span>}
                      {n.step.state === 'requested' && <span className="text-xs text-attention-800">final</span>}
                      <Meta item={it} />
                    </div>
                    {it.detail && <div className="text-xs text-muted-foreground">{it.detail}</div>}
                  </Row>
                )
              if (n.type === 'superseded')
                return (
                  <Row key={it.id} dot={<span className="mt-1 h-3 w-3 rounded-full border-2 border-border-strong bg-card" />}>
                    <div className="flex items-baseline gap-2 text-[0.8125rem] text-ink-3">
                      <s>{n.stepLabel}</s>
                      <span className="text-xs">earlier pass</span>
                      <Meta item={it} />
                    </div>
                  </Row>
                )
              if (n.type === 'rewind')
                return (
                  <Row key={it.id} dot={<span className="grid h-6 w-6 place-items-center rounded-full border-2 border-attention bg-attention-050 text-attention-800"><RotateCcw className="h-3 w-3" /></span>}>
                    <div className="flex items-baseline gap-2 pt-0.5">
                      <b className="text-sm font-semibold text-attention-800">{it.title}</b>
                      <Meta item={it} />
                    </div>
                    {it.detail && <div className="text-xs text-muted-foreground">{it.detail}</div>}
                  </Row>
                )
              const { I, cls } = EVENT_ICON[it.kind]
              return (
                <Row key={it.id} dot={<I className={`mt-0.5 h-3.5 w-3.5 rounded-sm bg-card ${cls}`} />}>
                  <div className="flex items-baseline gap-2 text-[0.8125rem]">
                    <span className={it.kind === 'job-failed' ? 'font-semibold text-danger-800' : ''}>{it.title}</span>
                    <Meta item={it} />
                  </div>
                  {it.detail && <div className={'text-xs ' + (it.kind === 'job-failed' ? 'text-danger-800' : 'text-muted-foreground')}>{it.detail}</div>}
                </Row>
              )
            })}
          </ol>
          <div className="relative -mx-3 border-y border-dashed border-border-strong bg-card-2 px-3 py-2">
            <span className="absolute -top-2 start-3 bg-card-2 px-1 text-[0.625rem] font-bold uppercase tracking-wider text-primary">now</span>
            <Composer p={p} autoFocusHint />
          </div>
          {future.length > 0 && (
            <ol className="mt-1">
              {future.map((s) => (
                <Row key={s.key} dot={<span className={'h-5 w-5 rounded-full border-2 bg-card ' + (s.state === 'next' ? 'border-dashed border-border-strong' : 'border-border')} />}>
                  <div className="flex items-baseline gap-2 pt-0.5 text-[0.8125rem] text-muted-foreground">
                    {s.label}
                    {s.expect && <span className="ms-auto text-xs italic">expected {s.expect}</span>}
                  </div>
                </Row>
              ))}
            </ol>
          )}
        </section>

        {/* facts + items */}
        <div className="grid min-w-0 gap-2.5">
          <section className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2 2xl:grid-cols-3">
            {facts.map((card) => (
              <div key={card.key} className="min-w-0">
                <h4 className={'mb-1 flex items-center gap-1.5 text-[0.6875rem] font-bold uppercase tracking-wider ' + (card.key === 'prescription' ? 'text-prescription' : 'text-muted-foreground')}>{card.title}</h4>
                <FactList rows={card.rows} />
              </div>
            ))}
          </section>
          <section className="rounded-lg border border-border bg-card p-3">
            <h3 className="mb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">Items · {doc.lines?.length ?? 0}</h3>
            <ItemsGrid doc={doc} />
          </section>
          <details className="rounded-lg border border-border bg-card p-3">
            <summary className="cursor-pointer text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">
              Pricing conditions · {(doc.conditions ?? []).filter((c) => c.condDocumentLine === 0).length}
            </summary>
            <div className="mt-2">
              <ConditionsGrid doc={doc} />
            </div>
          </details>
        </div>
      </div>

      {/* sticky command bar — Back is top-start, Cancel order bottom-end */}
      <section aria-label={t('command.title')} className="sticky bottom-14 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border-strong bg-card px-3 py-2 shadow-[0_10px_30px_rgb(16_24_40/.16)]">
        {bar.clusters.map((cl) => (
          <div key={cl.id} className="flex items-center gap-1.5">
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.08em] text-ink-3">{cl.label}</span>
            {cl.commands.map((c) => {
              const I = ICON[c.kind]
              return <Cmd key={c.kind} c={c} variant={CLUSTER[cl.id]} onCommand={p.onCommand} refused={p.refused} hint={HINT[c.kind]} icon={<I className="h-3.5 w-3.5" />} label={t(`actions.${c.kind}`)} />
            })}
          </div>
        ))}
        <div className="ms-auto flex gap-1.5">
          {bar.terminal.map((c) => {
            const I = ICON[c.kind]
            return <Cmd key={c.kind} c={c} variant={c.kind === 'close' ? 'danger' : 'danger-outlined'} onCommand={p.onCommand} refused={p.refused} icon={<I className="h-3.5 w-3.5" />} label={t(`actions.${c.kind}`)} />
          })}
        </div>
      </section>
    </div>
  )
}
