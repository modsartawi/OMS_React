import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import { ACR_STATUSES, type AcrStatusFilter, type AcrsCriteria } from './acr-criteria'
import DateField from './DateField'
import ServedByPicker from './ServedByPicker'

/**
 * ACRs' filter strip (ticket 255) — Business date from/to · Collection date
 * from/to (ticket 316) · ACR No# · Collector text · Served by · Status · Amount
 * from/to · Profit center (ticket 425, BackOffice 2426).
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
  /** True when a Search was issued and it is anything other than the empty landing's. */
  isFiltered: boolean
}

const TEXT_INPUT_CLASS =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** One end of the Amount range: a decimal typed as text and sent as typed. */
function AmountField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="text"
        dir="ltr"
        inputMode="decimal"
        title={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${TEXT_INPUT_CLASS} w-32 text-end tabular-nums`}
      />
    </label>
  )
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
      {/* 🚩 Two ranges, named by what they mean HERE (ticket 316, BackOffice 1993):
          the business date is the ACR's own date — the window this screen has
          always had — and the collection date is when ANY of its collections was
          taken. They AND, neither clears the other, and no end is required. */}
      <DateField
        label={t('acrs.search.businessDateFrom')}
        value={criteria.businessDateFrom}
        onChange={(businessDateFrom) => onChange({ businessDateFrom })}
      />
      <DateField
        label={t('acrs.search.businessDateTo')}
        value={criteria.businessDateTo}
        onChange={(businessDateTo) => onChange({ businessDateTo })}
      />
      <DateField
        label={t('acrs.search.collectionDateFrom')}
        value={criteria.collectionDateFrom}
        onChange={(collectionDateFrom) => onChange({ collectionDateFrom })}
      />
      <DateField
        label={t('acrs.search.collectionDateTo')}
        value={criteria.collectionDateTo}
        onChange={(collectionDateTo) => onChange({ collectionDateTo })}
      />

      {/* The number a supervisor holds in their hand — see `acr-criteria.ts` for
          why it travels as `AcrNumber` and never as `AcrId`. 🚩 A TEXT box since
          spec 2423 (ADR 0066): `6498-2610-0001`, `2610-0001` or `0001`, sent as
          typed. No `pattern`, no parsing here — the server reads every form and
          refuses a malformed one, shown in the error banner. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('acrs.search.acrNumber')}
        <input
          type="text"
          dir="ltr"
          title={t('acrs.search.acrNumberHint')}
          value={criteria.acrNumber}
          onChange={(e) => onChange({ acrNumber: e.target.value })}
          placeholder={t('acrs.search.acrNumberPlaceholder')}
          className={`${TEXT_INPUT_CLASS} w-40 font-mono`}
        />
      </label>
      {/* Collector (BackOffice 2426): a contains match on the collector's id OR
          name. It ANDs with Served by — the picker asks whose scope, this box asks
          whose name — and it narrows a bare `0001` to one collector's month. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('acrs.search.collectorText')}
        <input
          type="text"
          value={criteria.collectorText}
          onChange={(e) => onChange({ collectorText: e.target.value })}
          placeholder={t('acrs.search.collectorTextPlaceholder')}
          className={`${TEXT_INPUT_CLASS} w-40`}
        />
      </label>
      {/* 🚩 **The collector box, as the shared control** (BackOffice 1167). It is a
          replacement rather than an addition: on this screen *Served by* IS the
          collector filter — same column, same predicate for a plain pick — so
          keeping the free-text box beside it would be two boxes asking one
          question. It stays a **combobox** for the same reason it exists: a shipped
          ACR carries whoever collected, and an id off the roster must remain
          typeable.

          🚩 Spec 2423 put a Collector TEXT box back beside it (BackOffice 2426), and
          it is not the box 1167 removed: that one asked the exact id, which the
          picker's typed id still does; this one is a CONTAINS match on the id or the
          name, for finance who know part of a name. The two AND.

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

      {/* Amount (BackOffice 2426): the banked total — Σ net collected, the grid's
          Net Collected — both ends inclusive and either optional. A From above its
          To goes to the door, which refuses it.
          🚩 Text, not `type="number"` (423's finding): a number input hands back `''`
          for what it cannot parse, so the filter would be dropped silently while the
          box still showed it. */}
      <AmountField
        label={t('acrs.search.amountFrom')}
        hint={t('acrs.search.amountHint')}
        value={criteria.amountFrom}
        onChange={(amountFrom) => onChange({ amountFrom })}
      />
      <AmountField
        label={t('acrs.search.amountTo')}
        hint={t('acrs.search.amountHint')}
        value={criteria.amountTo}
        onChange={(amountTo) => onChange({ amountTo })}
      />

      {/* Profit center (BackOffice 2426): a contains match, so `019` finds `PH-019`.
          An ACR carries no store: it matches when ANY linked collection's branch
          does. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('acrs.search.profitCenter')}
        <input
          type="text"
          dir="ltr"
          value={criteria.profitCenter}
          onChange={(e) => onChange({ profitCenter: e.target.value })}
          placeholder={t('acrs.search.profitCenterPlaceholder')}
          className={`${TEXT_INPUT_CLASS} w-36`}
        />
      </label>

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

      {/* The chip says the last Search asked more than the empty landing does.
          Dismissing it is Reset — one way back to the landing state, not two. */}
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
