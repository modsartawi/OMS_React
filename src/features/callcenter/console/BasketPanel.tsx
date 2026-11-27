/**
 * The basket — the ordinary middle of a call (ticket 170), drawn as the numbered
 * grid of spec 983 (ticket 985).
 *
 * The caller changes their mind, and the basket keeps up without starting over:
 * **change a quantity**, **change a unit of measure**, **void a line**. Each is a
 * verb, each returns the whole `SessionState`, and each is therefore **rendered
 * rather than patched** — which is why the quantity field goes back to the
 * engine's figure the moment a correction is not in flight. A field that kept
 * what the agent typed after a refusal would be the console holding an opinion
 * about a basket it does not own.
 *
 * 🚩 **Nothing here adds anything up.** A line draws `lineTotal.gross`, its
 * `unitPrice.gross` and its own discount conditions; the receipt draws `totals`.
 * `basket-view.ts` is what makes that structural — this component is handed
 * figures, never lines to total.
 *
 * Each row is numbered by position (D4: display only, never sent) so the agent can
 * say "line 2". Clicking a line opens **how it was priced** underneath: basic
 * price, each condition by name, net, then VAT as **rate and amount** (D5 — the
 * live engine describes MWST as "Vat %" beside an amount), then the line total.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2, Minus, Plus, X } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import { fsi } from '@/core/util/bidi'
import { formatMoney } from '@/core/util/number-format'
import Ltr from '@/core/ui/Ltr'
import AvailabilityPill from './AvailabilityPill'
import { basketLineViews, type BasketLineView, type PricingRow } from './basket-view'
import { NOTE } from './console-notes'
import { nextQty, nextUom, type LineEdit } from './line-edit'
import Money from './Money'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

/**
 * The three corrections and what they are currently saying, as one prop — the
 * shape the caller bar's two verbs (165) and the search panel's add (168) already use.
 * The calls themselves are the page's: they return the whole `SessionState` and
 * the cache is the store of record.
 */
export interface BasketActions {
  /** A new quantity — never a delta (the engine owns what the line holds). */
  onQty: (line: BasketLineView, qty: number) => void
  onUom: (line: BasketLineView, uom: string) => void
  onVoid: (line: BasketLineView) => void
  /**
   * The correction in flight, or the one waiting on the agent's acceptance
   * (169's sheet, which a quantity raise reaches too). While it is set the row
   * keeps what the agent typed; the moment it clears, the projection speaks.
   *
   * It is the action itself rather than a pair copied out of it: the page holds
   * `LineEdit`s, and re-shaping one at each call site is how the two ends drift.
   */
  pending: LineEdit | null
  /** The last correction's own failure, already worded, and the line it was
   *  about — drawn ON that line, where the agent's eye already is. */
  error: { lineId: string; message: string } | null
}

/** One column template for the header and every row, so they line up:
 *  # · item · qty · price · discount · total · void. */
const GRID = 'grid grid-cols-[1.75rem_minmax(0,1fr)_auto_4.75rem_4.75rem_6.5rem_1.75rem] items-center gap-x-2'

export default function BasketPanel({
  state,
  refusedLines,
  actions,
}: {
  state: SessionState
  /** Lines a `REBIND_REFUSED` named (167) — tinted, as well as named in the
   *  banner above the columns. */
  refusedLines: Set<string>
  /** `null` once the order is no longer open: a submitted basket has nothing to
   *  correct, and a control that would refuse is worse than no control (165). */
  actions: BasketActions | null
}) {
  const { t } = useTranslation('callcenter')
  const lines = basketLineViews(state)
  // Open lines are held by `lineId`, never by number: a void renumbers the rows
  // below it, and the detail must stay with the line the agent opened.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (lineId: string) =>
    setOpen((was) => {
      const next = new Set(was)
      if (!next.delete(lineId)) next.add(lineId)
      return next
    })

  return (
    <div className="min-h-0 flex-1 overflow-auto" data-cc-basket>
      <div className="flex items-center justify-between border-b border-divider px-4 py-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{t('basket.heading')}</span>
        <span className="flex items-center gap-2">
          {/* 🚩 The order-level fraud signal (§5.2, BackOffice 285/286), shown
              because the agent accepted it and should be able to see that they
              did — never as a warning to act on, and never client-derived: it is
              the header's own field. */}
          {state.header.hasBelowAtp && (
            <span
              className="rounded-full bg-attention-050 px-2 py-0.5 font-medium normal-case text-attention-800"
              data-cc-has-below-atp
            >
              {t('basket.hasBelowAtp')}
            </span>
          )}
          <span data-numeric>{t('basket.lineCount', { count: lines.length })}</span>
        </span>
      </div>
      {lines.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground" data-cc-basket-empty>
          {t('basket.empty')}
        </div>
      ) : (
        <div role="table" aria-label={t('basket.heading')}>
          <div
            role="row"
            className={`${GRID} border-b border-border px-4 py-1.5 text-[11px] font-semibold text-muted-foreground`}
            data-cc-basket-columns
          >
            <span role="columnheader" className="text-center">
              {t('lineGrid.col.number')}
            </span>
            <span role="columnheader">{t('lineGrid.col.item')}</span>
            <span role="columnheader">{t('lineGrid.col.qty')}</span>
            <span role="columnheader" className="text-end">
              {t('lineGrid.col.price')}
            </span>
            <span role="columnheader" className="text-end">
              {t('lineGrid.col.discount')}
            </span>
            <span role="columnheader" className="text-end">
              {t('lineGrid.col.total')}
            </span>
            <span role="columnheader" />
          </div>
          {lines.map((line) => (
            <Line
              key={line.lineId}
              line={line}
              refused={refusedLines.has(line.lineId)}
              actions={actions}
              expanded={open.has(line.lineId)}
              onToggle={() => toggle(line.lineId)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function Line({
  line,
  refused,
  actions,
  expanded,
  onToggle,
}: {
  line: BasketLineView
  refused: boolean
  actions: BasketActions | null
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation('callcenter')
  // 🚩 Every row's controls are held while ANY correction is in flight,
  // deliberately: the engine's claim is a 15 s mutual exclusion (law 7), so a
  // second verb sent on top of the first collides and is ridden out — and a
  // basket that accepted both would be showing one *Applying…* for two acts.
  const anyPending = actions?.pending != null
  const mine = actions?.pending?.lineId === line.lineId ? actions.pending : null
  const failure = actions?.error?.lineId === line.lineId ? actions.error.message : null
  const item = fsi(line.description)
  const detailId = `cc-line-pricing-${line.lineId}`

  return (
    <div
      role="rowgroup"
      className={`border-b border-divider px-4 py-2 ${refused ? 'bg-danger-050' : ''}`}
      data-cc-line={line.lineId}
      {...(refused ? { 'data-cc-line-refused': line.lineId } : {})}
    >
      <div role="row" className={GRID}>
        <span role="cell" className="text-center text-xs text-muted-foreground" data-cc-line-number={line.lineId}>
          <Ltr>{line.lineNumber}</Ltr>
        </span>

        {/* Clicking the name opens the pricing detail; the chevron is the same
            act for the keyboard, and the one that carries `aria-expanded`. */}
        <div role="cell" className="flex min-w-0 items-start gap-1">
          <IconButton
            size="compact"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            data-cc-line-expand={line.lineId}
            label={t(expanded ? 'lineGrid.collapse' : 'lineGrid.expand', { item })}
          >
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden />
          </IconButton>
          <div className="min-w-0 flex-1 cursor-pointer" onClick={onToggle}>
            {/* Wrapped, never truncated: an ellipsis lands on the CONTAINER's
                end, which under RTL cuts the start off a Latin name. */}
            <div className="break-words text-sm font-medium">
              <bdi>{line.description}</bdi>
            </div>
            {/* The quiet second line: item number, VAT class, the offer. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <span data-numeric>
                <Ltr>{line.itemNumber}</Ltr>
              </span>
              {line.vatRate !== null && (
                <span data-cc-line-vat-class={line.vatRate}>
                  {t('lineGrid.vatClass', { rate: fsi(`${line.vatRate}%`) })}
                </span>
              )}
              {/* 🚩 Keyed on POSITION, not on `offerId`: the wire really does
                  ship blank offer ids (859), and two promotions on one line
                  would then collapse into one. */}
              {line.promotions.map((promo, index) => (
                <span
                  key={`${promo.offerId}-${index}`}
                  className="font-medium text-success-800"
                  data-cc-line-promo={promo.offerId}
                >
                  <bdi>{promo.description}</bdi>
                  <span data-numeric className="ms-1">
                    <Ltr>{formatMoney(promo.amount)}</Ltr>
                  </span>
                  {/* 🚩 The amount is the OFFER's, not this line's share — said
                      when it spans lines, never apportioned here. */}
                  {promo.sharedLines > 0 && (
                    <span className="ms-1 font-normal">{t('line.promoShared', { count: promo.sharedLines })}</span>
                  )}
                </span>
              ))}
              {/* 🚩 Availability as FROZEN when the item was added (§2.1). */}
              <span data-cc-line-atp={line.lineId}>
                <AvailabilityPill availability={line.availability} keyBase="line.atp" />
              </span>
              {/* 🚩 What the agent's acceptance produced (§5.2) — the server's
                  own flag on the line, never re-derived. */}
              {line.belowAtpAtScan && (
                <span className="font-medium text-attention-800" data-cc-line-below-atp={line.lineId}>
                  {t('line.belowAtpAccepted')}
                </span>
              )}
              {refused && <span className="font-medium text-danger-800">{t('rebind.lineRefused')}</span>}
            </div>
          </div>
        </div>

        <div role="cell" className="flex items-center gap-1">
          {actions ? (
            <Stepper line={line} actions={actions} anyPending={anyPending} qtyPending={mine?.kind === 'qty'} />
          ) : (
            <span data-numeric className="text-xs text-muted-foreground" data-cc-line-qty={line.lineId}>
              <Ltr>{line.qty}</Ltr>
            </span>
          )}
          <UomControl line={line} actions={actions} disabled={anyPending} />
        </div>

        <span role="cell" data-numeric className="text-end text-xs" data-cc-line-price={line.lineId}>
          <Ltr>{formatMoney(line.unitPrice)}</Ltr>
        </span>

        {/* 🚩 Each discount condition as the server sent it — listed, never summed. */}
        <span role="cell" className="flex flex-col items-end text-xs text-attention-800" data-cc-line-discount={line.lineId}>
          {line.discounts.map((discount, index) => (
            <span key={`${discount.type}-${index}`} data-numeric>
              <Ltr>{formatMoney(discount.value)}</Ltr>
            </span>
          ))}
        </span>

        <span role="cell" className="text-end" data-cc-line-total={line.lineId}>
          <Money value={line.total} />
        </span>

        <span role="cell" className="flex justify-end">
          {actions && (
            // 🚩 No confirmation: voiding ONE line is an ordinary correction the
            // agent can undo by adding it again; §5's "are you sure" is reserved
            // for what re-prices the whole basket.
            <IconButton
              variant="danger"
              size="compact"
              onClick={() => actions.onVoid(line)}
              disabled={anyPending}
              data-cc-line-void={line.lineId}
              label={t('line.void', { item })}
            >
              {mine?.kind === 'void' ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <X className="h-3 w-3" aria-hidden />
              )}
            </IconButton>
          )}
        </span>
      </div>

      {expanded && <PricingDetail id={detailId} line={line} />}

      {/* Server warnings on the line, passed through as data (§2). */}
      {line.warnings.map((warning) => (
        <p key={warning} className="mt-1 ms-9 text-[11px] text-attention-800" data-cc-line-warning={line.lineId}>
          <bdi>{warning}</bdi>
        </p>
      ))}

      {failure && (
        <p className={`mt-1.5 ms-9 ${NOTE.danger}`} data-cc-line-error={line.lineId}>
          <bdi>{failure}</bdi>
        </p>
      )}
    </div>
  )
}

/**
 * How the line was priced (D5): basic price, each condition by name, net, VAT as
 * rate and amount, line total. Every figure is one the server sent; the rows are
 * `linePricing`'s, in its order.
 *
 * 🚩 `isStatistical` is said in WORDS: an informational condition did not move
 * the money, and drawn like the others it would be a figure to quote.
 */
function PricingDetail({ id, line }: { id: string; line: BasketLineView }) {
  const { t } = useTranslation('callcenter')
  return (
    <dl
      id={id}
      className="mt-2 ms-9 grid max-w-sm grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-0.5 rounded-md border border-divider bg-card-2 px-3 py-2 text-xs"
      aria-label={t('lineGrid.pricing.heading', { n: fsi(String(line.lineNumber)) })}
      data-cc-line-pricing={line.lineId}
      data-cc-line-why={line.lineId}
    >
      {line.pricing.map((row, index) => (
        <PricingRowView key={`${row.kind}-${index}`} row={row} />
      ))}
    </dl>
  )
}

function PricingRowView({ row }: { row: PricingRow }) {
  const { t } = useTranslation('callcenter')
  const figure = (value: number) => (
    <dd data-numeric className="text-end">
      <Ltr>{formatMoney(value)}</Ltr>
    </dd>
  )
  switch (row.kind) {
    case 'condition':
      return (
        <div className="contents" data-cc-pricing-row="condition" data-cc-condition={row.type}>
          <dt className="text-muted-foreground">
            <bdi>{row.description}</bdi>
            {row.isStatistical && <span className="ms-1">{t('line.statistical')}</span>}
          </dt>
          {figure(row.value)}
        </div>
      )
    case 'net':
      return (
        <div className="contents" data-cc-pricing-row="net">
          <dt className="border-t border-divider pt-0.5 font-medium">{t('lineGrid.pricing.net')}</dt>
          <dd data-numeric className="border-t border-divider pt-0.5 text-end font-medium">
            <Ltr>{formatMoney(row.value)}</Ltr>
          </dd>
        </div>
      )
    case 'vat':
      return (
        <div className="contents" data-cc-pricing-row="vat" data-cc-vat-rate={row.rate ?? ''}>
          <dt className="text-muted-foreground">
            {row.rate !== null
              ? t('lineGrid.pricing.vat', { rate: fsi(`${row.rate}%`) })
              : t('lineGrid.pricing.vatNoRate')}
          </dt>
          {figure(row.value)}
        </div>
      )
    case 'total':
      return (
        <div className="contents" data-cc-pricing-row="total">
          <dt className="border-t border-divider pt-0.5 font-semibold">{t('lineGrid.pricing.total')}</dt>
          <dd className="border-t border-divider pt-0.5 text-end">
            <Money value={row.value} />
          </dd>
        </div>
      )
  }
}

/**
 * − · quantity · +. The steps send a new quantity through the same verb the field
 * does; *−* is held at the last unit, because zero is a void and void has its own
 * control on the row (`nextQty`).
 */
function Stepper({
  line,
  actions,
  anyPending,
  qtyPending,
}: {
  line: BasketLineView
  actions: BasketActions
  anyPending: boolean
  qtyPending: boolean
}) {
  const { t } = useTranslation('callcenter')
  const item = fsi(line.description)
  const less = nextQty(line.qty, String(line.qty - 1))
  const more = nextQty(line.qty, String(line.qty + 1))
  return (
    <span className="inline-flex items-center gap-0.5" data-cc-line-stepper={line.lineId}>
      <IconButton
        size="compact"
        onClick={() => less !== null && actions.onQty(line, less)}
        disabled={anyPending || less === null}
        data-cc-line-less={line.lineId}
        label={t('lineGrid.less', { item })}
      >
        <Minus className="h-3 w-3" aria-hidden />
      </IconButton>
      <QtyField line={line} actions={actions} disabled={anyPending && !qtyPending} />
      <IconButton
        size="compact"
        onClick={() => more !== null && actions.onQty(line, more)}
        disabled={anyPending || more === null}
        data-cc-line-more={line.lineId}
        label={t('lineGrid.more', { item })}
      >
        <Plus className="h-3 w-3" aria-hidden />
      </IconButton>
    </span>
  )
}

/**
 * The quantity, as the engine holds it.
 *
 * 🚩 **Rendered, not patched.** The draft is kept only while this line's own
 * correction is unfinished; the moment it settles — landed, refused, or declined
 * in the sheet — the field goes back to the projection's figure. So a refusal
 * leaves nothing of itself on screen, and the number the agent reads is always
 * the number the order holds.
 */
function QtyField({
  line,
  actions,
  disabled,
}: {
  line: BasketLineView
  actions: BasketActions
  disabled: boolean
}) {
  const { t } = useTranslation('callcenter')
  const [draft, setDraft] = useState(String(line.qty))
  const pending = actions.pending?.lineId === line.lineId && actions.pending.kind === 'qty'

  useEffect(() => {
    if (!pending) setDraft(String(line.qty))
  }, [line.qty, pending])

  const commit = () => {
    // `null` is *nothing worth sending* — unchanged, unreadable, or zero-and-below
    // (which is a void, and void is its own control on this row).
    const qty = nextQty(line.qty, draft)
    if (qty === null) {
      setDraft(String(line.qty))
      return
    }
    actions.onQty(line, qty)
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        // Escape abandons the correction rather than sending it — the caller
        // said something else halfway through typing.
        if (event.key === 'Escape') {
          setDraft(String(line.qty))
          event.currentTarget.blur()
        }
      }}
      disabled={disabled}
      inputMode="numeric"
      aria-label={t('line.qty', { item: fsi(line.description) })}
      data-numeric
      data-cc-line-qty={line.lineId}
      className="w-11 shrink-0 text-center"
    />
  )
}

/**
 * The unit of measure.
 *
 * 🚩 A line with one unit gets a **word, not a select**: the options are the
 * server's list, and a control whose only choice is the one already made is the
 * same harm as a disabled one (165/167's ruling).
 */
function UomControl({
  line,
  actions,
  disabled,
}: {
  line: BasketLineView
  actions: BasketActions | null
  disabled: boolean
}) {
  const { t } = useTranslation('callcenter')
  if (!actions || line.uomOptions.length === 0)
    return (
      <span data-numeric className="shrink-0 text-[11px] text-muted-foreground" data-cc-line-uom={line.lineId}>
        <Ltr>{line.uom}</Ltr>
      </span>
    )
  return (
    <Select
      value={line.uom}
      onChange={(event) => {
        const uom = nextUom(line, event.target.value)
        if (uom) actions.onUom(line, uom)
      }}
      disabled={disabled}
      aria-label={t('line.uom', { item: fsi(line.description) })}
      data-cc-line-uom={line.lineId}
      className="w-16 shrink-0"
    >
      {line.uomOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
  )
}
