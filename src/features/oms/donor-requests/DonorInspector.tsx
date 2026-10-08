import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import type { DonorRequestModel } from '@/core/models/sd-document'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import PaneSeparator, { useViewportWidth } from '@/core/ui/PaneSeparator'
import StatusBadge from '@/core/ui/StatusBadge'
import { clampInspectorWidth } from '@/core/ui/inspector-pane'
import { formatDateTime } from '@/core/util/date-format'
import { pickTimeText } from './columns'
import { donorInspector, type DonorInspectorMoment, type DonorInspectorView } from './inspector'

/** The pane's id, for the separator's `aria-controls`. */
export const DONOR_INSPECTOR_ID = 'donor-inspector'

function Section({ title, children, name }: { title: string; children: ReactNode; name: string }) {
  return (
    <section className="flex flex-col gap-1.5" data-section={name}>
      <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

/** One label · value line. A blank value is no line. */
function Field({ label, children, name }: { label: string; children: ReactNode; name: string }) {
  if (children === null || children === undefined || children === '' || children === false) return null
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-2 text-xs leading-5" data-field={name}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

/** A code (a document number, a store) in the inspector: monospace, isolated LTR. */
function Code({ value }: { value: string }) {
  return (
    <span className="font-mono">
      <Ltr>{value}</Ltr>
    </span>
  )
}

/** How the request ended, as the list's outcome column says it — the same badge and tone. */
function OutcomeBadge({ view }: { view: DonorInspectorView }) {
  const { t } = useTranslation('donor-requests')
  const { outcome, cancelledAfterPicked, tone } = view.row
  const label = cancelledAfterPicked
    ? t('outcome.cancelledAfterPicked')
    : outcome
      ? t(`outcome.${outcome}`)
      : tone === 'muted'
        ? t('outcome.cancelled')
        : ''
  if (!label) return null
  return (
    <span data-donor-tone={tone ?? ''} data-inspector-outcome={outcome ?? ''}>
      <StatusBadge sev={tone === 'attention' ? 'warn' : 'mute'}>{label}</StatusBadge>
    </span>
  )
}

/**
 * One donor moment. An Ended moment says how it ended where the server sent an outcome; the
 * dot takes the request's tone there, as the list's badge does.
 */
function Moment({ moment, view }: { moment: DonorInspectorMoment; view: DonorInspectorView }) {
  const { t } = useTranslation('donor-requests')
  const ended = moment.kind === 'ended'
  const label = ended && view.row.outcome ? t(`outcome.${view.row.outcome}`) : t(`inspector.moment.${moment.kind}`)
  const dot =
    ended && view.row.tone === 'attention'
      ? 'border-attention-border bg-attention-050'
      : ended
        ? 'border-border-strong bg-muted'
        : 'border-primary bg-primary'
  return (
    <li data-donor-moment={moment.kind} className="relative grid grid-cols-[12px_minmax(0,1fr)] gap-2.5 pb-2.5 last:pb-0">
      <span aria-hidden className={`mt-[4px] size-[12px] rounded-full border-2 ${dot}`} />
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-xs leading-5">
        <span className={ended && view.row.tone === 'attention' ? 'font-semibold text-attention-800' : 'font-medium text-foreground'}>
          {label}
        </span>
        <span className="text-muted-foreground" data-moment-time="">
          <Ltr>{formatDateTime(moment.at)}</Ltr>
        </span>
        {moment.by && (
          <span className="text-muted-foreground" data-moment-by="">
            <Trans t={t} i18nKey="inspector.by" values={{ by: moment.by }} components={{ who: <Ltr /> }} />
          </span>
        )}
      </div>
    </li>
  )
}

function Body({ view, onOpen }: { view: DonorInspectorView; onOpen: (to: string) => void }) {
  const { t } = useTranslation('donor-requests')
  const { openTo, transfer } = view
  const pickText = pickTimeText(t, view.row)
  return (
    <div className="flex flex-col gap-4" data-inspector-row={view.requestNo}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {t('inspector.request')}
            </div>
            <div className="font-mono text-lg font-semibold leading-6" data-inspector-no="">
              <Ltr>{view.requestNo}</Ltr>
            </div>
          </div>
          <span className="mt-1 text-xs font-medium text-foreground" data-inspector-state={view.state ?? ''}>
            {view.state ? t(`state.${view.state}`) : <bdi>{view.stateRaw}</bdi>}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <OutcomeBadge view={view} />
        </div>
        {view.reason && (
          <p className="whitespace-pre-wrap border-s-2 border-border-strong ps-2 text-xs leading-5" data-field="reason">
            <bdi>{view.reason}</bdi>
          </p>
        )}
      </div>

      <Section name="request" title={t('inspector.facts')}>
        <dl className="flex flex-col">
          <Field name="deliveryNo" label={t('inspector.delivery')}>
            {view.deliveryNo && <Code value={view.deliveryNo} />}
          </Field>
          <Field name="donorStore" label={t('inspector.donorStore')}>
            {view.donorStore && <Code value={view.donorStore} />}
          </Field>
          <Field name="orderStore" label={t('inspector.orderStore')}>
            {view.orderStore && <Code value={view.orderStore} />}
          </Field>
          <Field name="asked" label={t('inspector.asked')}>
            <Ltr>{String(view.asked)}</Ltr>
          </Field>
          <Field name="given" label={t('inspector.given')}>
            <Ltr>{String(view.given)}</Ltr>
          </Field>
          <Field name="pickTime" label={t('columns.pickTime')}>
            {/* The elapsed time carries words (`1h 20m`): dir auto keeps each locale in its own order. */}
            {pickText && <bdi className={view.row.waiting ? 'font-medium' : undefined}>{pickText}</bdi>}
          </Field>
        </dl>
      </Section>

      {transfer && (
        <Section name="transfer" title={t('inspector.transfer')}>
          <dl className="flex flex-col">
            <Field name="transferStoNo" label={t('inspector.sto')}>
              {transfer.stoNo ? <Code value={transfer.stoNo} /> : <span className="text-muted-foreground">{t('inspector.notYet')}</span>}
            </Field>
            <Field name="transferSapDocumentNo" label={t('inspector.sapDocument')}>
              {transfer.sapDocumentNo ? (
                <Code value={transfer.sapDocumentNo} />
              ) : (
                <span className="text-muted-foreground">{t('inspector.notYet')}</span>
              )}
            </Field>
          </dl>
        </Section>
      )}

      <Section name="moments" title={t('inspector.moments')}>
        {view.moments.length > 0 ? (
          <ol className="flex flex-col" aria-label={t('inspector.moments')}>
            {view.moments.map((m) => (
              <Moment key={m.kind} moment={m} view={view} />
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted-foreground">{t('inspector.noMoments')}</p>
        )}
      </Section>

      {/* Read-only (D9): the request's delivery is where anything is done. */}
      <button
        type="button"
        data-donor-open=""
        disabled={!openTo}
        title={openTo ? undefined : t('inspector.noDelivery')}
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

/**
 * The donor request inspector (ticket 432, spec 430 D9): the selected row, read from the row
 * alone — no request, ever — in a resizable pane on the list's inline-end edge. Its presentation
 * is this feature's own; only the pure `@/core/oms` donor moments are shared with the timeline.
 */
export default function DonorInspector({
  row,
  now,
  width,
  onWidth,
  onOpen,
  className = '',
}: {
  row: DonorRequestModel | null
  /** The minute clock the list ticks with. */
  now: number
  width: number
  onWidth: (width: number) => void
  onOpen: (to: string) => void
  className?: string
}) {
  const { t } = useTranslation('donor-requests')
  const viewport = useViewportWidth()
  const shown = clampInspectorWidth(width, viewport)
  return (
    <aside
      id={DONOR_INSPECTOR_ID}
      aria-label={t('inspector.region')}
      style={{ width: shown }}
      className={`relative flex shrink-0 flex-col rounded-lg border border-border bg-card ${className}`}
      data-donor-inspector=""
    >
      <PaneSeparator
        controls={DONOR_INSPECTOR_ID}
        label={t('inspector.resize')}
        width={shown}
        viewport={viewport}
        onWidth={(next) => onWidth(clampInspectorWidth(next, viewport))}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
        {row ? (
          <Body view={donorInspector(row, now)} onOpen={onOpen} />
        ) : (
          <div
            className="flex h-full items-center justify-center text-center text-xs text-muted-foreground"
            data-inspector-empty=""
          >
            {t('inspector.empty')}
          </div>
        )}
      </div>
    </aside>
  )
}
