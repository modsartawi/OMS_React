import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

/**
 * The three small presentational pieces the branch account wears (ticket 269).
 *
 * 🚩 **Copied from `features/collection/inquiry/GridStates.tsx`, not imported** —
 * `tools/check-boundaries.mjs` reads the two collection features as two features,
 * and a feature may not import a feature. This is the **second** copy, which is
 * exactly where ticket 268's rubric says *copy* rather than *graduate*: the third
 * area is the trigger, and 268 already honoured it once for `ScreenGate`.
 *
 * ⚠️ **Only three of the neighbour's five came across**, and the two that stayed
 * behind are the argument that this is a copy rather than a drift:
 *
 * - `ExportButton` — 269 is **read-only** and exports nothing. A button that this
 *   screen has no file to hand would be dead surface waiting for someone to wire it.
 * - `EmptyState` — this screen's empty case is *"no settlement entry has ever been
 *   posted against this branch"*, which is the ordinary state of most of the estate
 *   and needs a sentence, not a full-height illustration implying a failed search.
 *
 * Whichever of these earns a **third** copy graduates to `@/core/ui` on the same
 * trigger `ScreenGate` did, rather than on a judgement call taken again from scratch.
 */

/** Busy shimmer: pulsing placeholder rows, so a screen that loads on arrival reads
 *  as loading rather than as a branch with nothing on it. */
export function AccountShimmer({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-label={label}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  )
}

/** The pill shape every control above the grid wears — shape, spacing and type
 *  only, no colour; each control still says its own border and ink. */
const PILL =
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors'

const PILL_IDLE = 'border-border/60 text-muted-foreground hover:bg-muted'

/**
 * The **Filter row** toggle above the entries grid.
 *
 * It earns its place here more than on the neighbours: this screen spends the
 * height under the grid on the journal, so reclaiming the floating-filter row is a
 * real trade a reader makes rather than a preference. `aria-pressed` rather than a
 * checkbox — it is a toggle button whose effect is immediate and visible.
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
 * The amber banner that fires when a branch's account actually **reached** the
 * door's `TOP` — the one case where entries really are missing, said out loud.
 *
 * On this screen the stakes are the account's own: a branch whose history is
 * silently cut in half is a phone call the accountant loses, because the entry being
 * quoted is one of the ones that did not arrive.
 */
export function AccountCapBanner({ message }: { message: string }) {
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
