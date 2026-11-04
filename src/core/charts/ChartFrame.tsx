import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

/**
 * The per-panel loading frame (spec 766 §F, the owner's ask of 2026-11-04; prototype `01286f77`).
 * Recharts has no loading state, so the wrapper owns it. While the panel's query runs:
 *
 * - the previous chart stays, DIMMED — the panel never blanks;
 * - a spinner and an "Updating…" label show, and an indeterminate bar runs along the top edge;
 * - `aria-busy` is set on the frame.
 *
 * The caller passes `busy` from its query's `isFetching` and keeps the previous answer on screen with
 * TanStack Query's `placeholderData: keepPreviousData`. With nothing drawn yet (`hasChart` false) the
 * frame shows the loading words in place of the chart.
 *
 * The board's filter strip ("Updating… n of N panels", 771) counts these frames' `busy`; it is not here.
 */
export default function ChartFrame({
  busy,
  hasChart,
  children,
  className = '',
}: {
  busy: boolean
  hasChart: boolean
  children?: ReactNode
  className?: string
}) {
  const { t } = useTranslation('common')
  return (
    <div className={`relative ${className}`} aria-busy={busy} data-chart-frame={busy ? 'busy' : 'idle'}>
      {busy && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden" aria-hidden data-chart-progress>
          {/* The global sweep (`--animate-indeterminate`): machine motion, not text, so it does not mirror. */}
          <div className="h-full w-1/4 animate-indeterminate bg-primary" />
        </div>
      )}
      {busy && hasChart && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground shadow-pop"
            role="status"
            data-chart-updating
          >
            <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden />
            {t('charts.updating')}
          </span>
        </div>
      )}
      {hasChart ? (
        <div className={`transition-opacity duration-300 ${busy ? 'pointer-events-none opacity-35' : ''}`}>{children}</div>
      ) : (
        <div className="flex h-72 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t('charts.loading')}
        </div>
      )}
    </div>
  )
}
