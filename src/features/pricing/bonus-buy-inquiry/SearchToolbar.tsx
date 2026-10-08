import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import { BBY_STATUS_WORDS, searchOverrides, type BbyListCriteria, type BbyStatusWord } from './list-params'

// The BBY search toolbar (spec 061, ticket 064; reshaped by spec 441, ticket 443): exact
// BBY-number field · Status chips (Activated · Planned · Tested · Deactivated; none = every
// status) · "valid during" from/to date pickers · a "Valid today" checkbox · a dismissable
// "filtered" chip · Reset · Search. Fields AND together server-side; the pure
// `buildListParams` (list-params.ts) owns the override rules: a number reaches any status
// and window, and a date range replaces valid today. This component only renders the
// controlled criteria and shows those rules honestly (the overridden controls disable).
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
  /** True when the applied search is anything other than Activated + valid today. */
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

  // The controls a search ignores read as overridden: the same `searchOverrides` the builder
  // applies, so the toolbar and the query cannot disagree.
  const statusLabelId = useId()
  const overrides = searchOverrides(criteria)
  const hasNumber = overrides.status
  const validTodayOverridden = overrides.validToday
  const validTodayChecked = validTodayOverridden ? false : criteria.validToday
  const toggleStatus = (word: BbyStatusWord) =>
    onChange({
      statuses: criteria.statuses.includes(word)
        ? criteria.statuses.filter((w) => w !== word)
        : [...criteria.statuses, word],
    })

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

      {/* Status chips — none pressed means every status. Overridden by a number search. */}
      <div
        role="group"
        aria-labelledby={statusLabelId}
        className={`flex flex-col gap-1 text-xs font-medium ${hasNumber ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}
        title={hasNumber ? t('search.overriddenByNumber') : undefined}
      >
        <span id={statusLabelId}>{t('search.status')}</span>
        <div className="flex h-9 items-center gap-1.5">
          {BBY_STATUS_WORDS.map((word) => {
            // Overridden chips read as off, like the overridden Valid-today checkbox: a number
            // search sends no status, so none is "on".
            const pressed = !hasNumber && criteria.statuses.includes(word)
            return (
              <button
                key={word}
                type="button"
                aria-pressed={pressed}
                disabled={hasNumber}
                title={hasNumber ? t('search.overriddenByNumber') : undefined}
                onClick={() => toggleStatus(word)}
                className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  pressed
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/60 text-muted-foreground hover:bg-muted'
                }`}
              >
                {t(`status.${word}`)}
              </button>
            )
          })}
        </div>
      </div>

      {/* "Valid during" range */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('search.validFrom')}
        <input
          type="date"
          value={ymdToInput(criteria.validFrom)}
          onChange={(e) => onChange({ validFrom: inputToYmd(e.target.value) })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('search.validTo')}
        <input
          type="date"
          value={ymdToInput(criteria.validTo)}
          onChange={(e) => onChange({ validTo: inputToYmd(e.target.value) })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* Valid-today checkbox + sublabel. Overridden (disabled, shown off) by a number,
          which reaches any window, or by a date range, which replaces "today". */}
      <label
        className={`flex select-none flex-col gap-1 text-xs font-medium ${
          validTodayOverridden ? 'text-muted-foreground/50' : 'text-muted-foreground'
        }`}
        title={
          hasNumber
            ? t('search.overriddenByNumber')
            : validTodayOverridden
              ? t('search.validTodayOverriddenByDates')
              : undefined
        }
      >
        <span className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={validTodayChecked}
            disabled={validTodayOverridden}
            onChange={(e) => onChange({ validToday: e.target.checked })}
            className="h-4 w-4 rounded border-border/60 accent-primary"
          />
          {t('search.validToday')}
        </span>
        <span className="ps-6 text-[0.6875rem] font-normal">{t('search.validTodayHint')}</span>
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
          default (Activated + valid today). Dismissing it restores that default (= Reset). */}
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
