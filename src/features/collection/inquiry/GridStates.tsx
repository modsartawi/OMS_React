import type { ReactNode } from 'react'
import { Download, PackageSearch, TriangleAlert } from 'lucide-react'

/**
 * The small presentational pieces every Collections grid wears (ticket 255).
 *
 * They were born inside `CashCollectionsPage` at 254 and moved here the moment
 * they acquired a second and third caller — the same escalation path
 * `@/core/money.ts` took, one layer lower down: these are shared **inside the one
 * feature**, exactly as `cap.ts` is, and they do **not** graduate to `core/`
 * because no second feature wants them.
 *
 * ⚠️ This is not the shared inquiry shell 244 §1 rules out. That ruling is about
 * the screen's *shape* — the gate/toolbar/draft/grid skeleton — which stays
 * literally duplicated across the four Pages so that a fourth screen's departure
 * costs nothing. A pulsing placeholder, an empty-state illustration and a pill
 * toggle are not a shape; they are small presentational components, and three
 * hand-copies of each would drift in spacing and wording rather than in
 * structure. Each Page still composes them itself — nothing here decides what a
 * screen shows, only how one chip or one placeholder is drawn.
 */

/** Busy shimmer: a few pulsing placeholder rows, so a screen that loads on mount
 *  reads as loading rather than as empty. */
export function ListShimmer({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

/**
 * The pill every control above a Collections grid wears — shape, spacing and type
 * only, no colour. Shared so the toggles and the Export button cannot drift apart
 * in padding while claiming to read as one cluster; each control still says its
 * own border and text colour, because that is where they legitimately differ.
 */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors'

/** The resting colours: a control that is not doing anything right now. */
const PILL_IDLE = 'border-border/60 text-muted-foreground hover:bg-muted'

/**
 * One of the two pill toggles that sit above every Collections grid — **More
 * columns** and **Filter row**.
 *
 * ⚠️ `aria-pressed` rather than a checkbox: it is a toggle button whose effect is
 * immediate and visible, and its pressed state is what a screen reader has to be
 * able to hear. The icon is the caller's, so each Page still says which toggle it
 * is drawing.
 */
export function ToggleChip({
  icon,
  label,
  pressed,
  onToggle,
}: {
  icon: ReactNode
  label: string
  pressed: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pressed}
      className={`${PILL} ${pressed ? 'border-primary/40 bg-primary/10 text-primary' : PILL_IDLE}`}
    >
      {icon}
      {label}
    </button>
  )
}

/**
 * The **Export** button that sits beside the two toggles on every Collections grid
 * (ticket 258).
 *
 * ⚠️ Not a `ToggleChip` with a different icon: it is an **action**, not a state,
 * and `aria-pressed` on a button that downloads a file would tell a screen reader
 * the export is currently on. It wears the same pill so the row reads as one
 * cluster, and it is disabled — rather than hidden — while there is nothing to
 * write, so the control does not appear and vanish under the pointer between
 * searches.
 *
 * It joined this module at its **fourth** caller, which is the escalation path this
 * file's header describes; 244 §1's copied-not-extracted ruling is about the
 * screen's *shape*, not about a pill.
 */
export function ExportButton({
  label,
  onExport,
  disabled,
}: {
  label: string
  onExport: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className={`${PILL} ${PILL_IDLE} disabled:pointer-events-none disabled:opacity-50`}
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  )
}

/**
 * The amber banner that fires when a result actually **reached** the system cap —
 * the one case where rows really are missing, said out loud.
 *
 * It joined this module at its **fourth** caller — `CashCollectionsPage` (254),
 * `AcrsPage` and `CollectionAttemptsPage` (255, two at once), `DepositsPage`
 * (256) — which is the escalation path this file's own header describes: a
 * banner is not a screen *shape*, so 244 §1's copied-not-extracted ruling does
 * not reach it, and four hand-copies of the same amber chrome would drift in
 * spacing and wording rather than in structure. Each Page still owns its own sentence — the wording names
 * which filters to narrow, and those differ per screen — and its own decision
 * about *when* to draw it; only the chrome lives here.
 */
export function CapBanner({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}

/** No-results state — distinct from loading, and expected at 9am, when today has
 *  barely begun and yesterday is one date edit away. */
export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-2 text-center">
      <PackageSearch className="h-8 w-8 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{title}</div>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}
