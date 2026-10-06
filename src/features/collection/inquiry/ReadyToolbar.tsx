import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import { READY_KIND_FILTERS, type ReadyCriteria, type ReadyKindFilter } from './ready-criteria'
import DateField from './DateField'
import NoSlipChip from './NoSlipChip'
import ServedByPicker from './ServedByPicker'
import type { NoSlipToggle } from './slips'

/**
 * Ready for collection's filter strip (ticket 317) — Business date from/to ·
 * Collector · Served by, the three filters BackOffice 1994 gave this screen. Ticket
 * 424 (BackOffice 2425) adds Type, Amount from/to and Profit center — each applied
 * by the server to the days and the receipts alike, before the cap.
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
  /** True when a Search was issued and it is anything other than the empty landing's. */
  isFiltered: boolean
  /** The "No slip" toggle (ticket 320) — absent when the session may not see slips. */
  noSlip?: NoSlipToggle
}

/** The Type filter's kinds, by their wire value → their label key. */
const KIND_LABEL: Record<ReadyKindFilter, string> = {
  DAY: 'ready.search.kindDay',
  SETTLEMENT: 'ready.search.kindSettlement',
}

const TEXT_INPUT_CLASS =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** One end of the Amount range: a decimal typed as text and sent as typed. */
function AmountField({
  label,
  value,
  onChange,
}: {
  label: string
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${TEXT_INPUT_CLASS} w-32 text-end tabular-nums`}
      />
    </label>
  )
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
          className={`${TEXT_INPUT_CLASS} w-40`}
        />
      </label>

      {/* 🚩 The shared control on the ASSIGNMENT reading (`SERVED_BY_SCREENS.ready`):
          the store's CURRENT pairing. ACCOUNTANT + id is this screen's accountant
          filter. It ANDs with the Collector box. */}
      <ServedByPicker screen="ready" value={criteria.servedBy} onChange={(servedBy) => onChange({ servedBy })} />

      {/* Type (BackOffice 2425): the kinds OR together. Nothing ticked is any kind,
          and sends nothing. */}
      <fieldset className="flex flex-col gap-1" data-region="ready-kind">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">{t('ready.search.kind')}</legend>
        <div className="flex h-9 flex-wrap items-center gap-x-3 gap-y-1">
          {READY_KIND_FILTERS.map((kind) => (
            <label key={kind} className="inline-flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="checkbox"
                checked={criteria.kinds.includes(kind)}
                onChange={(e) =>
                  onChange({
                    kinds: e.target.checked
                      ? [...criteria.kinds, kind]
                      : criteria.kinds.filter((picked) => picked !== kind),
                  })
                }
                className="h-3.5 w-3.5 accent-primary"
              />
              {t(KIND_LABEL[kind])}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Amount (BackOffice 2425): cash to hand over, both ends inclusive and either
          optional. A From above its To goes to the door, which refuses it — shown in
          the error banner, not re-implemented here.
          🚩 Text, not `type="number"` (423's finding): a number input hands back `''`
          for what it cannot parse, so the filter would be dropped silently while the
          box still showed it. */}
      <AmountField
        label={t('ready.search.amountFrom')}
        value={criteria.amountFrom}
        onChange={(amountFrom) => onChange({ amountFrom })}
      />
      <AmountField
        label={t('ready.search.amountTo')}
        value={criteria.amountTo}
        onChange={(amountTo) => onChange({ amountTo })}
      />

      {/* Profit center (BackOffice 2425): a contains match on the server, so `019`
          finds `PH-019` without the prefix. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('ready.search.profitCenter')}
        <input
          type="text"
          dir="ltr"
          value={criteria.profitCenter}
          onChange={(e) => onChange({ profitCenter: e.target.value })}
          placeholder={t('ready.search.profitCenterPlaceholder')}
          className={`${TEXT_INPUT_CLASS} w-36`}
        />
      </label>

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
