import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Check, ChevronLeft, CircleDot, Flag, XCircle, Zap, type LucideIcon } from 'lucide-react'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import type { TimelineStepKey } from '@/core/oms/timeline'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { documentProvenanceRows, statusBreakdownRows, type FieldRow, type HeaderSubId } from './fields'
import { documentHeaderView, type DocumentHeaderView } from './header'

/**
 * The now-step badge's tone and icon per step (spec 380 D2; 368 §3's amendment to 369).
 * *Cancellation requested* is 082's `--fam-cancel-request` indigo, the Request cancellation
 * command's own colour, because asking is not doing; *Cancelled* is danger red. Amber is never
 * a state colour: it stays reserved for attention (here, the due tag). Created and Ready are
 * neutral, Out is primary and Delivered success, as on the list's Status column. Indigo has no
 * tinted ground, so its badge is the indigo itself as ink and edge on `--card`. The icon takes
 * the word's ink.
 */
const NOW_BADGE: Record<TimelineStepKey, { tone: string; Icon: LucideIcon }> = {
  created: { tone: 'border-border-strong bg-card text-muted-foreground', Icon: CircleDot },
  ready: { tone: 'border-border-strong bg-card text-muted-foreground', Icon: CircleDot },
  out: { tone: 'border-primary-border bg-primary-050 text-primary-800', Icon: CircleDot },
  delivered: { tone: 'border-success-border bg-success-050 text-success-800', Icon: Check },
  requested: { tone: 'border-fam-cancel-request bg-card text-fam-cancel-request', Icon: Flag },
  cancelled: { tone: 'border-danger-border bg-danger-050 text-danger-800', Icon: XCircle },
}

/** One shape for the tags on line one, so none reads as weightier than another. */
const TAG = 'inline-flex h-5 items-center gap-1 rounded border px-1.5 text-[10.5px] font-medium uppercase tracking-wide'

/**
 * Delivery details' header (spec 380 D2, ticket 402; ruling 371 §1): a light `--card` card,
 * **never a dark slab**. It replaces 083 D-2's identity band and D-3's pill rail.
 *
 * - **Line one:** Back, the number in mono 600, the now-step badge, the due/paid tag, the tags
 *   (Dawaa Now, e-Rx, Overall), then **All statuses** at the end with the thirteen statuses and
 *   the provenance in its disclosure (083 D-3's disclosure kept), then `children` (Refresh).
 * - **Line two:** the sub-ids, IDs in mono.
 *
 * The band's customer block is dropped: the summary rail's Customer card still shows it, and
 * from 404 the facts column does.
 *
 * `document` is `null` while the document loads or fails to: the header still renders, with the
 * route id as its number, because the chevron is this screen's only way out and it must not
 * appear and disappear underneath the operator.
 */
export default function DocumentHeader({
  document,
  routeId,
  children,
}: {
  document: SdDocumentHeaderModel | null
  routeId: string
  children?: ReactNode
}) {
  const { t } = useTranslation('document')
  const view = document ? documentHeaderView(document, t) : null

  return (
    <header
      // `role="group"` is load-bearing: this <header> sits inside the page's <section>, so its
      // implicit role is generic and an `aria-label` on it would be ignored.
      role="group"
      aria-label={t('header.ariaLabel')}
      className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link
          to="/oms/deliveries"
          aria-label={t('back')}
          title={t('back')}
          className="grid size-7 shrink-0 place-items-center rounded-md border border-border hover:bg-accent"
        >
          {/* Mirrors under RTL: an explicit SVG flip, never a glyph standing in for an icon. */}
          <ChevronLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        </Link>

        <span className="font-mono text-lg leading-7 font-semibold" data-header-no="">
          <Ltr>{document?.documentNo ?? routeId}</Ltr>
        </span>

        {view && <LineOneTags view={view} />}

        {document && (
          <span className="ms-auto flex items-center gap-2">
            <AllStatuses document={document} />
            {children}
          </span>
        )}
      </div>

      {view && view.subIds.length > 0 && (
        // `ps-10` sets line two under the number: the chevron's 28px plus the 12px gap.
        <div className="flex flex-wrap gap-x-4 gap-y-1 ps-10 text-xs text-muted-foreground">
          {view.subIds.map((row) => (
            <SubId key={row.key} row={row} />
          ))}
        </div>
      )}
    </header>
  )
}

/** The now-step badge, the due/paid tag and the tags, in D2's order. */
function LineOneTags({ view }: { view: DocumentHeaderView }) {
  const { t } = useTranslation('document')
  const badge = NOW_BADGE[view.now]
  return (
    <>
      <span
        data-now-step={view.now}
        className={`inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-xs font-semibold ${badge.tone}`}
      >
        <badge.Icon className="size-3.5" aria-hidden />
        {t(`step.${view.now}`)}
      </span>

      {/* 369 §1: payment is not a step. Amber is attention, which an amount owed is. */}
      {view.due.paid ? (
        <span data-due="paid" className="inline-flex h-6 items-center rounded-md border border-success-border bg-success-050 px-2 text-xs font-semibold text-success-800">
          {t('dueTag.paid')}
        </span>
      ) : (
        <span data-due="due" className="inline-flex h-6 items-center rounded-md border border-attention-border bg-attention-050 px-2 text-xs font-semibold text-attention-800">
          {/* One inline run, not flex items: a flex container would drop the word's trailing
              space and blockify the amount's isolate. */}
          <span>
            <Trans t={t} i18nKey="dueTag.due" values={{ amount: view.due.amount }} components={{ amount: <Ltr /> }} />
          </span>
        </span>
      )}

      {view.tags.dawaaNow && (
        // 362's one allowed gold on a light surface: a fill carrying navy ink.
        <span data-tag="dawaaNow" className={`${TAG} border-gold bg-gold text-gold-foreground`}>
          <Zap className="size-3" aria-hidden />
          {t('dawaaNow')}
        </span>
      )}
      {view.tags.eRx && (
        <span data-tag="eRx" className={`${TAG} border-prescription-050 bg-prescription-050 text-prescription-800`}>
          {t('header.eRx')}
        </span>
      )}
      {/* `overallStatus` has no `*Description` companion on the payload, so the tag says it
          is a code rather than letting it read as an unresolved word. Blank: no tag. */}
      {view.tags.overall && (
        <span data-tag="overall" className={`${TAG} border-border-strong text-muted-foreground`}>
          {t('header.overall')}
          <span className="font-mono normal-case">
            <Ltr>{view.tags.overall}</Ltr>
          </span>
        </span>
      )}
    </>
  )
}

/**
 * One sub-id: its label, then the value isolated by kind (F24). An ID, a code and Placed's
 * date · time are machine values (`Ltr`, the whole pair once); a resolved type is a word in
 * either script (`<bdi>`).
 */
function SubId({ row }: { row: HeaderSubId }) {
  const machine = row.isCode || row.key === 'placed'
  return (
    <span data-subid={row.key}>
      {row.label}{' '}
      <b className={'font-semibold text-foreground tabular-nums' + (row.isCode ? ' font-mono' : '')}>
        {machine ? <Ltr>{row.value}</Ltr> : <bdi>{row.value}</bdi>}
      </b>
    </span>
  )
}

/**
 * **All statuses** (083 D-3's disclosure, kept): the thirteen status rows, then the
 * provenance as a second group beside them, never rows inside them.
 */
function AllStatuses({ document }: { document: SdDocumentHeaderModel }) {
  const { t } = useTranslation('document')
  const rows = document.status ? statusBreakdownRows(document.status, t) : []
  const provenance = documentProvenanceRows(document, t)
  if (rows.length === 0) return null
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-1 text-xs font-semibold text-primary hover:underline">
        <Trans t={t} i18nKey="header.allStatusesCount" values={{ count: rows.length }} components={{ count: <Ltr /> }} />
      </summary>
      <div className="absolute end-0 z-10 mt-1 grid w-max max-w-[22rem] gap-1.5">
        <DisclosureGroup title={t('header.allStatuses')} fields={rows} />
        {provenance.length > 0 && <DisclosureGroup title={t('header.provenance')} fields={provenance} />}
      </div>
    </details>
  )
}

/**
 * A titled label/value list inside the disclosure. Its em dash is a local rule: a
 * disclosure's job is completeness, so a status the server left blank is reported as blank.
 * The summary rail's cards do the opposite and omit the row (083 D-5).
 */
function DisclosureGroup({ title, fields }: { title: string; fields: readonly FieldRow[] }) {
  return (
    <section className={POPOVER}>
      <h3 className="border-b border-border/60 px-2.5 py-1.5 text-xs font-semibold tracking-tight">{title}</h3>
      <dl className="grid px-2.5 py-1.5">
        {fields.map((field) => (
          <div key={field.label} className="grid grid-cols-[minmax(8.5rem,max-content)_1fr] items-baseline gap-x-3 py-0.5">
            <dt className="text-xs font-semibold text-muted-foreground">{field.label}</dt>
            <dd className="m-0 text-[0.8125rem] font-semibold break-words">
              {field.value ? <bdi>{field.value}</bdi> : '—'}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
