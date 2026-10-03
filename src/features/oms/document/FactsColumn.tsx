import { useMemo, useRef, useState, type ReactNode, type Ref } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ExternalLink } from 'lucide-react'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import Ltr from '@/core/ui/Ltr'
import { railCards, type CardRow, type RailCard, type RailFiles } from './fields'
import { documentColumns, deletedLineRowStyle, ITEM_ROW_SELECTION } from './columns'
import { totalsFooterRow } from './items'
import DetailGrid from './DetailGrid'
import AttachmentsTab from './AttachmentsTab'
import type { OrderAttachments } from './use-order-attachments'

/** The heading every block and section of the column wears (the 371 D captures). */
const HEADING = 'text-[0.6875rem] font-bold tracking-wider uppercase'

/**
 * A block's ink: its heading and the links inside it. Prescription is the one block an
 * operator looks for by colour, so the e-Rx facts stay separable from fulfilment at a
 * glance; every other block is quiet, because a column where every heading shouts has
 * no signal in it. 082's tokens, never a literal.
 */
const INK: Record<RailCard['key'], { heading: string; link: string }> = {
  customer: { heading: 'text-muted-foreground', link: 'text-primary' },
  prescription: { heading: 'text-prescription', link: 'text-prescription' },
  fulfilment: { heading: 'text-muted-foreground', link: 'text-primary' },
  driver: { heading: 'text-muted-foreground', link: 'text-primary' },
  payment: { heading: 'text-muted-foreground', link: 'text-primary' },
}

/**
 * The rows whose value is an ID or a code, by `CardRow.key`: set in Plex Mono, which
 * means "this is a key" (spec 380 F1). Money and quantities stay in Sans, so a row's
 * `numeric` flag (which money carries too) cannot stand in for it. A phone number is
 * quoted digit by digit like a key, as on the call center's caller bar (C).
 */
const MONO = new Set([
  'mobile',
  'loyaltyId',
  'approvalNumber',
  'patientId',
  'referenceErx',
  'store',
  'courierCode',
  'courierDriverPhone',
  'trackingId',
])

/**
 * **The facts column** (spec 380 D4, ticket 404): the end side of Delivery details,
 * beside the activity spine. It replaces 083's 340px summary rail and its tabs.
 *
 * Top to bottom:
 * - **the facts**: Customer · Prescription · Fulfilment · Driver & tracking · Payment as
 *   dense label/value blocks. `railCards` decides which blocks and rows exist (083
 *   D-5/D-6: Prescription and Driver collapse out when empty, a blank text row is
 *   omitted, money and booleans always render); this only draws what it is handed, so
 *   there is no em dash here;
 * - **Items**, the grid sized to its rows, deleted lines struck, the totals pinned under;
 * - **Pricing conditions**, folded into a disclosure that shows its count. Its grid is
 *   built the first time it opens and then kept, so a sort or a filter survives a fold;
 * - **Attachments** (spec 324), a disclosure with its file count, drawn only while
 *   `attachmentsTabGate` admits. Its first opening starts the list's one read: the list is
 *   an AUDITED read and waits on it (`useOrderAttachments`). Its body stays mounted when
 *   folded, so a file still sending survives the fold. The Prescription block's
 *   Files · N · Show row opens it and moves focus to it.
 */
export default function FactsColumn({
  document,
  attachments,
}: {
  document: SdDocumentHeaderModel
  attachments: OrderAttachments
}) {
  const { t } = useTranslation('document')
  const [conditionsBuilt, setConditionsBuilt] = useState(false)
  // Asked open, and open only while this owner's list is latched: another record (the
  // latch resets on a new route number) starts folded, and reads nothing until asked.
  const [attachmentsAsked, setAttachmentsAsked] = useState(false)
  const attachmentsOpen = attachmentsAsked && attachments.opened
  const attachmentsSummary = useRef<HTMLElement>(null)

  const openAttachments = () => {
    setAttachmentsAsked(true)
    attachments.open()
  }
  const files: RailFiles = {
    count: attachments.badge,
    allowed: attachments.target !== null,
    onShow: () => {
      openAttachments()
      attachmentsSummary.current?.focus()
    },
  }
  const cards = railCards(document, t, files)

  const itemColumns = useMemo(() => documentColumns.items(), [])
  const itemsFooter = useMemo(() => totalsFooterRow(document.lines, t), [document, t])
  const conditionColumns = useMemo(() => documentColumns.conditions(), [])
  const headerConditions = useMemo(
    () => (document.conditions ?? []).filter((c) => c.condDocumentLine === 0),
    [document],
  )
  const lines = document.lines ?? []

  return (
    <div className="grid min-w-0 content-start gap-2.5">
      <div
        // `role="group"`: `aria-label` is ignored on a bare div.
        role="group"
        aria-label={t('cards.ariaLabel')}
        className="grid gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-3 md:grid-cols-2 2xl:grid-cols-3"
      >
        {cards.map((card) => (
          <section key={card.key} data-facts-block={card.key} className="min-w-0">
            <h3 className={`mb-1 ${HEADING} ${INK[card.key].heading}`}>{card.title}</h3>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 text-[0.8125rem]">
              {card.rows.map((row) => (
                <Row key={row.key} row={row} ink={INK[card.key].link} />
              ))}
            </dl>
          </section>
        ))}
      </div>

      <section id="doc-items" aria-labelledby="doc-items-heading" className="min-w-0 rounded-lg border border-border bg-card p-3">
        <h3 id="doc-items-heading" className={`mb-1.5 ${HEADING} text-muted-foreground`}>
          <Counted i18nKey="items.heading" count={lines.length} />
        </h3>
        <DetailGrid
          columnDefs={itemColumns}
          rowData={lines}
          emptyMessage={t('items.empty')}
          pinnedBottomRowData={itemsFooter}
          rowSelection={ITEM_ROW_SELECTION}
          getRowStyle={deletedLineRowStyle}
        />
      </section>

      <Disclosure
        id="doc-conditions"
        summary={<Counted i18nKey="conditions.heading" count={headerConditions.length} />}
        onToggle={(open) => {
          if (open) setConditionsBuilt(true)
        }}
      >
        {conditionsBuilt && (
          <DetailGrid columnDefs={conditionColumns} rowData={headerConditions} emptyMessage={t('conditions.empty')} />
        )}
      </Disclosure>

      {attachments.target && (
        <Disclosure
          id="doc-attachments"
          summaryRef={attachmentsSummary}
          open={attachmentsOpen}
          summary={
            // No count until one is known: a `0` before the list resolves would be a
            // claim the app cannot yet make (`attachmentsBadgeCount`).
            attachments.badge === null ? (
              t('attachments.headingUncounted')
            ) : (
              <Counted i18nKey="attachments.heading" count={attachments.badge} />
            )
          }
          onToggle={(open) => {
            if (open === attachmentsOpen) return
            if (open) openAttachments()
            else setAttachmentsAsked(false)
          }}
        >
          {/* Keyed by the owner, so another owner starts on a fresh file selection. */}
          <AttachmentsTab
            key={attachments.target.ownerKey}
            target={attachments.target}
            opened={attachments.opened}
            withdrawReasons={attachments.withdrawReasons}
            withdrawOffered={attachments.withdrawOffered}
            filedOnOrderNo={attachments.filedOnOrderNo}
          />
        </Disclosure>
      )}
    </div>
  )
}

/** A section heading with its count: the count is a machine value, isolated through a slot. */
function Counted({ i18nKey, count }: { i18nKey: string; count: number }) {
  const { t } = useTranslation('document')
  return <Trans t={t} i18nKey={i18nKey} count={count} components={{ n: <Ltr /> }} />
}

/**
 * A folded section of the column: a native `<details>`, whose marker points to the
 * inline end and mirrors under RTL on its own. `open` is passed only when the page
 * must open it (Attachments' Show); otherwise the browser holds it.
 */
function Disclosure({
  id,
  summary,
  summaryRef,
  open,
  onToggle,
  children,
}: {
  id: string
  summary: ReactNode
  summaryRef?: Ref<HTMLElement>
  open?: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className="min-w-0 rounded-lg border border-border bg-card p-3"
    >
      <summary ref={summaryRef} className={`cursor-pointer select-none ${HEADING} text-muted-foreground`}>
        {summary}
      </summary>
      <div data-disclosure-body="" className="mt-2">
        {children}
      </div>
    </details>
  )
}

/**
 * One fact: the label, then its value, both at the inline start. The value is isolated
 * by kind (`.claude/rules/bidi.md`): a figure or a code (`numeric`) is a machine value in
 * `Ltr`; a name, an address, a note or a word is free text in a `<bdi>`. It carries
 * quieter ink when it is free text an operator scans rather than quotes, and the
 * block's weight when it is the closing total.
 */
function Row({ row, ink }: { row: CardRow; ink: string }) {
  const total = row.total === true
  const value = row.numeric === true ? <Ltr>{row.value}</Ltr> : <bdi>{row.value}</bdi>
  const pair = (
    <>
      <dt className={'whitespace-nowrap text-muted-foreground' + (total ? ' font-semibold text-foreground' : '')}>
        {row.label}
      </dt>
      <dd
        data-fact={row.key}
        className={
          'm-0 min-w-0 [overflow-wrap:anywhere] font-medium' +
          (row.numeric === true ? ' tabular-nums' : '') +
          (MONO.has(row.key) ? ' font-mono' : '') +
          (row.soft === true ? ' font-normal text-muted-foreground' : '') +
          (total ? ' text-[0.9375rem] font-bold' : '')
        }
      >
        {row.href ? (
          <a
            href={row.href}
            target="_blank"
            rel="noopener noreferrer"
            // Inline, not a flex row: the isolate stays an inline box on the value's line.
            className={`font-semibold hover:underline ${ink}`}
          >
            {value}
            {/* `↗` mirrors to `↖` under RTL — an explicit flip on the SVG: an SVG path
                never auto-mirrors, and a punctuation glyph standing in for an icon
                would flip itself and hide the fault. */}
            <ExternalLink className="ms-1 inline h-3 w-3 align-[-1px] rtl:-scale-x-100" aria-hidden />
          </a>
        ) : row.action ? (
          // An in-page action (ticket 328): the value, then its button. A button, not a
          // link: it opens the Attachments disclosure and goes nowhere.
          <span className="inline-flex items-baseline gap-1.5">
            <span>{value}</span>
            <span aria-hidden className="text-muted-foreground">
              ·
            </span>
            <button
              type="button"
              onClick={row.action.onSelect}
              aria-label={row.action.ariaLabel}
              data-row-action={row.key}
              className={`cursor-pointer font-semibold hover:underline ${ink}`}
            >
              {row.action.label}
            </button>
          </span>
        ) : (
          value
        )}
      </dd>
    </>
  )

  // The closing total takes a rule above it. The wrapper is a **subgrid** row so that
  // one continuous hairline crosses the whole block: a border on each cell would break
  // at the column gap, which reads as two short rules rather than the line under a total.
  if (!total) return pair
  return (
    <div className="col-span-2 mt-1 grid grid-cols-subgrid items-baseline gap-x-3 border-t border-border-strong pt-1.5">
      {pair}
    </div>
  )
}
