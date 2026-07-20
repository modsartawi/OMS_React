import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import type { BbyListCriteria } from './list-params'

// The BBY search toolbar (spec 061, ticket 064) — the reach beyond the active default
// to ALL BBYs. Exact BBY-number field · "active during" from/to date pickers · an
// "Active only" toggle (default on) · a dismissable "filtered" chip · Reset · Search.
// Fields AND together server-side; the pure `buildListParams` (list-params.ts) owns the
// one UX rule the client keeps: any number-or-date search forces `activeOnly:false` so a
// keyed/period lookup reaches inactive/deleted BBYs. This component only renders the
// controlled criteria and reflects that rule (the Active-only toggle goes disabled/off the
// moment a search field is filled — "searching auto-clears Active only").
//
// Dates: the raw criteria are `yyyyMMdd` (the wire shape); the native date inputs speak
// `yyyy-MM-dd`, so we convert at the input edge only.

/** `yyyyMMdd` → `yyyy-MM-dd` for a native date input (''/malformed → ''). */
function ymdToInput(ymd: string): string {
  return /^\d{8}$/.test(ymd) ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : ''
}
/** `yyyy-MM-dd` (native date input) → raw `yyyyMMdd` ('' → ''). */
function inputToYmd(value: string): string {
  return value ? value.replace(/-/g, '') : ''
}

export interface SearchToolbarProps {
  criteria: BbyListCriteria
  onChange: (patch: Partial<BbyListCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True when the applied query is anything other than the active-only default. */
  isFiltered: boolean
}

export default function SearchToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
}: SearchToolbarProps) {
  const { t } = useTranslation('bonus-buy-inquiry')

  // A number or either date is a "search" — it forces Active-only off (buildListParams
  // does this for the query; here we mirror it so the toggle reads honestly).
  const hasCriteria =
    criteria.bbyNumber.trim() !== '' ||
    criteria.validFrom.trim() !== '' ||
    criteria.validTo.trim() !== ''
  const activeOnlyChecked = hasCriteria ? false : criteria.activeOnly

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      {/* Exact BBY number */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('search.bbyNumber')}
        <input
          type="text"
          inputMode="numeric"
          value={criteria.bbyNumber}
          onChange={(e) => onChange({ bbyNumber: e.target.value })}
          placeholder={t('search.bbyNumberPlaceholder')}
          className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* "Active during" range */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('search.activeFrom')}
        <input
          type="date"
          value={ymdToInput(criteria.validFrom)}
          onChange={(e) => onChange({ validFrom: inputToYmd(e.target.value) })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('search.activeTo')}
        <input
          type="date"
          value={ymdToInput(criteria.validTo)}
          onChange={(e) => onChange({ validTo: inputToYmd(e.target.value) })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* Active-only toggle + sublabel. Overridden (disabled, forced off) once a search
          field is present — the number/date lookup reaches inactive BBYs. */}
      <label
        className={`flex select-none flex-col gap-1 text-xs font-medium ${
          hasCriteria ? 'text-muted-foreground/50' : 'text-muted-foreground'
        }`}
        title={hasCriteria ? t('search.activeOnlyOverridden') : undefined}
      >
        <span className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={activeOnlyChecked}
            disabled={hasCriteria}
            onChange={(e) => onChange({ activeOnly: e.target.checked })}
            className="h-4 w-4 rounded border-border/60 accent-primary"
          />
          {t('search.activeOnly')}
        </span>
        <span className="ps-6 text-[0.6875rem] font-normal">{t('search.activeOnlyHint')}</span>
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('search.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('search.reset')}
        </button>
      </div>

      {/* Dismissable "filtered" chip — present whenever the applied query is not the
          active-only default. Dismissing it restores that default (= Reset). */}
      {isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('search.filtered')}
          <button
            type="button"
            onClick={onReset}
            aria-label={t('search.clearFilter')}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}
    </form>
  )
}
