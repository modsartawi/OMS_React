import type { ReactNode } from 'react'
import { PackageSearch } from 'lucide-react'

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        pressed
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-border/60 text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
    </button>
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
