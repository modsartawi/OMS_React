import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import type { AttemptsCriteria } from './attempts-criteria'

/**
 * Collection Attempts' filter strip (ticket 255) — From · To · Store · Collector ·
 * Reason code.
 *
 * 254's `CollectionsToolbar` plus one box; ⚠️ **copied, not extracted** (244 §1).
 * It renders a **draft** and nothing else, and only Search promotes it.
 *
 * ⚠️ **No `Limit` box.** The WPF's is deleted, not moved (244 §3).
 *
 * All three code filters are free text, matching the WPF — its Reason box is a
 * `TextEdit`, not a picker, and neither the door nor this wave carries a reason
 * list to populate one with. The per-column filter row above the grid is the
 * other half of narrowing, and it is on by default.
 */
export interface AttemptsToolbarProps {
  criteria: AttemptsCriteria
  onChange: (patch: Partial<AttemptsCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True when the applied query is anything other than the today-landing one. */
  isFiltered: boolean
}

export default function AttemptsToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
}: AttemptsToolbarProps) {
  const { t } = useTranslation('collection')

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('attempts.search.from')}
        {/* ⚠️ `required` on BOTH ends: the dates travel as a pair. The window
            applies to the device clock — the moment the collector stood in the
            pharmacy — not to the business day. */}
        <input
          type="date"
          required
          value={criteria.fromDate}
          onChange={(e) => onChange({ fromDate: e.target.value })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('attempts.search.to')}
        <input
          type="date"
          required
          value={criteria.toDate}
          onChange={(e) => onChange({ toDate: e.target.value })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('attempts.search.store')}
        <input
          type="text"
          inputMode="numeric"
          value={criteria.storeCode}
          onChange={(e) => onChange({ storeCode: e.target.value })}
          placeholder={t('attempts.search.storePlaceholder')}
          className="h-9 w-36 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('attempts.search.collector')}
        <input
          type="text"
          value={criteria.collectorStaffId}
          onChange={(e) => onChange({ collectorStaffId: e.target.value })}
          placeholder={t('attempts.search.collectorPlaceholder')}
          className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('attempts.search.reason')}
        <input
          type="text"
          value={criteria.reasonCode}
          onChange={(e) => onChange({ reasonCode: e.target.value })}
          placeholder={t('attempts.search.reasonPlaceholder')}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('attempts.search.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('attempts.search.reset')}
        </button>
      </div>

      {isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('attempts.search.filtered')}
          <button
            type="button"
            onClick={onReset}
            aria-label={t('attempts.search.clearFilter')}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}
    </form>
  )
}
