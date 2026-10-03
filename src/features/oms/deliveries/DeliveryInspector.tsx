import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, ChevronsRight, ExternalLink, Zap } from 'lucide-react'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import type { TimelineStep, TimelineStepState } from '@/core/oms/timeline'
import { legendText } from '@/core/commands/keys'
import { useSingleKeys } from '@/core/commands/single-key-switch'
import { documentDirection } from '@/core/theme/direction'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { inspectorView, type InspectorView, type IsolatedValue } from './inspector-model'
import {
  clampInspectorWidth,
  INSPECTOR_WIDTH,
  maxInspectorWidth,
  NEXT_ROW_KEYS,
  PREVIOUS_ROW_KEYS,
  separatorKeyWidth,
} from './inspector-pane'
import { STATUS_TONE } from './status-tone'

/** The pane's id, for the separator's and the grid bar toggle's `aria-controls`. */
export const INSPECTOR_ID = 'delivery-inspector'

/** The viewport's width, kept current: the pane is never more than 40% of it. */
function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

/**
 * The resize handle on the pane's inline-start edge (367 §4), so it mirrors under RTL: drag it,
 * or focus it and step 16 px with the arrows, Home/End for min/max; a double-click resets 360.
 */
function Separator({
  width,
  viewport,
  onWidth,
}: {
  width: number
  viewport: number
  onWidth: (width: number) => void
}) {
  const { t } = useTranslation('deliveries')
  const drag = useRef<{ x: number; width: number } | null>(null)
  // Direction is a boot fact (383): a language switch reloads the page.
  const rtl = documentDirection() === 'rtl'
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-controls={INSPECTOR_ID}
      aria-label={t('inspector.resize')}
      aria-valuenow={width}
      aria-valuemin={INSPECTOR_WIDTH.min}
      aria-valuemax={maxInspectorWidth(viewport)}
      tabIndex={0}
      data-inspector-separator=""
      onPointerDown={(e) => {
        if (e.button !== 0) return
        drag.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
        // No text selection across the grid while dragging.
        e.preventDefault()
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        // Dragging toward the inline start grows the pane.
        onWidth(drag.current.width + (rtl ? dx : -dx))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => onWidth(INSPECTOR_WIDTH.default)}
      onKeyDown={(e) => {
        const next = separatorKeyWidth(e.key, width, { viewport, rtl })
        if (next === null) return
        e.preventDefault()
        onWidth(next)
      }}
      className="group absolute inset-y-0 -start-[3px] z-10 w-[6px] cursor-col-resize touch-none focus-visible:outline-none"
    >
      <div className="mx-auto h-full w-px group-hover:bg-primary group-focus-visible:w-[2px] group-focus-visible:bg-ring" />
    </div>
  )
}

/** A value isolated once, by its kind (bidi rule): `Ltr` for a machine value, `<bdi>` for free text. */
function Isolated({ value }: { value: IsolatedValue }) {
  if (!value.text) return null
  return value.machine ? <Ltr>{value.text}</Ltr> : <bdi>{value.text}</bdi>
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** One label · value line. A blank value is no line. */
function Field({ label, children, name }: { label: string; children: ReactNode; name: string }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 text-xs leading-5" data-field={name}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Tag({ children, className, name }: { children: ReactNode; className: string; name: string }) {
  return (
    <span
      data-tag={name}
      className={`inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10.5px] font-medium uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  )
}

const STEP_DOT: Record<TimelineStepState, string> = {
  done: 'border-primary bg-primary',
  current: 'border-primary bg-card ring-[3px] ring-primary-050',
  next: 'border-dashed border-border-strong bg-card',
  later: 'border-border-strong bg-card',
  requested: 'border-fam-cancel-request bg-fam-cancel-request',
  cancelled: 'border-danger bg-danger',
}

const STEP_INK: Record<TimelineStepState, string> = {
  done: 'text-foreground',
  current: 'font-semibold text-foreground',
  next: 'text-muted-foreground',
  later: 'text-muted-foreground',
  requested: 'font-semibold text-fam-cancel-request',
  cancelled: 'font-semibold text-danger-800',
}

const reached = (step: TimelineStep | undefined) => step?.state === 'done' || step?.state === 'current'

/** The inspector variant of the shared timeline (D1): times from row fields, the window as an expectation. */
function Timeline({ steps, windowIsMachine }: { steps: TimelineStep[]; windowIsMachine: boolean }) {
  const { t } = useTranslation('deliveries')
  return (
    <ol className="flex flex-col" aria-label={t('inspector.timeline')}>
      {steps.map((step, i) => (
        <li
          key={step.key}
          data-step={step.key}
          data-state={step.state}
          className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-2.5 pb-2.5 last:pb-0"
        >
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={`absolute start-[6px] top-[17px] bottom-0 w-[2px] ${reached(steps[i + 1]) ? 'bg-primary' : 'bg-border'}`}
            />
          )}
          <span aria-hidden className={`mt-[3px] size-[14px] rounded-full border-2 ${STEP_DOT[step.state]}`} />
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs leading-5">
            <span className={STEP_INK[step.state]}>{t(`status.${step.key}`)}</span>
            {step.time && (
              <span className="text-muted-foreground" data-step-time="">
                <Ltr>{formatDateTime(step.time)}</Ltr>
              </span>
            )}
            {step.expectedWindow && (
              <span className="italic text-muted-foreground" data-expect="">
                <Trans
                  t={t}
                  i18nKey="inspector.expected"
                  values={{ window: step.expectedWindow }}
                  // Isolate by kind: the schedule's range is a machine value, the slot's text is free text.
                  components={{ window: windowIsMachine ? <Ltr /> : <bdi /> }}
                />
              </span>
            )}
            {step.marker && (
              <span
                data-marker={step.marker.kind}
                className="inline-flex h-[18px] items-center gap-1 rounded-full border border-attention-border bg-attention-050 px-1.5 text-[10.5px] text-attention-800"
              >
                {t(`inspector.marker.${step.marker.kind}`)}
                {step.marker.time && <Ltr>{formatDateTime(step.marker.time)}</Ltr>}
              </span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Body({ view, onOpen }: { view: InspectorView; onOpen: (to: string) => void }) {
  const { t } = useTranslation('deliveries')
  const { header, customer, fulfilment, money } = view
  const tone = STATUS_TONE[header.status]
  const openTo = view.openTo
  return (
    <div className="flex flex-col gap-4" data-inspector-row={header.deliveryNo}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-lg font-semibold leading-6" data-inspector-no="">
              <Ltr>{header.deliveryNo}</Ltr>
            </div>
            <div className="flex flex-wrap gap-x-3 text-[11.5px] text-muted-foreground">
              {header.orderNo && (
                <span>
                  {t('inspector.order')}{' '}
                  <span className="font-mono">
                    <Ltr>{header.orderNo}</Ltr>
                  </span>
                </span>
              )}
              {header.documentNo && (
                <span>
                  {t('inspector.document')}{' '}
                  <span className="font-mono">
                    <Ltr>{header.documentNo}</Ltr>
                  </span>
                </span>
              )}
            </div>
          </div>
          <span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${tone.ink}`} data-status={header.status}>
            <span aria-hidden className={`inline-block size-[7px] shrink-0 rounded-full ${tone.dot}`} />
            {t(`status.${header.status}`)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {header.documentType && (
            <Tag name="documentType" className="border-border-strong text-muted-foreground">
              <bdi>{header.documentType}</bdi>
            </Tag>
          )}
          {header.deliveryType && (
            <Tag name="deliveryType" className="border-border-strong text-muted-foreground">
              <bdi>{header.deliveryType}</bdi>
            </Tag>
          )}
          {header.dawaaNow && (
            // 362's one allowed gold: a fill carrying navy ink.
            <Tag name="dawaaNow" className="border-gold bg-gold text-gold-foreground">
              <Zap className="size-3" aria-hidden />
              {t('inspector.dawaaNow')}
            </Tag>
          )}
          {/* 369: payment is a due/paid tag, never a step. Amber is attention. */}
          {header.due.paid ? (
            <Tag name="due" className="border-success-border bg-success-050 text-success-800">
              {t('inspector.paid')}
            </Tag>
          ) : (
            <Tag name="due" className="border-attention-border bg-attention-050 text-attention-800">
              <Trans t={t} i18nKey="inspector.due" values={{ amount: header.due.amount }} components={{ amount: <Ltr /> }} />
            </Tag>
          )}
        </div>
      </div>

      <Timeline steps={view.steps} windowIsMachine={fulfilment.slot.machine} />

      {view.failedJobs !== null && (
        <div role="note" data-failed-banner="" className="flex gap-2 rounded-md border border-danger-border bg-danger-050 p-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden />
          <div>
            <div className="font-semibold text-danger-800">
              <Trans
                t={t}
                i18nKey="inspector.failed"
                count={view.failedJobs}
                values={{ count: view.failedJobs }}
                components={{ count: <Ltr /> }}
              />
            </div>
            <div className="text-foreground">{t('inspector.failedHint')}</div>
          </div>
        </div>
      )}

      <Section title={t('inspector.customer')}>
        <dl className="flex flex-col">
          <Field name="name" label={t('inspector.name')}>
            {customer.name && <bdi>{customer.name}</bdi>}
          </Field>
          <Field name="mobile" label={t('inspector.mobile')}>
            {customer.mobile && <Ltr>{customer.mobile}</Ltr>}
          </Field>
          <Field name="address" label={t('inspector.address')}>
            {customer.address && <bdi>{customer.address}</bdi>}
          </Field>
        </dl>
      </Section>

      <Section title={t('inspector.fulfilment')}>
        <dl className="flex flex-col">
          <Field name="store" label={t('inspector.store')}>
            {fulfilment.storeCode && (
              <>
                <span className="font-mono">
                  <Ltr>{fulfilment.storeCode}</Ltr>
                </span>
                {fulfilment.notActiveInStore && <span className="ms-2 text-attention-800">{t('inspector.notActive')}</span>}
              </>
            )}
          </Field>
          <Field name="slot" label={t('inspector.slot')}>
            {fulfilment.slot.text && <Isolated value={fulfilment.slot} />}
          </Field>
          <Field name="rescheduled" label={t('inspector.rescheduled')}>
            {fulfilment.rescheduled && (
              <span className="flex flex-col items-start text-attention-800">
                {fulfilment.rescheduled.reason && <bdi>{fulfilment.rescheduled.reason}</bdi>}
                {fulfilment.rescheduled.by && <Ltr>{fulfilment.rescheduled.by}</Ltr>}
              </span>
            )}
          </Field>
          <Field name="source" label={t('inspector.source')}>
            {fulfilment.source && <bdi>{fulfilment.source}</bdi>}
          </Field>
          <Field name="courier" label={t('inspector.courier')}>
            {fulfilment.courier.text && <Isolated value={fulfilment.courier} />}
          </Field>
        </dl>
      </Section>

      <Section title={t('inspector.money')}>
        <dl className="flex flex-col">
          <Field name="net" label={t('inspector.net')}>
            {money.net && <Ltr>{money.net}</Ltr>}
          </Field>
          <Field name="paid" label={t('inspector.paidAmount')}>
            {money.paid && <Ltr>{money.paid}</Ltr>}
          </Field>
          <Field name="fees" label={t('inspector.fees')}>
            {money.fees && <Ltr>{money.fees}</Ltr>}
          </Field>
        </dl>
        <div
          className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 border-t border-border pt-1.5 text-sm font-semibold"
          data-field="amountDue"
        >
          <span>{t('inspector.amountDue')}</span>
          <span className={money.owing ? 'text-attention-800' : ''}>
            <Ltr>{money.due}</Ltr>
          </span>
        </div>
      </Section>

      {view.note && (
        <Section title={t('inspector.note')}>
          <p className="whitespace-pre-wrap border-s-2 border-border-strong ps-2 text-xs leading-5" data-field="note">
            <bdi>{view.note}</bdi>
          </p>
        </Section>
      )}

      {/* Read-only (367 §3): every act lives on Delivery details. */}
      <button
        type="button"
        data-inspector-open=""
        disabled={!openTo}
        title={openTo ? undefined : t('inspector.noDeliveryNo')}
        onClick={() => openTo && onOpen(openTo)}
        className="flex h-8 items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50 disabled:hover:bg-primary"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {t('inspector.open')}
        <Kbd>{t('common:keys.enter')}</Kbd>
      </button>
    </div>
  )
}

function Empty() {
  const { t } = useTranslation('deliveries')
  const singleKeys = useSingleKeys((s) => s.on)
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground" data-inspector-empty="">
      <p>{t('inspector.empty')}</p>
      {/* A letter that does nothing is not advertised (393): the hint follows the switch. */}
      {singleKeys && (
        <p>
          <Trans
            t={t}
            i18nKey="inspector.emptyKeys"
            components={{
              // The two caps are one unit, isolated once (378 §5).
              keys: (
                <Ltr>
                  <Kbd>{legendText(NEXT_ROW_KEYS, t)}</Kbd> <Kbd>{legendText(PREVIOUS_ROW_KEYS, t)}</Kbd>
                </Ltr>
              ),
            }}
          />
        </p>
      )}
    </div>
  )
}

/**
 * The Delivery inspector (ticket 397, spec 380 L6, L13, L15, L18; ruling 367): the current row,
 * read from the row alone, in a pane on the list's inline-end edge. No request, ever.
 *
 * `width` is the remembered width; the pane clamps it to this viewport (never more than 40%).
 */
export default function DeliveryInspector({
  row,
  width,
  onWidth,
  onCollapse,
  onOpen,
  className = '',
}: {
  row: DeliveryDocumentModel | null
  width: number
  onWidth: (width: number) => void
  onCollapse: () => void
  onOpen: (to: string) => void
  className?: string
}) {
  const { t } = useTranslation('deliveries')
  const viewport = useViewportWidth()
  const shown = clampInspectorWidth(width, viewport)
  return (
    <aside
      id={INSPECTOR_ID}
      aria-label={t('inspector.region')}
      style={{ width: shown }}
      className={`relative flex shrink-0 flex-col border-s border-border bg-card ${className}`}
    >
      <Separator width={shown} viewport={viewport} onWidth={(next) => onWidth(clampInspectorWidth(next, viewport))} />
      <div className="flex h-8 shrink-0 items-center justify-end border-b border-divider px-2">
        <button
          type="button"
          onClick={onCollapse}
          aria-label={t('inspector.hide')}
          title={t('inspector.hide')}
          data-inspector-collapse=""
          className="rounded p-1 text-muted-foreground hover:bg-accent"
        >
          {/* Points toward the inline end, where the pane folds away. */}
          <ChevronsRight className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        {row ? <Body view={inspectorView(row)} onOpen={onOpen} /> : <Empty />}
      </div>
    </aside>
  )
}
