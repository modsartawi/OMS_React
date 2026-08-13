import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import { isAcrScoped } from './acr-scope'
import type { CollectionsCriteria } from './collections-criteria'
import ServedByPicker from './ServedByPicker'
import { NO_SERVED_BY } from './served-by'

/**
 * Cash Collections' filter strip (ticket 254) — From · To · Store · Collected by ·
 * Served by, and the template 255 and 256 copy.
 *
 * 🚩 **Three filters, and they all AND** (BackOffice 1166). *Served by* resolves to
 * a set of branches, Store names one, "Collected by" names a person off the
 * document itself — and no control here silently un-sets another, even when the
 * combination can only return nothing. A filter that quietly clears its neighbour
 * is how a grid ends up showing rows the toolbar says it excluded.
 *
 * It renders a **draft** and nothing else: every edit patches the criteria the
 * Page holds, and only Search promotes that draft to a query. So a half-typed
 * store code cannot fire a request, and the grid under the strip keeps showing
 * the result of the search that was actually asked for.
 *
 * ⚠️ **No `Limit` box.** The WPF's is deleted, not moved — it truncated an
 * ordinary HQ-wide day at 200 rows and said nothing (244 §3). What replaced it is
 * a system cap and the amber banner above the grid.
 *
 * The dates are `yyyy-MM-dd` throughout — the criteria shape, the native input's
 * value and the endpoint's `DateTime?` binding all agree, so there is no
 * conversion at this edge (unlike BBY, whose wire shape is `yyyyMMdd`).
 *
 * ⚠️ **The `?acr=` chip overrides and disables all four inputs** (ticket 257), and
 * the disabling is honesty rather than decoration: the server treats `AcrId` as an
 * **exclusive** filter and ignores store, collector and period entirely when one
 * is set. A live date input over a scoped result would let a supervisor set a
 * range that silently does nothing, and then read the answer as if it had applied.
 */
export interface CollectionsToolbarProps {
  criteria: CollectionsCriteria
  onChange: (patch: Partial<CollectionsCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True when the applied query is anything other than the today-landing one. */
  isFiltered: boolean
  /** The ACR this view is scoped to, or `''` for the ordinary screen (257). */
  scopedAcrId: string
  /** Drop the `?acr=` param and return to the ordinary today-filtered screen. */
  onClearScope: () => void
}

/** What an overridden control looks like: visibly out of play, and unfocusable —
 *  `disabled` is what makes the honesty real rather than only visual. */
const DISABLED_CLASS = 'disabled:cursor-not-allowed disabled:opacity-50'

/**
 * What an overridden input SHOWS: nothing.
 *
 * ⚠️ **Overridden, not merely locked.** A greyed-out box still reading
 * `2026-08-08 → 2026-08-08` over a grid scoped to an ACR that spans three weeks
 * says "this period was applied and then frozen", which is the exact misreading
 * the disabling exists to prevent — the door discarded it. Empty is the true
 * account. The criteria themselves are untouched underneath, which is what lets
 * clearing the chip put them straight back.
 */
const overridden = (scoped: boolean, value: string) => (scoped ? '' : value)

export default function CollectionsToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
  scopedAcrId,
  onClearScope,
}: CollectionsToolbarProps) {
  const { t } = useTranslation('collection')
  const scoped = isAcrScoped(scopedAcrId)

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('collections.search.from')}
        {/* ⚠️ `required` on BOTH ends: the dates travel as a pair, and a half-open
            window is not a narrower query but an unbounded one. The builder drops
            a broken pair as a backstop; this is what stops it being broken. */}
        <input
          type="date"
          required
          disabled={scoped}
          value={overridden(scoped, criteria.fromDate)}
          onChange={(e) => onChange({ fromDate: e.target.value })}
          className={`h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none ${DISABLED_CLASS}`}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('collections.search.to')}
        <input
          type="date"
          required
          disabled={scoped}
          value={overridden(scoped, criteria.toDate)}
          onChange={(e) => onChange({ toDate: e.target.value })}
          className={`h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none ${DISABLED_CLASS}`}
        />
      </label>

      {/* Store and "Collected by" are the endpoint's own two code filters. Free-text
          codes, not pickers: neither the door nor this wave carries a store or
          staff list, and inventing one would be a screen's worth of work to
          narrow a result the per-column filter row already narrows. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('collections.search.store')}
        <input
          type="text"
          inputMode="numeric"
          disabled={scoped}
          value={overridden(scoped, criteria.storeId)}
          onChange={(e) => onChange({ storeId: e.target.value })}
          placeholder={t('collections.search.storePlaceholder')}
          className={`h-9 w-36 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none ${DISABLED_CLASS}`}
        />
      </label>
      {/* 🚩 **"Collected by", not "Collector"** (BackOffice 1166). Same box, same
          `CollectorOperatorId` parameter, same free-text behaviour — the label is
          the whole change, and it is what stops the two people-filters on this one
          toolbar reading as duplicates of each other. This one asks *who actually
          turned up and took the cash*, off the receipt's own column; *Served by*
          beside it asks *who is assigned to the branch*. A stand-in covering
          somebody's route is exactly when the two disagree, which is why both
          survive rather than one replacing the other. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('collections.search.collectedBy')}
        <input
          type="text"
          disabled={scoped}
          value={overridden(scoped, criteria.collectorOperatorId)}
          onChange={(e) => onChange({ collectorOperatorId: e.target.value })}
          placeholder={t('collections.search.collectedByPlaceholder')}
          className={`h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none ${DISABLED_CLASS}`}
        />
      </label>

      {/* The shared *Served by* control (BackOffice tracer 1163).
          ⚠️ It sits BESIDE the collector box, it does not replace it: that box is
          *who actually collected*, this is *who is assigned to the branch*, and a
          stand-in covering somebody's route is exactly when the two diverge. They
          AND — and they AND **even to nothing**, both filters visibly live, because
          a filter that silently un-sets another is how a grid ends up showing rows
          the toolbar says it excluded.
          It is disabled under the `?acr=` chip with the rest, for that chip's own
          reason: the server discards the toolbar entirely when an ACR is scoped. */}
      <ServedByPicker
        screen="collections"
        value={scoped ? NO_SERVED_BY : criteria.servedBy}
        onChange={(servedBy) => onChange({ servedBy })}
        disabled={scoped}
      />

      <div className="flex items-center gap-2">
        {/* Search goes with them. With all four criteria overridden there is
            nothing left to promote, and a button that re-issues the identical
            scoped query would be the same lie the live inputs would tell. */}
        <button
          type="submit"
          disabled={scoped}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 ${DISABLED_CLASS}`}
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('collections.search.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('collections.search.reset')}
        </button>
      </div>

      {/* The `?acr=` chip (ticket 257). It names the ACR the view is scoped to and
          its ✕ drops the param — the one way back to the ordinary screen. It
          REPLACES the Filtered chip rather than sitting beside it: two chips over
          one grid would be two different accounts of why it is narrowed, and the
          scope is the true one. */}
      {scoped && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('collections.acrScope.label')}
          <span className="font-mono text-[11px]">{scopedAcrId}</span>
          <button
            type="button"
            onClick={onClearScope}
            aria-label={t('collections.acrScope.clear')}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}

      {/* The chip says the screen is no longer showing today. Dismissing it is
          Reset — one way back to the landing state, not two. */}
      {!scoped && isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('collections.search.filtered')}
          <button
            type="button"
            onClick={onReset}
            aria-label={t('collections.search.clearFilter')}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}
    </form>
  )
}
