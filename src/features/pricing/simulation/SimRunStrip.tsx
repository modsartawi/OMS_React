import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DatabaseZap, Loader2, Play } from 'lucide-react'

import { formatMoney } from '@/core/util/number-format'
import SimHeaderForm, { type SimHeaderState } from './SimHeaderForm'
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
  canProcess,
  onProcess,
  onClear,
  canClearCache,
  clearCachePending,
  onClearCache,
}: Props) {
  const { t } = useTranslation('simulation')

  // `Esc` collapses and returns focus HERE, never to the document (102 §6) — so
  // the chip set has to be reachable from inside the expansion.
  const chipSetRef = useRef<HTMLButtonElement>(null)

  function collapse() {
    onExpandedChange(false)
    // The chip set only exists once the collapsed row is back on screen.
    requestAnimationFrame(() => chipSetRef.current?.focus())
  }

  // The run controls — a terminal cluster in the collapsed row, the form's footer
  // while it is open. `Clear cache` rides along as a run control, not an
  // administrative curio: the real loop is fix in SAP → re-download → wipe cache →
  // Process. Its existing grant (ticket 051) and confirm (052) are unchanged.
  const runControls = (
    <>
      <button
        type="button"
        onClick={onProcess}
        disabled={!canProcess}
        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-50"
      >
        {pending ? (
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
        className="inline-flex h-8 items-center rounded-full border border-input px-3.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        {t('actions.clear')}
      </button>
      {canClearCache ? (
        <button
          type="button"
          onClick={onClearCache}
          disabled={pending || clearCachePending}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-input px-3.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
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

  // ---- expanded: the form replaces the collapsed row in place ---------------
  if (expanded) {
    return (
      <div
        data-run-strip="expanded"
        className="flex flex-col gap-3 border-b border-border/60 pb-3"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            collapse()
          }
        }}
      >
        <div className="flex items-center justify-end">
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
      </div>
    )
  }

  // ---- collapsed: chips · status slot · money · run controls ----------------
  return (
    <div
      data-run-strip="collapsed"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/60 pb-3"
    >
      <button
        type="button"
        ref={chipSetRef}
        data-chip-set
        aria-expanded={false}
        disabled={pending}
        onClick={() => onExpandedChange(true)}
        className="flex flex-wrap items-center gap-1.5 rounded-full border border-transparent px-1 py-0.5 text-start hover:border-input disabled:opacity-50"
      >
        {chips.map((chip, index) => (
          // A chip is a readout: a plain span, no hover, no cursor, never a button.
          <span
            key={index}
            data-chip
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            {chip.kind === 'keyed' ? (
              <>
                <span className="text-[10px] font-bold tracking-wider">
                  {t(`strip.key.${chip.key}`)}
                </span>
                <span className="font-medium text-foreground">{chip.value}</span>
              </>
            ) : null}
            {chip.kind === 'date' ? <span className="font-medium text-foreground">{chip.value}</span> : null}
            {chip.kind === 'promo' ? (
              <span className="text-[10px] font-bold tracking-wider">
                {t(chip.on ? 'strip.promoOn' : 'strip.promoOff')}
              </span>
            ) : null}
            {/* The elements flag chips only when on, so its presence IS its state
                and it carries no value slot (run-chips.ts). */}
            {chip.kind === 'flag' ? (
              <span className="text-[10px] font-bold tracking-wider">{t('strip.key.elem')}</span>
            ) : null}
          </span>
        ))}
        <span className="ps-1 text-xs font-medium text-muted-foreground">{t('strip.edit')}</span>
      </button>

      {/* The status slot — one place, three states (absent · stale · in flight).
          Empty until ticket 114 fills it; the placeholder holds its source order
          so the slot can never wrap away from the chips it comments on. */}
      <span data-status-slot />

      {money ? (
        <div className="ms-auto flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {/* Money keeps emphasis by WEIGHT, not by border or size. */}
          <span className="text-base font-semibold tabular-nums tracking-tight">
            <span className="me-1.5 text-[10px] font-medium tracking-wide text-muted-foreground">
              {t('strip.netTotal')}
            </span>
            {formatMoney(money.netTotal)}
            <span className="ms-1 text-xs font-normal text-muted-foreground">{money.currency}</span>
          </span>
          <span className="text-sm font-medium tabular-nums text-danger-800">
            <span className="me-1 text-[10px] font-medium tracking-wide text-muted-foreground">
              {t('summary.totalDiscount')}
            </span>
            {formatMoney(money.totalDiscount)}
          </span>
          <span className="text-sm font-medium tabular-nums text-primary-800">
            <span className="me-1 text-[10px] font-medium tracking-wide text-muted-foreground">
              {t('summary.tax')}
            </span>
            {formatMoney(money.taxValue)}
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t('summary.calc', { ms: money.elapsedMs })}
          </span>
        </div>
      ) : null}

      {/* The run controls are a terminal cluster, separated by a rule. `ms-auto`
          when no money precedes them, so the cluster still ends the row. */}
      <div
        className={`flex items-center gap-2 border-s border-border/60 ps-3 ${money ? '' : 'ms-auto'}`}
      >
        {runControls}
      </div>
    </div>
  )
}
