/**
 * The basket — the ordinary middle of a call (ticket 170).
 *
 * The caller changes their mind, and the basket keeps up without starting over:
 * **change a quantity**, **change a unit of measure**, **void a line**. Each is a
 * verb, each returns the whole `SessionState`, and each is therefore **rendered
 * rather than patched** — which is why the quantity field goes back to the
 * engine's figure the moment a correction is not in flight. A field that kept
 * what the agent typed after a refusal would be the console holding an opinion
 * about a basket it does not own.
 *
 * 🚩 **Nothing here adds anything up.** A line draws `lineTotal.gross` and its
 * own conditions; the receipt draws `totals`. `basket-view.ts` is what makes that
 * structural — this component is handed figures, never lines to total.
 *
 * Each line says what it costs and **why**: the store price and VAT as separate
 * things (VAT *is* a separate 15% condition, §2.1 — the same fact that makes the
 * search row's estimate read ~13% under the line beside it), plus any promotion
 * that fired on it.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import type { SessionState } from '@/core/models/callcenter'
import { formatMoney } from '@/core/util/number-format'
import Ltr from '@/core/ui/Ltr'
import AvailabilityPill from './AvailabilityPill'
import { basketLineViews, type BasketLineView } from './basket-view'
import { NOTE } from './console-notes'
import { nextQty, nextUom, type LineEdit } from './line-edit'
import Money from './Money'

/**
 * The three corrections and what they are currently saying, as one prop — the
 * shape the rail's two verbs (165) and the search panel's add (168) already use.
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
        lines.map((line) => (
          <Line
            key={line.lineId}
            line={line}
            refused={refusedLines.has(line.lineId)}
            actions={actions}
          />
        ))
      )}
    </div>
  )
}

function Line({
  line,
  refused,
  actions,
}: {
  line: BasketLineView
  refused: boolean
  actions: BasketActions | null
}) {
  const { t } = useTranslation('callcenter')
  // 🚩 Every row's controls are held while ANY correction is in flight,
  // deliberately: the engine's claim is a 15 s mutual exclusion (law 7), so a
  // second verb sent on top of the first collides and is ridden out — and a
  // basket that accepted both would be showing one *Applying…* for two acts.
  const anyPending = actions?.pending != null
  const mine = actions?.pending?.lineId === line.lineId ? actions.pending : null
  const failure = actions?.error?.lineId === line.lineId ? actions.error.message : null

  return (
    <div
      className={`border-b border-divider px-4 py-2.5 ${refused ? 'bg-danger-050' : ''}`}
      data-cc-line={line.lineId}
      {...(refused ? { 'data-cc-line-refused': line.lineId } : {})}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{line.description}</div>
          <div data-numeric className="text-xs text-muted-foreground">
            {line.itemNumber}
            {/* 🚩 What the agent's acceptance produced (§5.2). The server's own
                flag on the line, not a client re-derivation from the frozen
                figure beside it — the token is what recorded it. */}
            {line.belowAtpAtScan && (
              <span className="ms-2 font-medium text-attention-800" data-cc-line-below-atp={line.lineId}>
                {t('line.belowAtpAccepted')}
              </span>
            )}
            {refused && <span className="ms-2 font-medium text-danger-800">{t('rebind.lineRefused')}</span>}
          </div>
        </div>
        {/* 🚩 Availability as FROZEN when the item was added (§2.1), in the
            search row's own three states but labelled *at add* — so a frozen
            figure and a live one never read alike. */}
        <span data-cc-line-atp={line.lineId}>
          <AvailabilityPill availability={line.availability} keyBase="line.atp" />
        </span>
        {actions ? (
          <QtyField line={line} actions={actions} disabled={anyPending && mine?.kind !== 'qty'} />
        ) : (
          <span data-numeric className="text-xs text-muted-foreground" data-cc-line-qty={line.lineId}>
            {line.qty}
          </span>
        )}
        <UomControl line={line} actions={actions} disabled={anyPending} />
        <span data-cc-line-total={line.lineId}>
          <Money value={line.total} />
        </span>
        {actions && (
          // 🚩 No confirmation: voiding ONE line is an ordinary correction the
          // agent can undo by adding it again, and §5's "are you sure" is
          // reserved for what re-prices the whole basket. The act that throws a
          // basket away — abandon — keeps its dialog (163).
          <button
            type="button"
            onClick={() => actions.onVoid(line)}
            disabled={anyPending}
            data-cc-line-void={line.lineId}
            aria-label={t('line.void', { item: line.description })}
            title={t('line.void', { item: line.description })}
            className="shrink-0 rounded-full border border-input p-1 text-muted-foreground hover:border-danger-border hover:bg-danger-050 hover:text-danger-800 disabled:opacity-40"
          >
            {mine?.kind === 'void' ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <X className="h-3 w-3" aria-hidden />
            )}
          </button>
        )}
      </div>

      {/* 🚩 What it costs, and WHY — the store price and VAT as separate things,
          because VAT is a separate condition and is the whole reason the line
          reads above the catalogue estimate. Server text, passed through. */}
      {(line.conditions.length > 0 || line.promotions.length > 0) && (
        <div
          className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground"
          data-cc-line-why={line.lineId}
        >
          {/* 🚩 The two runs are told apart in WORDS, not by tone. The engine
              projects one discount twice — as the condition that applied it and
              as the offer that fired — and two −8.40s in a row with nothing
              between them read as two deductions. */}
          {line.conditions.length > 0 && (
            <span className="uppercase tracking-wide opacity-70">{t('line.pricedBy')}</span>
          )}
          {line.conditions.map((condition, index) => (
            <span key={`${condition.type}-${index}`} data-cc-condition={condition.type}>
              {condition.description}
              <span data-numeric className="ms-1 text-foreground/80">
                {formatMoney(condition.value)}
              </span>
              {/* An informational condition did not move the money. Said in
                  words, not by tone alone — it is a different fact, not a
                  quieter one. */}
              {condition.isStatistical && <span className="ms-1">{t('line.statistical')}</span>}
            </span>
          ))}
          {line.promotions.length > 0 && (
            <span className="uppercase tracking-wide opacity-70">{t('line.firedBy')}</span>
          )}
          {line.promotions.map((promo) => (
            <span key={promo.offerId} className="font-medium text-success-800" data-cc-line-promo={promo.offerId}>
              <Ltr>{promo.description}</Ltr>
              <span data-numeric className="ms-1">
                {formatMoney(promo.amount)}
              </span>
              {/* 🚩 The amount is the OFFER's, not this line's share of it — so a
                  promotion that spans lines says so rather than reading as this
                  line's alone. Apportioning it would be the console computing
                  money it was never given. */}
              {promo.sharedLines > 0 && (
                <span className="ms-1 font-normal">
                  {t('line.promoShared', { count: promo.sharedLines })}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Server warnings on the line, passed through as data (§2). */}
      {line.warnings.map((warning) => (
        <p key={warning} className="mt-1 text-[11px] text-attention-800" data-cc-line-warning={line.lineId}>
          {warning}
        </p>
      ))}

      {failure && (
        <p className={`mt-1.5 ${NOTE.danger}`} data-cc-line-error={line.lineId}>
          {failure}
        </p>
      )}
    </div>
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
    <input
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
      aria-label={t('line.qty', { item: line.description })}
      data-numeric
      data-cc-line-qty={line.lineId}
      className="w-12 shrink-0 rounded-md border border-input bg-card px-1.5 py-1 text-center text-xs outline-none focus:border-primary disabled:opacity-40"
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
      <span data-numeric className="w-12 shrink-0 text-xs text-muted-foreground" data-cc-line-uom={line.lineId}>
        {line.uom}
      </span>
    )
  return (
    <select
      value={line.uom}
      onChange={(event) => {
        const uom = nextUom(line, event.target.value)
        if (uom) actions.onUom(line, uom)
      }}
      disabled={disabled}
      aria-label={t('line.uom', { item: line.description })}
      data-cc-line-uom={line.lineId}
      className="w-16 shrink-0 rounded-md border border-input bg-card px-1 py-1 text-xs outline-none focus:border-primary disabled:opacity-40"
    >
      {line.uomOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}
