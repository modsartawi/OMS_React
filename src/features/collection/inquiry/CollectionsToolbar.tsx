import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'
import { isAcrScoped } from './acr-scope'
import {
  COLLECTION_TYPE_FILTERS,
  type CollectionTypeFilter,
  type CollectionsCriteria,
} from './collections-criteria'
import DateField from './DateField'
import NoSlipChip from './NoSlipChip'
import ServedByPicker from './ServedByPicker'
import { NO_SERVED_BY } from './served-by'
import type { NoSlipToggle } from './slips'

/**
 * Cash Collections' filter strip (ticket 254) — Business date from/to · Collection
 * date from/to · Store · Collected by · Served by, and the template 255 and 256
 * copy (and, for the four dates, 316: ticket 315 set the shape). Ticket 423
 * (BackOffice 2424) adds Type with its two ticks, Amount from/to and Profit center —
 * all applied by the server before the cap, never in the browser.
 *
 * 🚩 **Every filter ANDs** (BackOffice 1166, and 1992 for the two date ranges). *Served by* resolves to
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
 * ⚠️ **The `?acr=` chip overrides and disables every input** (ticket 257), and
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
  /** True when a Search was issued and it is anything other than the empty landing's. */
  isFiltered: boolean
  /** The ACR this view is scoped to, or `''` for the ordinary screen (257). */
  scopedAcrId: string
  /** Drop the `?acr=` param and return to the ordinary, un-searched screen. */
  onClearScope: () => void
  /** The "No slip" toggle (ticket 320) — absent when the session may not see slips. */
  noSlip?: NoSlipToggle
}

/** The Type filter's base types, by their wire value → their label key. */
const TYPE_LABEL: Record<CollectionTypeFilter, string> = {
  Regular: 'collections.search.typeRegular',
  Short: 'collections.search.typeShort',
  OutsideSystem: 'collections.search.typeOutsideSystem',
}

/** One tick of the Type filter: a checkbox with its label, in one hit target. */
function Tick({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-foreground has-[:disabled]:opacity-50">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 accent-primary disabled:cursor-not-allowed"
      />
      {label}
    </label>
  )
}

/** One end of the Amount range: a decimal typed as text and sent as typed. */
function AmountField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        type="text"
        dir="ltr"
        inputMode="decimal"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${TEXT_INPUT_CLASS} w-32 text-end tabular-nums ${DISABLED_CLASS}`}
      />
    </label>
  )
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

const TEXT_INPUT_CLASS =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

export default function CollectionsToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  isFiltered,
  scopedAcrId,
  onClearScope,
  noSlip,
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
      {/* 🚩 Two ranges, named by what they mean (ticket 315, BackOffice 1992): the
          SALES day and the collected-at instant. They AND, and neither clears the
          other. ⚠️ No `required` on any end any more: the contract makes each one
          optional (an open-ended range is a real question), and asking about sales
          days alone means leaving the collection range empty. */}
      <DateField
        label={t('collections.search.businessDateFrom')}
        value={overridden(scoped, criteria.businessDateFrom)}
        disabled={scoped}
        onChange={(businessDateFrom) => onChange({ businessDateFrom })}
      />
      <DateField
        label={t('collections.search.businessDateTo')}
        value={overridden(scoped, criteria.businessDateTo)}
        disabled={scoped}
        onChange={(businessDateTo) => onChange({ businessDateTo })}
      />
      <DateField
        label={t('collections.search.collectionDateFrom')}
        value={overridden(scoped, criteria.collectionDateFrom)}
        disabled={scoped}
        onChange={(collectionDateFrom) => onChange({ collectionDateFrom })}
      />
      <DateField
        label={t('collections.search.collectionDateTo')}
        value={overridden(scoped, criteria.collectionDateTo)}
        disabled={scoped}
        onChange={(collectionDateTo) => onChange({ collectionDateTo })}
      />

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
          className={`${TEXT_INPUT_CLASS} w-36 ${DISABLED_CLASS}`}
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
          className={`${TEXT_INPUT_CLASS} w-40 ${DISABLED_CLASS}`}
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

      {/* Type (BackOffice 2424): the base types OR together; each tick ANDs its own
          flag onto the result, so a `Regular+Surplus` row is found by both
          "Regular" and "has Surplus" — the filter agrees with the Type column.
          Nothing ticked is any type, and sends nothing. */}
      <fieldset className="flex flex-col gap-1" data-region="collection-type">
        <legend className="mb-1 text-xs font-medium text-muted-foreground">{t('collections.search.type')}</legend>
        <div className="flex h-9 flex-wrap items-center gap-x-3 gap-y-1">
          {COLLECTION_TYPE_FILTERS.map((type) => (
            <Tick
              key={type}
              label={t(TYPE_LABEL[type])}
              checked={!scoped && criteria.collectionTypes.includes(type)}
              disabled={scoped}
              onChange={(on) =>
                onChange({
                  collectionTypes: on
                    ? [...criteria.collectionTypes, type]
                    : criteria.collectionTypes.filter((picked) => picked !== type),
                })
              }
            />
          ))}
          <span className="h-4 border-s border-border/60" aria-hidden />
          <Tick
            label={t('collections.search.hasSurplus')}
            checked={!scoped && criteria.hasSurplus}
            disabled={scoped}
            onChange={(hasSurplus) => onChange({ hasSurplus })}
          />
          <Tick
            label={t('collections.search.hasStolen')}
            checked={!scoped && criteria.hasStolen}
            disabled={scoped}
            onChange={(hasStolen) => onChange({ hasStolen })}
          />
        </div>
      </fieldset>

      {/* Amount (BackOffice 2424): the Amount column's value, both ends inclusive and
          either optional. A From above its To goes to the door, which refuses it
          with its usual criterion refusal — shown in the error banner, not
          re-implemented here.
          🚩 Text, not `type="number"`: a number input hands back `''` for what it
          cannot parse (`12,5`), so the filter would be dropped silently while the
          box still showed it. Sent as typed, a malformed amount is the door's
          refusal, said out loud. */}
      <AmountField
        label={t('collections.search.amountFrom')}
        value={overridden(scoped, criteria.amountFrom)}
        disabled={scoped}
        onChange={(amountFrom) => onChange({ amountFrom })}
      />
      <AmountField
        label={t('collections.search.amountTo')}
        value={overridden(scoped, criteria.amountTo)}
        disabled={scoped}
        onChange={(amountTo) => onChange({ amountTo })}
      />

      {/* Profit center (BackOffice 2424): a contains match on the server, so `019`
          finds `PH-019` without the prefix. */}
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('collections.search.profitCenter')}
        <input
          type="text"
          dir="ltr"
          disabled={scoped}
          value={overridden(scoped, criteria.profitCenter)}
          onChange={(e) => onChange({ profitCenter: e.target.value })}
          placeholder={t('collections.search.profitCenterPlaceholder')}
          className={`${TEXT_INPUT_CLASS} w-36 ${DISABLED_CLASS}`}
        />
      </label>

      {/* "No slip" (ticket 320) — drawn only when the slip probe admits. It stays live under the
          `?acr=` scope: it narrows the rows already here and sends nothing. */}
      <NoSlipChip toggle={noSlip} />

      <div className="flex items-center gap-2">
        {/* Search goes with them. With every criterion overridden there is
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

      {/* The chip says the last Search narrowed the landing. Dismissing it is
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
