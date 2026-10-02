/* PROTOTYPE 371 — throwaway. Pieces the variants share. Literal copy is fine here:
 * the variants are throwaway and the winner is rewritten through t() at build. */
import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Check, CircleDot, History, Loader2, MessageSquare, RotateCcw, Send, Zap } from 'lucide-react'
import type { SdDocumentHeaderModel, SdDocumentLogModel, SdDocumentOutboxModel } from '@/core/models/sd-document'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import DetailGrid from '../DetailGrid'
import { documentColumns, deletedLineRowStyle, ITEM_ROW_SELECTION } from '../columns'
import { totalsFooterRow } from '../items'
import { railCards, statusBreakdownRows, documentProvenanceRows, bandSubIds } from '../fields'
import type { CommandBar, CommandState } from '../commands'
import type { CommandKind } from '../actions'
import { dueTag, failedJobs, feed, fmtDayTime, fmtTime, nowStep, retryingJobs, type FeedItem, type Step } from './derive'

export interface VariantProps {
  doc: SdDocumentHeaderModel
  logs: SdDocumentLogModel[] | null
  jobs: SdDocumentOutboxModel[] | null
  steps: Step[]
  bar: CommandBar
  onCommand: (kind: CommandKind) => void
  /** The command the arrival intent was refused on — variants ring it. */
  refused: CommandKind | null
  composerRef: RefObject<HTMLTextAreaElement | null>
  postedNotes: FeedItem[]
  onPostNote: (text: string) => void
  showRetrySlot: boolean
}

// ---- header bits -----------------------------------------------------------------

const STEP_BADGE: Record<string, string> = {
  current: 'bg-primary-050 text-primary-800',
  done: 'bg-success-050 text-success-800',
  requested: 'bg-attention-050 text-attention-800',
  cancelled: 'bg-danger-050 text-danger-800',
}
export function NowBadge({ steps }: { steps: Step[] }) {
  const s = nowStep(steps)
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${STEP_BADGE[s.state] ?? STEP_BADGE.current}`}>
      {s.state === 'done' ? <Check className="h-3 w-3" aria-hidden /> : <CircleDot className="h-3 w-3" aria-hidden />}
      {s.label}
    </span>
  )
}

export function DueTag({ doc }: { doc: SdDocumentHeaderModel }) {
  const d = dueTag(doc)
  return (
    <span
      className={
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ' +
        (d.paid ? 'border-success-border bg-success-050 text-success-800' : 'border-attention-border bg-attention-050 text-attention-800')
      }
    >
      {d.text}
    </span>
  )
}

export function Tags({ doc }: { doc: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  const tag = 'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider'
  return (
    <>
      {doc.isExpressDelivery && (
        <span className={`${tag} bg-gold text-gold-foreground`}>
          <Zap className="h-3 w-3" aria-hidden />
          {t('dawaaNow')}
        </span>
      )}
      {doc.approvalNumber && <span className={`${tag} bg-prescription-050 text-prescription-800`}>e-Rx</span>}
      {doc.status?.overallStatus && (
        <span className={`${tag} border border-border-strong text-muted-foreground`}>
          Overall <span className="font-mono">{doc.status.overallStatus}</span>
        </span>
      )}
    </>
  )
}

export function SubIds({ doc, className = '' }: { doc: SdDocumentHeaderModel; className?: string }) {
  const { t } = useTranslation('document')
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground ${className}`}>
      {bandSubIds(doc, t).map((r) => (
        <span key={r.key}>
          {r.label}{' '}
          <b className={'font-semibold text-foreground' + (r.isCode || r.key === 'orderNo' ? ' font-mono' : '')}>
            {r.key === 'placed' ? <Ltr>{r.value}</Ltr> : r.value}
          </b>
        </span>
      ))}
      <span>
        Document <b className="font-mono font-semibold text-foreground">{doc.documentNo}</b>
      </span>
    </div>
  )
}

export function AllStatuses({ doc }: { doc: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  const rows = doc.status ? statusBreakdownRows(doc.status, t) : []
  const prov = documentProvenanceRows(doc, t)
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none text-xs font-semibold text-primary hover:underline">
        All statuses <span className="tabular-nums">{rows.length}</span>
      </summary>
      <div className="absolute end-0 z-30 mt-1 grid w-max max-w-[24rem] gap-2 rounded-lg border border-border bg-card p-2.5 shadow-[0_10px_30px_rgb(16_24_40/.16)]">
        {[{ title: 'All statuses', rows }, { title: 'Provenance', rows: prov }].map((g) => (
          <dl key={g.title} className="grid grid-cols-[minmax(8rem,max-content)_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="col-span-2 mb-0.5 font-semibold">{g.title}</dt>
            {g.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="font-medium">{r.value || '—'}</dd>
              </div>
            ))}
          </dl>
        ))}
      </div>
    </details>
  )
}

// ---- timeline --------------------------------------------------------------------

const DOT: Record<string, string> = {
  done: 'border-primary bg-primary text-primary-foreground',
  current: 'border-(--cursor) bg-card ring-4 ring-primary-050',
  next: 'border-border-strong border-dashed bg-card',
  later: 'border-border bg-card',
  requested: 'border-attention bg-attention-050 text-attention-800',
  cancelled: 'border-danger bg-danger text-primary-foreground',
}
const LABEL_INK: Record<string, string> = {
  done: 'text-foreground',
  current: 'text-foreground font-semibold',
  next: 'text-muted-foreground',
  later: 'text-ink-3',
  requested: 'text-attention-800 font-semibold',
  cancelled: 'text-danger-800 font-semibold',
}

function StepSub({ s }: { s: Step }) {
  if (s.time) return <span className="tabular-nums">{fmtDayTime(s.time)}</span>
  if (s.expect) return <span className="italic">expected {s.expect}</span>
  if (s.state === 'requested') return <span>final — cannot be withdrawn</span>
  return null
}

/** Horizontal stepper — full width, one row. */
export function StepperH({ steps, compact = false }: { steps: Step[]; compact?: boolean }) {
  return (
    <ol className={'flex items-start ' + (compact ? 'gap-0' : 'gap-0 px-1')} aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${DOT[s.state]}`}>
              {s.state === 'done' && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
            </span>
            {i < steps.length - 1 && (
              <span
                className={
                  'mx-1 h-0.5 flex-1 rounded ' +
                  (s.state === 'done' && ['done', 'current', 'requested', 'cancelled'].includes(steps[i + 1].state)
                    ? 'bg-primary'
                    : 'bg-border')
                }
              />
            )}
          </div>
          <div className={'mt-1 pe-2 text-xs ' + LABEL_INK[s.state]}>{s.label}</div>
          <div className="pe-2 text-[0.6875rem] text-muted-foreground">
            <StepSub s={s} />
          </div>
          {s.marker && (
            <div className="mt-1 inline-flex w-fit items-center gap-1 rounded-md bg-attention-050 px-1.5 py-0.5 text-[0.6875rem] font-medium text-attention-800">
              <RotateCcw className="h-3 w-3" aria-hidden />
              {s.marker.label}
              {s.marker.time && <span className="tabular-nums opacity-80">· {fmtTime(s.marker.time)}</span>}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

// ---- jobs ------------------------------------------------------------------------

/** One banner per FAILED job, plus one quiet line per failing-but-retrying P job. */
export function JobBanners({ jobs, showRetrySlot }: { jobs: SdDocumentOutboxModel[] | null; showRetrySlot: boolean }) {
  const failed = failedJobs(jobs)
  const retrying = retryingJobs(jobs)
  if (!failed.length && !retrying.length) return null
  return (
    <div className="grid gap-1.5">
      {failed.map((j) => (
        <div
          key={j.outboxId}
          role="alert"
          className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 rounded-lg border border-danger-border bg-danger-050 px-3 py-1.5 text-[0.8125rem] text-danger-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <b className="font-semibold">{j.actionTypeDescription} failed</b>
            <span className="tabular-nums">{j.attemptCount} attempts</span>
            <span className="text-xs tabular-nums opacity-80">{fmtDayTime(j.lastAttemptTime)}</span>
            {showRetrySlot && (
              <span
                title="Reserved: Retry lands here later — grant holders only, behind a confirm (370)"
                className="ms-auto inline-flex h-6 items-center rounded-md border border-dashed border-danger-border px-2 text-xs opacity-70"
              >
                <RotateCcw className="me-1 h-3 w-3" aria-hidden />
                Retry · later
              </span>
            )}
          </div>
          <div className="col-start-2 text-xs">{j.errorMessage}</div>
        </div>
      ))}
      {retrying.map((j) => (
        <div
          key={j.outboxId}
          className="grid grid-cols-[16px_minmax(0,1fr)] gap-x-2.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[0.8125rem] text-muted-foreground"
        >
          <Loader2 className="mt-0.5 h-4 w-4 animate-spin [animation-duration:3s]" aria-hidden />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <b className="font-semibold text-foreground">{j.actionTypeDescription}</b>
            <span>failing, retrying automatically · attempt {j.attemptCount} · next {fmtTime(j.nextAttemptTime)}</span>
          </div>
          <div className="col-start-2 text-xs text-ink-3">{j.errorMessage}</div>
        </div>
      ))}
    </div>
  )
}

// ---- feed ------------------------------------------------------------------------

const FEED_ICON: Record<FeedItem['kind'], { icon: typeof History; cls: string }> = {
  log: { icon: History, cls: 'bg-muted text-muted-foreground' },
  note: { icon: MessageSquare, cls: 'bg-primary-050 text-primary-800' },
  'job-ok': { icon: Zap, cls: 'bg-success-050 text-success-800' },
  'job-failed': { icon: AlertTriangle, cls: 'bg-danger-050 text-danger-800' },
  'job-retrying': { icon: Loader2, cls: 'bg-attention-050 text-attention-800' },
  'job-queued': { icon: Zap, cls: 'bg-muted text-muted-foreground' },
}

export function FeedList({ items, dense = false }: { items: FeedItem[]; dense?: boolean }) {
  return (
    <ol className="grid">
      {items.map((f) => {
        const ic = FEED_ICON[f.kind]
        const Icon = ic.icon
        const bad = f.kind === 'job-failed'
        return (
          <li key={f.id} className={'grid grid-cols-[22px_minmax(0,1fr)] gap-2 ' + (dense ? 'py-1' : 'py-1.5')}>
            <span className={`mt-0.5 grid h-[22px] w-[22px] place-items-center rounded-md ${ic.cls}`}>
              <Icon className="h-3 w-3" aria-hidden />
            </span>
            <div className="min-w-0 text-[0.8125rem]">
              <div className="flex items-baseline gap-2">
                <b className={'font-semibold ' + (bad ? 'text-danger-800' : '')}>{f.title}</b>
                <span className="truncate text-xs text-ink-3">{f.by}</span>
                <time className="ms-auto shrink-0 text-xs tabular-nums text-muted-foreground">{fmtDayTime(f.at)}</time>
              </div>
              {f.detail && <div className={'text-xs ' + (bad ? 'text-danger-800' : 'text-muted-foreground')}>{f.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function useFeed(p: VariantProps) {
  const [newestFirst, setNewestFirst] = useState(true)
  const items = useMemo(() => {
    const merged = feed(p.logs, p.jobs, false).concat(p.postedNotes)
    merged.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
    return newestFirst ? merged.reverse() : merged
  }, [p.logs, p.jobs, p.postedNotes, newestFirst])
  const toggle = (
    <button
      type="button"
      onClick={() => setNewestFirst((v) => !v)}
      className="rounded-md border border-border px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground hover:bg-accent"
    >
      {newestFirst ? 'Newest first' : 'Oldest first'}
    </button>
  )
  return { items, toggle }
}

export function Composer({ p, autoFocusHint }: { p: VariantProps; autoFocusHint?: boolean }) {
  const [text, setText] = useState('')
  const post = () => {
    if (!text.trim()) return
    p.onPostNote(text.trim())
    setText('')
  }
  return (
    <div className="grid gap-1.5">
      <label className="text-[0.6875rem] font-bold uppercase tracking-wider text-ink-3" htmlFor="proto-note">
        Note for this delivery {autoFocusHint && <kbd className="ms-1 rounded border border-border px-1 font-mono text-[0.625rem]">N</kbd>}
      </label>
      <textarea
        id="proto-note"
        ref={p.composerRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            post()
          }
        }}
        rows={2}
        placeholder="Add a note…"
        className="min-h-14 resize-y rounded-md border border-input bg-card px-2 py-1.5 text-[0.8125rem] outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
        <span>
          <kbd className="rounded border border-border px-1 font-mono">Ctrl</kbd>+<kbd className="rounded border border-border px-1 font-mono">Enter</kbd> to post
        </span>
        <Button variant="outlined" className="ms-auto" disabled={!text.trim()} onClick={post}>
          <Send className="h-3.5 w-3.5" aria-hidden />
          Post
        </Button>
      </div>
    </div>
  )
}

// ---- facts -----------------------------------------------------------------------

export function useFacts(doc: SdDocumentHeaderModel) {
  const { t } = useTranslation('document')
  return railCards(doc, t)
}

export function FactList({ rows, cols = 'grid-cols-[auto_minmax(0,1fr)]' }: { rows: ReturnType<typeof railCards>[number]['rows']; cols?: string }) {
  return (
    <dl className={`grid ${cols} items-baseline gap-x-3 gap-y-0.5 text-[0.8125rem]`}>
      {rows.map((r) => (
        <div key={r.key} className={'contents' + (r.total ? ' font-semibold' : '')}>
          <dt className="whitespace-nowrap text-muted-foreground">{r.label}</dt>
          <dd
            className={
              'm-0 min-w-0 [overflow-wrap:anywhere] ' +
              (r.soft ? 'text-muted-foreground' : 'font-medium') +
              (r.key === 'mobile' || r.key === 'courierDriverPhone' || /No$|code$|Id$/i.test(r.key) ? ' font-mono' : '') +
              (r.total ? ' text-[0.9375rem] font-bold' : '')
            }
          >
            {r.href ? (
              <a href={r.href} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                {r.value} ↗
              </a>
            ) : (
              <Ltr>{r.value}</Ltr>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function H({ children, dot, end }: { children: ReactNode; dot?: string; end?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span aria-hidden className={`h-3 w-[3px] rounded-sm ${dot ?? 'bg-primary'}`} />
      <h3 className="text-[0.6875rem] font-bold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {end && <span className="ms-auto flex items-center gap-2">{end}</span>}
    </div>
  )
}

export function ItemsGrid({ doc }: { doc: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  const cols = useMemo(() => documentColumns.items(), [])
  const footer = useMemo(() => totalsFooterRow(doc.lines, t), [doc, t])
  return (
    <DetailGrid
      columnDefs={cols}
      rowData={doc.lines ?? []}
      emptyMessage={t('items.empty')}
      pinnedBottomRowData={footer}
      rowSelection={ITEM_ROW_SELECTION}
      getRowStyle={deletedLineRowStyle}
      autoHeight
    />
  )
}

export function ConditionsGrid({ doc }: { doc: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  const cols = useMemo(() => documentColumns.conditions(), [])
  const rows = useMemo(() => (doc.conditions ?? []).filter((c) => c.condDocumentLine === 0), [doc])
  return <DetailGrid columnDefs={cols} rowData={rows} emptyMessage={t('conditions.empty')} autoHeight />
}

// ---- commands --------------------------------------------------------------------

/** A command button carrying 083's disabled-reason behaviour + a key hint. */
export function Cmd({
  c,
  variant,
  onCommand,
  refused,
  hint,
  icon,
  label,
}: {
  c: CommandState
  variant: Parameters<typeof Button>[0]['variant']
  onCommand: (k: CommandKind) => void
  refused: CommandKind | null
  hint?: string
  icon?: ReactNode
  label: string
}) {
  const explained = c.reason !== null
  return (
    <span className="group relative inline-flex">
      <Button
        variant={variant}
        data-cmd={c.kind}
        disabled={c.disabled && !explained}
        aria-disabled={explained || undefined}
        onClick={explained ? undefined : () => onCommand(c.kind)}
        className={refused === c.kind ? 'ring-2 ring-attention ring-offset-2 ring-offset-background' : undefined}
        title={explained ? c.reason ?? undefined : hint ? `${label} (${hint})` : undefined}
      >
        {icon}
        {label}
        {hint && <kbd className="ms-0.5 rounded border border-current/30 px-1 font-mono text-[0.625rem] opacity-70">{hint}</kbd>}
      </Button>
      {explained && (
        <span
          role="tooltip"
          className={
            'pointer-events-none absolute top-full start-0 z-30 mt-1 w-max max-w-64 rounded-md border border-border bg-card px-2 py-1 text-[0.6875rem] text-foreground shadow-md ' +
            (refused === c.kind ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')
          }
        >
          {c.reason}
        </span>
      )}
    </span>
  )
}

export function findCmd(bar: CommandBar, kind: CommandKind): CommandState | undefined {
  return [...bar.clusters.flatMap((c) => c.commands), ...bar.terminal].find((c) => c.kind === kind)
}

export const focusRing = (el: RefObject<HTMLElement | null>) => el.current?.focus()
export { useRef }
