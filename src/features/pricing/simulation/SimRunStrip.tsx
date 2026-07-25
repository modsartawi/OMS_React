import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DatabaseZap, Loader2, Play } from 'lucide-react'

import { formatMoney } from '@/core/util/number-format'
import SimHeaderForm, { type SimHeaderState } from './SimHeaderForm'
import SimStatusSlot, { useSpinnerVisible } from './SimStatusSlot'
import type { RunChip } from './run-chips'

/**
 * The run strip (ticket 113, slice 0 of the rework spec 110; drawn in prototype
 * 102) — the header form, the Summary tile and the Actions card dissolved into
 * ONE unframed row carrying four groups in source order:
 *
 *   chip set · status slot (empty until ticket 114) · money readout · run controls
 *
 * Nothing is sticky: at the density the 098 captures show, nothing scrolls, and a
 * pinned band would spend permanent vertical space on a case the data has never
 * produced.
 *
 * The chip set **is** the control (100 §3): one `<button>` wrapping chip `<span>`s
 * and ending in a visible `Edit ▾` tail — one tab stop for seven fields and two
 * checkboxes, one `aria-expanded`. Individual chips have no hover state, no cursor
 * change, and are never buttons, anywhere on this screen; that is what makes "a
 * chip is a readout" enforceable rather than aspirational.
 *
 * Expanding **replaces the collapsed row in place**, so nothing below moves except
 * by the form's own height. Expanded, the control reads `Done ▴`; Process / Clear /
 * Wipe cache move into the form's footer so the run loop is never more than one
 * control away; and the money readout is **removed, not moved** — a total belongs
 * to a run, and once you are editing you are no longer looking at that run's inputs.
 *
 * Collapse/expand is the Page's state (it collapses on every Process); this
 * component owns only the focus choreography that goes with it.
 */

/** The tiny uppercase key a chip or a money pair wears. Authored uppercase in the
 *  JSON value, never by a CSS transform — a transform is a no-op on Arabic. */
const chipKey = 'text-[10px] font-bold tracking-wider'
const moneyKey = 'text-[10px] font-medium tracking-wide text-muted-foreground'

/** A secondary money figure behind its key — discount and tax read identically. */
function pair(label: string, value: string) {
  return (
    <span className="text-sm font-medium tabular-nums">
      <span className={`${moneyKey} me-1`}>{label}</span>
      {value}
    </span>
  )
}

/** A chip's identity, for React's list key: one chip per kind+key on any run. */
function chipId(chip: RunChip): string {
  return chip.kind === 'date' || chip.kind === 'promo' ? chip.kind : `${chip.kind}:${chip.key}`
}

/** The run's headline figures, absent before the first Process and after a failure. */
export interface RunMoney {
  netTotal: number
  currency: string
  totalDiscount: number
  taxValue: number
  elapsedMs: number
}

interface Props {
  chips: RunChip[]
  header: SimHeaderState
  onHeaderChange: (patch: Partial<SimHeaderState>) => void
  promotion: boolean
  pricingElements: boolean
  onPromotionChange: (next: boolean) => void
  onPricingElementsChange: (next: boolean) => void
  expanded: boolean
  onExpandedChange: (next: boolean) => void
  money: RunMoney | null
  pending: boolean
  /** The inputs no longer describe the on-screen result (`staleness.ts`, 114). */
  stale: boolean
  canProcess: boolean
  onProcess: () => void
  onClear: () => void
  canClearCache: boolean
  clearCachePending: boolean
  onClearCache: () => void
}

export default function SimRunStrip({
  chips,
  header,
  onHeaderChange,
  promotion,
  pricingElements,
  onPromotionChange,
  onPricingElementsChange,
  expanded,
  onExpandedChange,
  money,
  pending,
  stale,
  canProcess,
  onProcess,
  onClear,
  canClearCache,
  clearCachePending,
  onClearCache,
}: Props) {
  const { t } = useTranslation('simulation')

  // One waiting, one timer: the status slot's spinner and the Process button's
  // both wait 150 ms (ticket 114), so an ordinary 184–268 ms run shows neither.
  const spinner = useSpinnerVisible(pending)

  // `Esc` collapses and returns focus HERE, never to the document (102 §6) — so
  // the chip set has to be reachable from inside the expansion.
  const chipSetRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  function collapse() {
    returnFocus.current = true
    onExpandedChange(false)
  }

  // Focus lands in an effect, not in a `requestAnimationFrame` after the click:
  // the effect runs once the collapsed row is COMMITTED, so the ref is never
  // null and focus can never fall through to the document.
  useEffect(() => {
    if (!expanded && returnFocus.current) {
      returnFocus.current = false
      chipSetRef.current?.focus()
    }
  }, [expanded])

  // `Esc` collapses from ANYWHERE while the form is open — not only from inside
  // it. The analyst can be typing in the items grid with the form still up, and
  // an `Esc` that depended on where focus sat would be a rule with a hole in it.
  useEffect(() => {
    if (!expanded) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') collapse()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded])

  // The run controls — a terminal cluster in the collapsed row, the form's footer
  // while it is open. `Clear cache` rides along as a run control, not an
  // administrative curio: the real loop is fix in SAP → re-download → wipe cache →
  // Process. Its existing grant (ticket 051) and confirm (052) are unchanged.
  // TICKET 119 — the `@max-[900px]/work` variants below TIGHTEN, they never hide. The
  // tail (money + controls) measures ~808 px at its roomy spacing, which is 28 px more
  // than the 780 px floor has, and a tail that wrapped internally would put the strip
  // on a third row. Every figure, every control and the shortcut signpost survive at
  // every width; what narrows is padding. Arrangement, never disclosure.
  const runControls = (
    <>
      <button
        type="button"
        onClick={onProcess}
        disabled={!canProcess}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50 @[900px]/work:px-4"
      >
        {/* The icon swaps on the SHARED 150 ms flag, not on `pending` — a spinner
            that flashed here while the slot held still would be two answers to
            the same question. `▶ Process` does not mirror (spec 110's RTL pass). */}
        {spinner ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <Play className="h-4 w-4" aria-hidden />
        )}
        {pending ? t('actions.processing') : t('actions.process')}
        {/* The Ctrl+Enter shortcut, signposted on the button itself (102 §6). A
            glyph pair, not copy — no key, nothing to translate. */}
        <span aria-hidden className="rounded-sm bg-primary-foreground/20 px-1 text-[10px]">
          ⌃⏎
        </span>
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={pending}
        className="inline-flex h-8 items-center rounded-full border border-input px-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 @[900px]/work:px-3.5"
      >
        {t('actions.clear')}
      </button>
      {canClearCache ? (
        <button
          type="button"
          onClick={onClearCache}
          disabled={pending || clearCachePending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input px-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 @[900px]/work:px-3.5"
        >
          {clearCachePending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <DatabaseZap className="h-4 w-4" aria-hidden />
          )}
          {t('clearCache.button')}
        </button>
      ) : null}
    </>
  )

  // An indeterminate hairline along the strip's OWN bottom edge while a run is
  // out (114) — absolutely positioned inside the border, so waiting introduces no
  // new region and no layout shift. It rides the same 150 ms gate as the spinners:
  // a bar that appeared and vanished inside 200 ms would be a blink, not feedback.
  const hairline = spinner ? (
    <span
      data-run-hairline
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
    >
      {/* The travelling segment. Its animation is a physical translate — the one
          direction-bound exception on this strip (spec 110's RTL pass): a
          progress sweep reads left-to-right as a machine motion, not as text. */}
      <span className="absolute inset-y-0 w-1/3 animate-indeterminate bg-primary/60" />
    </span>
  ) : null

  // ---- expanded: the form replaces the collapsed row in place ---------------
  if (expanded) {
    return (
      <div
        data-run-strip="expanded"
        className="relative flex flex-col gap-3 border-b border-border/60 pb-3"
      >
        {/* The slot comes with the expansion — the open form is where the inputs
            actually change, so a strip that dropped the mark while editing would
            lose it exactly when it is being earned. The MONEY is the only group
            the expansion removes (113). */}
        <div className="flex items-center justify-between gap-3">
          <SimStatusSlot pending={pending} stale={stale} spinner={spinner} />
          <button
            type="button"
            data-chip-set
            aria-expanded
            onClick={collapse}
            className="rounded-full px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t('strip.done')}
          </button>
        </div>

        <SimHeaderForm
          value={header}
          onChange={onHeaderChange}
          promotion={promotion}
          pricingElements={pricingElements}
          onPromotionChange={onPromotionChange}
          onPricingElementsChange={onPricingElementsChange}
          disabled={pending}
          autoFocusFirstField
        />

        <div className="flex flex-wrap items-center gap-2">{runControls}</div>
        {hairline}
      </div>
    )
  }

  // ---- collapsed: chips · status slot · money · run controls ----------------
  //
  // TICKET 119 — THE STRIP CANNOT FRAGMENT PAST TWO ROWS. The four groups wrap as
  // UNITS, in two pairs, rather than as four independent flex children that find their
  // own rows: the status slot must never wrap away from the chips it is commenting on,
  // and the money-and-controls tail travels together. So the strip is two wrapping
  // halves — `head` (chips · status) and `tail` (money · controls) — which is at most
  // two rows however narrow the work area gets, down to the 780 px floor.
  //
  // Chips themselves never scroll and never truncate: their content is a bounded domain
  // (a plant, a channel, a procedure key) precisely so that is possible, so a chip wraps
  // to the next line whole rather than eliding. That wrapping happens INSIDE the head,
  // which is why the head is the unit and not the chip.
  return (
    <div
      data-run-strip="collapsed"
      className="relative flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-3"
    >
      <div data-strip-group="head" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          ref={chipSetRef}
          data-chip-set
          aria-expanded={false}
          disabled={pending}
          onClick={() => onExpandedChange(true)}
          className="flex flex-wrap items-center gap-1.5 rounded-full border border-transparent px-1 py-0.5 text-start hover:border-input disabled:opacity-50"
        >
          {chips.map((chip) => (
            // A chip is a readout: a plain span, no hover, no cursor, never a button.
            // Neutral ground, always — hue on this screen is reserved for severity
            // (100 §2), and "promotion is on" is an input value, not a severity.
            <span
              key={chipId(chip)}
              data-chip
              // `whitespace-nowrap`: a chip wraps to the next line WHOLE or not at all
              // (ticket 119). It never truncates and it never breaks across two lines —
              // half a procedure key is a misreading waiting to happen, and the domain
              // is bounded precisely so it does not have to.
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {chip.kind === 'keyed' ? (
                <>
                  <span className={chipKey}>{t(`strip.key.${chip.key}`)}</span>
                  <span className="font-medium text-foreground">{chip.value}</span>
                </>
              ) : null}
              {chip.kind === 'date' ? (
                <span className="font-medium text-foreground">{chip.value}</span>
              ) : null}
              {/* The flag's state is not a code, so it is one authored phrase per
                  state rather than a key with a value slot (123's ledger). */}
              {chip.kind === 'promo' ? (
                <span className={chipKey}>{t(chip.on ? 'strip.promoOn' : 'strip.promoOff')}</span>
              ) : null}
              {/* The elements flag chips only when on, so its presence IS its state
                  and it carries no value slot (run-chips.ts). */}
              {chip.kind === 'flag' ? (
                <span className={chipKey}>{t(`strip.key.${chip.key}`)}</span>
              ) : null}
            </span>
          ))}
          <span className="ps-1 text-xs font-medium text-muted-foreground">{t('strip.edit')}</span>
        </button>

        {/* The status slot (ticket 114) — one place, three states (absent · stale ·
            in flight), sitting immediately after the chips it comments on, and inside
            the same wrapping unit so it can never be commenting on chips a row away. */}
        <SimStatusSlot pending={pending} stale={stale} spinner={spinner} />
      </div>

      {/* The tail: money and run controls travel TOGETHER (ticket 119). `ms-auto`
          pushes the pair to the far end on one row and lets it drop as one unit to the
          second when the head fills the first. */}
      <div
        data-strip-group="tail"
        className="ms-auto flex flex-wrap items-center gap-x-2 gap-y-2 @[900px]/work:gap-x-3"
      >
        {money ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 @[900px]/work:gap-x-4">
            {/* Net total keeps its emphasis by WEIGHT — semibold beside three smaller
                keyed pairs — never by border, size or hue. The discount and the tax
                lost the tint the Summary tile gave them: the screen's whole hue
                budget is two (success on a fire, attention on a `W` line, 100 §2),
                and a figure that is merely negative is not a severity. */}
            <span className="text-base font-semibold tabular-nums tracking-tight">
              <span className={`${moneyKey} me-1.5`}>{t('strip.netTotal')}</span>
              {formatMoney(money.netTotal)}
              <span className="ms-1 text-xs font-normal text-muted-foreground">
                {money.currency}
              </span>
            </span>
            {pair(t('summary.totalDiscount'), formatMoney(money.totalDiscount))}
            {pair(t('summary.tax'), formatMoney(money.taxValue))}
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {t('summary.calc', { ms: money.elapsedMs })}
            </span>
          </div>
        ) : null}

        {/* The run controls end the tail, separated from the money by a rule — which is
            absent when there is no money to separate them from, rather than hanging off
            the start of the group. */}
        <div
          className={`flex items-center gap-1.5 @[900px]/work:gap-2 ${money ? 'border-s border-border/60 ps-2 @[900px]/work:ps-3' : ''}`}
        >
          {runControls}
        </div>
      </div>

      {hairline}
    </div>
  )
}
