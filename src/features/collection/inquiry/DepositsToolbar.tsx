import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import {
  DEPOSIT_STATUSES,
  type DepositStatusFilter,
  type DepositsCriteria,
} from './deposit-criteria'

/**
 * Deposits' filter strip (ticket 256) — From · To · Deposit No# · Collector ·
 * Bank · Status. The widest of the four, and the WPF's own set.
 *
 * 254's `CollectionsToolbar` is the shape this follows; ⚠️ **copied, not
 * extracted** (244 §1). It renders a **draft** and nothing else: every edit
 * patches the criteria the Page holds, and only Search promotes that draft to a
 * query.
 *
 * ⚠️ **No `Limit` box.** The WPF's is deleted, not moved (244 §3).
 *
 * ⚠️ **Bank is a free-text code box, not a picker.** `Deposit/Banks` exists on the
 * mobile door, but the `CollectionWeb` door spec 249 settles has seven routes and
 * a bank picker is not one of them — adding an eighth to label a filter would be
 * this slice inventing backend scope. Logged in `.afk/HITL-256.md`; the column
 * still shows the resolved `bankName`, so the code is only what you type, never
 * what you read.
 */
export interface DepositsToolbarProps {
  criteria: DepositsCriteria
  onChange: (patch: Partial<DepositsCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True when the applied query is anything other than the today-landing one. */
  isFiltered: boolean
}

export default function DepositsToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
}: DepositsToolbarProps) {
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
        {t('deposits.search.from')}
        {/* ⚠️ `required` on BOTH ends: the dates travel as a pair, and a half-open
            window is not a narrower query but an unbounded one. The window applies
            to the bank-visit day, not to when the record was written. */}
        <input
          type="date"
          required
          value={criteria.fromDate}
          onChange={(e) => onChange({ fromDate: e.target.value })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('deposits.search.to')}
        <input
          type="date"
          required
          value={criteria.toDate}
          onChange={(e) => onChange({ toDate: e.target.value })}
          className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* The number an accountant holds in their hand — see `deposit-criteria.ts`
          for why it travels as `DepositNumber` and never as `DepositId`. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('deposits.search.depositNumber')}
        <input
          type="text"
          inputMode="numeric"
          value={criteria.depositNumber}
          onChange={(e) => onChange({ depositNumber: e.target.value })}
          placeholder={t('deposits.search.depositNumberPlaceholder')}
          className="h-9 w-32 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('deposits.search.collector')}
        <input
          type="text"
          value={criteria.collectorOperatorId}
          onChange={(e) => onChange({ collectorOperatorId: e.target.value })}
          placeholder={t('deposits.search.collectorPlaceholder')}
          className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('deposits.search.bank')}
        <input
          type="text"
          value={criteria.bankCode}
          onChange={(e) => onChange({ bankCode: e.target.value })}
          placeholder={t('deposits.search.bankPlaceholder')}
          className="h-9 w-32 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      {/* The WPF's radio group, as a segmented control — the same shape the ACRs
          screen gives its OPEN/CLOSED one. `radiogroup`/`radio` roles rather than
          buttons, because that is what it IS: one of three, exactly one chosen. */}
      <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('deposits.search.status')}
        <div
          role="radiogroup"
          aria-label={t('deposits.search.status')}
          className="inline-flex h-9 items-center rounded-full border border-border/60 bg-background p-0.5"
        >
          {DEPOSIT_STATUSES.map((status) => (
            <StatusOption
              key={status}
              status={status}
              selected={criteria.status === status}
              label={t(`deposits.search.statuses.${status}`)}
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
          {t('deposits.search.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('deposits.search.reset')}
        </button>
      </div>

      {/* The chip says the screen is no longer showing today. Dismissing it is
          Reset — one way back to the landing state, not two. */}
      {isFiltered && (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
          {t('deposits.search.filtered')}
          <button
            type="button"
            onClick={onReset}
            aria-label={t('deposits.search.clearFilter')}
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
  status: DepositStatusFilter
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
