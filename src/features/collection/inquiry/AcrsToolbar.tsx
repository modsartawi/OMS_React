import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import { ACR_STATUSES, type AcrStatusFilter, type AcrsCriteria } from './acr-criteria'
import ServedByPicker from './ServedByPicker'

/**
 * ACRs' filter strip (ticket 255) — From · To · ACR No# · Collector · Status.
 *
 * 254's `CollectionsToolbar` is the shape this follows; ⚠️ **copied, not
 * extracted** (244 §1). It renders a **draft** and nothing else: every edit
 * patches the criteria the Page holds, and only Search promotes that draft to a
 * query.
 *
 * ⚠️ **No `Limit` box.** The WPF's is deleted, not moved (244 §3).
 *
 * The one control this screen has that Cash Collections does not is the segmented
 * **Status**, replacing the WPF's `""`/`OPEN`/`CLOSED` radio group. Three states,
 * always all visible, so the current one is legible without opening anything —
 * which is what a radio group bought and a `<select>` would give back.
 */
export interface AcrsToolbarProps {
  criteria: AcrsCriteria
  onChange: (patch: Partial<AcrsCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True when the applied query is anything other than the today-landing one. */
  isFiltered: boolean
}

export default function AcrsToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
}: AcrsToolbarProps) {
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
        {t('acrs.search.from')}
        {/* ⚠️ `required` on BOTH ends: the dates travel as a pair, and a half-open
            window is not a narrower query but an unbounded one. The window applies
            to the ACR's business date, not to when it was raised. */}
        <input
          type="date"
          required
          value={criteria.fromDate}
          onChange={(e) => onChange({ fromDate: e.target.value })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('acrs.search.to')}
        <input
          type="date"
          required
          value={criteria.toDate}
          onChange={(e) => onChange({ toDate: e.target.value })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* The number a supervisor holds in their hand. Free text, like the store
          and collector codes on Cash Collections — and see `acr-criteria.ts` for
          why it travels as `AcrNumber` and never as `AcrId`. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('acrs.search.acrNumber')}
        <input
          type="text"
          inputMode="numeric"
          value={criteria.acrNumber}
          onChange={(e) => onChange({ acrNumber: e.target.value })}
          placeholder={t('acrs.search.acrNumberPlaceholder')}
          className="h-9 w-32 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      {/* 🚩 **The collector box, as the shared control** (BackOffice 1167). It is a
          replacement rather than an addition: on this screen *Served by* IS the
          collector filter — same column, same predicate for a plain pick — so
          keeping the free-text box beside it would be two boxes asking one
          question. It stays a **combobox** for the same reason it exists: a shipped
          ACR carries whoever collected, and an id off the roster must remain
          typeable.

          ⚠️ Contrast Cash Collections, where the shipped box SURVIVES and is
          relabelled "Collected by" (1166) — there the two controls genuinely ask
          different questions (assigned-to vs collected-by) and both stay lit. */}
      <ServedByPicker
        screen="acrs"
        value={criteria.servedBy}
        onChange={(servedBy) => onChange({ servedBy })}
      />

      {/* The WPF's radio group, as a segmented control. `radiogroup`/`radio` roles
          rather than buttons, because that is what it IS — one of three, exactly
          one chosen — and it is what lets a keyboard reader hear the choice. */}
      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('acrs.search.status')}
        <div
          role="radiogroup"
          aria-label={t('acrs.search.status')}
          className="inline-flex h-9 items-center rounded-full border border-border/60 bg-background p-0.5"
        >
          {ACR_STATUSES.map((status) => (
            <StatusOption
              key={status}
              status={status}
              selected={criteria.status === status}
              label={t(`acrs.search.statuses.${status}`)}
              onSelect={() => onChange({ status })}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('acrs.search.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('acrs.search.reset')}
        </button>
      </div>

      {/* The chip says the screen is no longer showing today. Dismissing it is
          Reset — one way back to the landing state, not two. */}
      {isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('acrs.search.filtered')}
          <button
            type="button"
            onClick={onReset}
            aria-label={t('acrs.search.clearFilter')}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-primary/20"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}
    </form>
  )
}

/**
 * One segment of the Status control.
 *
 * ⚠️ `type="button"`. The strip is a `<form>` whose submit is Search, and a bare
 * `<button>` inside one submits it — so choosing a status would fire a query with
 * whatever else was half-typed, which is precisely the draft/query split this
 * toolbar exists to keep.
 */
function StatusOption({
  status,
  selected,
  label,
  onSelect,
}: {
  status: AcrStatusFilter
  selected: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-status={status}
      onClick={onSelect}
      className={`h-8 rounded-full px-3 text-sm font-medium transition-colors ${
        selected ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}
