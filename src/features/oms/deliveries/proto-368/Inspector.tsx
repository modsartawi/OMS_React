/* PROTOTYPE 368 — the Delivery inspector (367): row fields only, no fetch, read-only.
 * Shared by every variant: its CONTENT is settled; where it sits is not. */
import { useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { AlertTriangle, CalendarClock, ChevronsRight, ExternalLink, Ban, StickyNote, Zap } from 'lucide-react'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime, formatShortDate } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { c } from './copy'
import { openRecord, StatusDot } from './Grid'
import { timeline, type Step } from './model'
import { INSPECTOR, selectedRow, useProto } from './store'

type Row = DeliveryDocumentModel

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded border border-b-2 border-border-strong bg-card px-1 font-mono text-[10.5px] font-medium leading-none text-muted-foreground">
      {children}
    </kbd>
  )
}

const maxWidth = () => Math.min(INSPECTOR.max, Math.floor(window.innerWidth * 0.4))
const clamp = (w: number) => Math.max(INSPECTOR.min, Math.min(maxWidth(), w))

export const ACTS = [
  { act: 'reschedule', key: 'R', label: 'insp.reschedule', icon: CalendarClock, tone: 'text-fam-fulfilment' },
  { act: 'request-close', key: 'C', label: 'insp.requestCancel', icon: Ban, tone: 'text-fam-cancel-request' },
  { act: 'add-note', key: 'N', label: 'insp.addNote', icon: StickyNote, tone: 'text-muted-foreground' },
] as const

export function deepLink(navigate: ReturnType<typeof useNavigate>, row: Row | null, act: (typeof ACTS)[number]['act']) {
  if (!row) {
    toast.info(c('noRow'))
    return
  }
  const label = c(ACTS.find((a) => a.act === act)!.label)
  toast.info(c('insp.deepLink', { act: label }))
  openRecord(navigate, row, act)
}

/** The inline-start resize handle: drag, arrows ±16, Home/End, double-click resets. */
function Separator() {
  const width = useProto((s) => s.inspectorWidth)
  const start = useRef<{ x: number; w: number } | null>(null)
  const rtl = () => document.documentElement.dir === 'rtl'
  const setW = (w: number) => useProto.setState({ inspectorWidth: clamp(w) })
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={c('insp.resize')}
      aria-valuenow={width}
      aria-valuemin={INSPECTOR.min}
      aria-valuemax={maxWidth()}
      tabIndex={0}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, w: width }
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const dx = e.clientX - start.current.x
        setW(start.current.w + (rtl() ? dx : -dx))
      }}
      onPointerUp={() => (start.current = null)}
      onDoubleClick={() => setW(INSPECTOR.def)}
      onKeyDown={(e) => {
        const grow = rtl() ? 'ArrowRight' : 'ArrowLeft'
        const shrink = rtl() ? 'ArrowLeft' : 'ArrowRight'
        if (e.key === grow) setW(width + 16)
        else if (e.key === shrink) setW(width - 16)
        else if (e.key === 'Home') setW(INSPECTOR.min)
        else if (e.key === 'End') setW(maxWidth())
        else return
        e.preventDefault()
      }}
      className="group absolute inset-y-0 -start-[3px] z-10 w-[6px] cursor-col-resize focus-visible:outline-none"
    >
      <div className="mx-auto h-full w-px bg-transparent group-hover:bg-primary group-focus-visible:w-[2px] group-focus-visible:bg-ring" />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      {children}
    </section>
  )
}

function KV({ k, children }: { k: string; children: ReactNode }) {
  if (children === null || children === undefined || children === '') return null
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 text-xs leading-5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

const STEP_DOT: Record<Step['state'], string> = {
  done: 'bg-primary border-primary',
  current: 'bg-card border-primary ring-[3px] ring-primary-050',
  next: 'bg-card border-border-strong border-dashed',
  todo: 'bg-card border-border-strong',
  requested: 'bg-attention border-attention',
  cancelled: 'bg-danger border-danger',
}
const STEP_INK: Record<Step['state'], string> = {
  done: 'text-foreground',
  current: 'text-foreground font-semibold',
  next: 'text-muted-foreground',
  todo: 'text-ink-3',
  requested: 'text-attention-800 font-semibold',
  cancelled: 'text-danger font-semibold',
}

function Timeline({ row }: { row: Row }) {
  const steps = timeline(row)
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <li key={s.key} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 pb-2.5 last:pb-0">
          {i < steps.length - 1 && (
            <span
              className={`absolute start-[6px] top-[14px] bottom-0 w-[2px] ${
                steps[i + 1].state === 'done' || steps[i + 1].state === 'current' ? 'bg-primary' : 'bg-border'
              }`}
              aria-hidden
            />
          )}
          <span className={`mt-[3px] size-[14px] rounded-full border-2 ${STEP_DOT[s.state]}`} aria-hidden />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs leading-5">
            <span className={STEP_INK[s.state]}>{c(`status.${s.key}`)}</span>
            {s.time && <span className="text-muted-foreground">{formatDateTime(s.time)}</span>}
            {s.expect && <span className="italic text-ink-3">{c('insp.expect', { window: s.expect })}</span>}
            {s.marker && (
              <span className="inline-flex h-[18px] items-center rounded-full border border-attention-border bg-attention-050 px-1.5 text-[10.5px] text-attention-800">
                {c('insp.rescheduledMarker')}
                {s.markerTime && <span className="ms-1 opacity-80">{formatDateTime(s.markerTime).slice(11)}</span>}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Tag({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10.5px] font-medium uppercase tracking-wide ${className}`}>
      {children}
    </span>
  )
}

function Body({ row }: { row: Row }) {
  const navigate = useNavigate()
  const due = (row.amountDue ?? 0) > 0
  return (
    <div className="flex flex-col gap-4">
      {/* header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-lg font-semibold leading-6">{row.deliveryNo}</div>
            <div className="text-[11.5px] text-muted-foreground">
              {c('insp.order')} <span className="font-mono">{row.orderNo}</span> · {c('insp.doc')}{' '}
              <span className="font-mono">{row.documentNo}</span>
            </div>
          </div>
          <StatusDot row={row} className="mt-1 text-xs font-medium" />
        </div>
        <div className="flex flex-wrap gap-1">
          <Tag className="border-border-strong text-muted-foreground">{row.documentType?.trim()}</Tag>
          <Tag className="border-border-strong text-muted-foreground">{row.deliveryType?.trim()}</Tag>
          {row.isExpressDelivery && (
            <Tag className="border-gold bg-gold text-gold-foreground">
              <Zap className="size-3" aria-hidden />
              {c('insp.express')}
            </Tag>
          )}
          {/* 369: payment is a header due/paid tag, never a step. */}
          <Tag className={due ? 'border-attention-border bg-attention-050 text-attention-800' : 'border-success-border bg-success-050 text-success-800'}>
            {due ? c('insp.due', { amount: formatMoney(row.amountDue) }) : c('insp.paid')}
          </Tag>
        </div>
      </div>

      <Timeline row={row} />

      {row.failedJobsCount > 0 && (
        <div role="note" className="flex gap-2 rounded-md border border-danger-border bg-danger-050 p-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
          <div>
            <div className="font-semibold text-danger-800">{c('insp.failed', { count: row.failedJobsCount })}</div>
            <div className="text-muted-foreground">{c('insp.failedHint')}</div>
          </div>
        </div>
      )}

      <Section title={c('insp.customer')}>
        <dl className="flex flex-col">
          <KV k={c('insp.name')}>{row.customerName}</KV>
          <KV k={c('insp.mobile')}>
            <span className="font-mono">
              <Ltr>{row.customerPhone}</Ltr>
            </span>
          </KV>
          <KV k={c('insp.address')}>{[row.street1, row.districtName, row.cityName].filter(Boolean).join(', ')}</KV>
        </dl>
      </Section>

      <Section title={c('insp.fulfilment')}>
        <dl className="flex flex-col">
          <KV k={c('insp.store')}>
            <span className="font-mono">{row.storeCode}</span>
            {!row.isActiveInStore && <span className="ms-1.5 text-attention-800">· {c('insp.notActive')}</span>}
          </KV>
          <KV k={c('insp.slot')}>
            {formatShortDate(row.timeSlotDay || row.deliveryScheduleFromTime)} · {row.timeSlotDescription}
            {row.rescheduled && (
              <div className="text-[11.5px] text-attention-800">
                {c('insp.rescheduledBy', { reason: row.rescheduledReason, user: row.rescheduledUser })} ·{' '}
                {formatDateTime(row.rescheduledTime)}
              </div>
            )}
          </KV>
          <KV k={c('insp.source')}>{row.documentSource?.trim()}</KV>
          <KV k={c('insp.courier')}>
            {[row.courierCode, row.courierDriverName].filter(Boolean).join(' · ') || null}
          </KV>
        </dl>
      </Section>

      <Section title={c('insp.money')}>
        <dl className="flex flex-col">
          <KV k={c('insp.net')}>{formatMoney(row.netTotal)}</KV>
          <KV k={c('insp.paidAmount')}>{formatMoney(row.paidAmount)}</KV>
          <KV k={c('insp.fees')}>{formatMoney(row.deliveryFees)}</KV>
        </dl>
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 border-t border-border pt-1.5 text-sm font-semibold">
          <span>{c('insp.amountDue')}</span>
          <span className={due ? 'text-attention-800' : ''}>{formatMoney(row.amountDue)}</span>
        </div>
      </Section>

      {row.note?.trim() && (
        <Section title={c('insp.note')}>
          <p className="border-s-2 border-border-strong ps-2 text-xs leading-5">{row.note}</p>
        </Section>
      )}

      {/* Read-only: every act deep-links to Delivery details (367). */}
      <div className="flex flex-col gap-1">
        {ACTS.map((a) => (
          <button
            key={a.act}
            type="button"
            aria-keyshortcuts={a.key}
            title={`${c(a.label)} (${a.key})`}
            onClick={() => deepLink(navigate, row, a.act)}
            className="flex h-[30px] items-center gap-2 rounded-md px-2 text-xs hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <a.icon className={`size-3.5 ${a.tone}`} aria-hidden />
            <span className="flex-1 text-start">{c(a.label)}</span>
            <Kbd>{a.key}</Kbd>
          </button>
        ))}
        <button
          type="button"
          data-btn=""
          aria-keyshortcuts="Enter"
          onClick={() => openRecord(navigate, row)}
          className="mt-1 flex h-[32px] items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/85"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          {c('insp.open')}
          <span className="rounded border border-primary-foreground/40 px-1 font-mono text-[10.5px]">↵</span>
        </button>
      </div>
    </div>
  )
}

/** The inspector pane: collapsible, drag-resizable, on the inline-END side. */
export default function Inspector({ className = '' }: { className?: string }) {
  const open = useProto((s) => s.inspectorOpen)
  const width = useProto((s) => s.inspectorWidth)
  const row = useProto(selectedRow)
  if (!open) return null
  return (
    <aside
      aria-label={c('insp.region')}
      style={{ width }}
      className={`relative flex shrink-0 flex-col border-s border-border bg-card ${className}`}
    >
      <Separator />
      <div className="flex h-8 shrink-0 items-center justify-end border-b border-divider px-2">
        <button
          type="button"
          onClick={() => useProto.setState({ inspectorOpen: false })}
          aria-label={c('insp.collapse')}
          title={c('insp.collapse')}
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          <ChevronsRight className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {row ? (
          <Body row={row} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <p>{c('insp.empty')}</p>
            <p className="flex items-center gap-1">
              <Kbd>J</Kbd> <Kbd>K</Kbd> {c('insp.emptyKeys').replace('J / K ', '')}
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
