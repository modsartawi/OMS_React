import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import type { ReadyCriteria } from './ready-criteria'
import DateField from './DateField'
import NoSlipChip from './NoSlipChip'
import ServedByPicker from './ServedByPicker'
import type { NoSlipToggle } from './slips'

/**
 * Ready for collection's filter strip (ticket 317) — Business date from/to ·
 * Collector · Served by, the three filters BackOffice 1994 gives this screen.
 *
 * The siblings' toolbar shape, ⚠️ **copied, not extracted** (244 §1). It renders a
 * **draft** and nothing else; only Search promotes it.
 *
 * There is **no collection date**: nothing on this list has been collected.
 */
export interface ReadyToolbarProps {
  criteria: ReadyCriteria
  onChange: (patch: Partial<ReadyCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True when the applied query is anything other than the landing one. */
  isFiltered: boolean
  /** The "No slip" toggle (ticket 320) — absent when the session may not see slips. */
  noSlip?: NoSlipToggle
}

export default function ReadyToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
  noSlip,
}: ReadyToolbarProps) {
  const { t } = useTranslation('collection')

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      {/* The day's business day, inclusive on both ends, either end alone. A
          prepared receipt has no business day, so any bound hides receipts — the
          Page says so under the strip once such a query is issued. */}
      <DateField
        label={t('ready.search.businessDateFrom')}
        value={criteria.businessDateFrom}
        onChange={(businessDateFrom) => onChange({ businessDateFrom })}
      />
      <DateField
        label={t('ready.search.businessDateTo')}
        value={criteria.businessDateTo}
        onChange={(businessDateTo) => onChange({ businessDateTo })}
      />

      {/* The collector ASSIGNED to the store (`CollectorId`) — whose round it is on.
          Free text, as the Attempts screen's Collector box. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('ready.search.collector')}
        <input
          type="text"
          value={criteria.collectorId}
          onChange={(e) => onChange({ collectorId: e.target.value })}
          placeholder={t('ready.search.collectorPlaceholder')}
          className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* 🚩 The shared control on the ASSIGNMENT reading (`SERVED_BY_SCREENS.ready`):
          the store's CURRENT pairing. ACCOUNTANT + id is this screen's accountant
          filter. It ANDs with the Collector box. */}
      <ServedByPicker screen="ready" value={criteria.servedBy} onChange={(servedBy) => onChange({ servedBy })} />

      {/* "No slip" (ticket 320) — drawn only when the slip probe admits. */}
      <NoSlipChip toggle={noSlip} />

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('ready.search.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('ready.search.reset')}
        </button>
      </div>

      {isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('ready.search.filtered')}
          <button
            type="button"
            onClick={onReset}
            aria-label={t('ready.search.clearFilter')}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}
    </form>
  )
}
