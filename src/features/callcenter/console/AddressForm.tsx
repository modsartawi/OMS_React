/**
 * The address editor's **form view** — the second of `AddressPicker`'s two views,
 * drawn in place of the book list inside the same dialog.
 *
 * 🚩 **Not a modal.** `AddressPicker`'s own doc comment rejects modal-on-modal
 * ("a select-then-confirm step here would be a modal in front of a modal"), and
 * 179 ruling 6 settled the surface as one dialog with two views. So this
 * component draws a body and nothing else: the title, the footer and the values
 * are the picker's.
 *
 * Three properties it exists to hold:
 *
 * 1. 🚩 **The district picker is ONE box, not a city→district cascade** (CC2
 *    inventory §3). A caller who names their district is answered in one step,
 *    and the pick commits the **city with it**. It searches the district list
 *    this repo has cached at `staleTime: Infinity` since Screen 2 — no new read,
 *    which is what 179 found rather than assumed.
 * 2. 🚩 **A district no store delivers from is visible and unpickable**, saying
 *    why (§2.3). `district-choice.ts` answers *whether* there is a store and
 *    never *which*, so this screen still derives no plant — and the server's
 *    `NO_DELIVERY_STORE_FOR_DISTRICT` on `setAddress` stays the authority. The
 *    greying steers the caller before the order refuses; it does not replace the
 *    refusal.
 * 3. 🚩 **The national address is format-checked and never verified.** CC2's
 *    live SPL integration is unwired ("a separate integration that needs an API
 *    contract / credentials") and the web inherits its absence knowingly — so
 *    there is **no tick, no *verified* affordance and no green state** here. The
 *    field reads as a code the agent typed.
 *
 * The current pick is **pinned above the results** rather than force-kept inside
 * the filtered array — the web has no WPF `SelectedItem`/`ItemsSource` coupling
 * to work around, and pinning is the honest shape of *a search that would hide
 * the current pick must not clear it*.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { lookupQueries } from '@/core/services/lookups'
import Button from '@/core/ui/Button'
import { addressFormErrors, type AddressFormValues } from './address-capture'
import { districtChoices } from './district-choice'
import { NOTE } from './console-notes'

const FIELD =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-60'
const LABEL = 'text-xs font-semibold text-muted-foreground'

export default function AddressForm({
  values,
  onChange,
  busy,
  error,
}: {
  values: AddressFormValues
  onChange: (values: AddressFormValues) => void
  busy: boolean
  /** The write's refusal, raw — worded by the picker, which explains the two
   *  codes the address door has of its own. */
  error: React.ReactNode
}) {
  const { t } = useTranslation('callcenter')
  const errors = addressFormErrors(values)
  const set = (patch: Partial<AddressFormValues>) => onChange({ ...values, ...patch })

  // Server data, not an enum (CC2 inventory §2.2). A failed read is not a dead
  // end: the select falls back to the value the form already holds, so an
  // address is still creatable when the catalogue is unreachable.
  const labels = useQuery(lookupQueries.addressLabels())
  const labelOptions = labels.data ?? []
  const known = labelOptions.some((l) => l.labelCode === values.labelCode)

  return (
    <div className="space-y-3 text-sm" data-cc-address-form>
      <div className="flex flex-col gap-1">
        <label className={LABEL} htmlFor="cc-address-label">
          {t('address.form.label')}
        </label>
        <select
          id="cc-address-label"
          value={values.labelCode}
          onChange={(e) => set({ labelCode: e.target.value })}
          disabled={busy}
          data-cc-address-field="labelCode"
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {/* The form's own value first when the catalogue does not carry it —
              an edit of a row labelled by SAP must not silently relabel it, and
              a row with NO label keeps none rather than being defaulted here. */}
          {!known && (
            <option value={values.labelCode}>
              {values.labelCode || t('address.unlabelled')}
            </option>
          )}
          {labelOptions.map((option) => (
            <option key={option.labelCode} value={option.labelCode}>
              {/* `labelNameEn ?? labelCode` — CC2's own fallback, kept so agents
                  go on seeing the untranslated code they already know. */}
              {option.labelNameEn?.trim() || option.labelCode}
            </option>
          ))}
        </select>
      </div>

      <DistrictField values={values} onChange={set} busy={busy} invalid={Boolean(errors.district)} />

      <Text
        id="street1"
        label={t('address.form.street1')}
        value={values.street1}
        onChange={(street1) => set({ street1 })}
        busy={busy}
      />
      <Text
        id="street2"
        label={t('address.form.street2')}
        value={values.street2}
        onChange={(street2) => set({ street2 })}
        busy={busy}
      />
      <Text
        id="buildingNumber"
        label={t('address.form.buildingNumber')}
        value={values.buildingNumber}
        onChange={(buildingNumber) => set({ buildingNumber })}
        busy={busy}
      />

      <div className="grid grid-cols-2 gap-2">
        <Text
          id="phone1"
          label={t('address.form.phone1')}
          value={values.phone1}
          onChange={(phone1) => set({ phone1 })}
          busy={busy}
        />
        <Text
          id="phone2"
          label={t('address.form.phone2')}
          value={values.phone2}
          onChange={(phone2) => set({ phone2 })}
          busy={busy}
        />
      </div>
      {/* 🚩 The delivery phone is NOT the loyalty mobile — the driver rings this
          one, and an agent who assumes otherwise leaves the driver with the
          number the caller has already been reached on. */}
      <p className="text-[11px] text-muted-foreground">{t('address.form.phoneHint')}</p>

      <div className="flex flex-col gap-1">
        <label className={LABEL} htmlFor="cc-address-shortAddress">
          {t('address.form.shortAddress')}
        </label>
        <input
          id="cc-address-shortAddress"
          value={values.shortAddress}
          // Upper-cased **on set**, CC2's own normalisation — so the box shows
          // the agent the same code the wire will carry.
          onChange={(e) => set({ shortAddress: e.target.value.toUpperCase() })}
          disabled={busy}
          autoComplete="off"
          placeholder={t('address.form.shortAddressPlaceholder')}
          data-cc-address-field="shortAddress"
          className={FIELD}
        />
        {errors.shortAddress ? (
          <p className={NOTE.danger} data-cc-address-field-error="shortAddress">
            {t('address.form.errors.shortAddress')}
          </p>
        ) : (
          // Says what the format is and nothing about whether it is real. There
          // is deliberately no confirmed/verified state to draw.
          <p className="text-[11px] text-muted-foreground">{t('address.form.shortAddressHint')}</p>
        )}
      </div>

      {error}
    </div>
  )
}

function Text({
  id,
  label,
  value,
  onChange,
  busy,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  busy: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL} htmlFor={`cc-address-${id}`}>
        {label}
      </label>
      <input
        id={`cc-address-${id}`}
        value={value}
        // 🚩 What the box holds is what is sent — an emptied box sends `""`, and
        // `""` is what clears a column. `null` would mean *keep what is there*
        // (`address-capture.ts`), so nothing here tidies a blank away.
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        autoComplete="off"
        data-cc-address-field={id}
        className={FIELD}
      />
    </div>
  )
}

/** CC2's unified search: one box over every district, matching district or city. */
function DistrictField({
  values,
  onChange,
  busy,
  invalid,
}: {
  values: AddressFormValues
  onChange: (patch: Partial<AddressFormValues>) => void
  busy: boolean
  invalid: boolean
}) {
  const { t } = useTranslation('callcenter')
  const [query, setQuery] = useState('')

  // The list Screen 2's Change Store picker already fetched — one shared
  // session cache key this feature JOINS rather than a read it adds (179).
  const districts = useQuery(lookupQueries.districts())
  const { pinned, rows, truncated, total } = districtChoices(districts.data, {
    query,
    currentDistrictCode: values.districtCode || null,
  })

  return (
    <div className="flex flex-col gap-1" data-cc-district-field>
      <label className={LABEL} htmlFor="cc-address-district">
        {t('address.form.district')}
      </label>

      {pinned && (
        // The pick, held above the results — never filtered away by a search for
        // somewhere else, and never re-derived from the box's contents.
        <p
          className="flex items-center gap-1.5 rounded-md border border-success-800/30 bg-success-800/5 px-2.5 py-1.5 text-[0.8125rem]"
          data-cc-district-current={pinned.districtCode}
        >
          <Check className="h-3.5 w-3.5 shrink-0 text-success-800" aria-hidden />
          <span>{t('address.form.districtLine', { district: pinned.districtName, city: pinned.cityName })}</span>
        </p>
      )}

      <div className="relative">
        <Search
          className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="cc-address-district"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={busy}
          autoComplete="off"
          placeholder={t('address.form.districtSearchPlaceholder')}
          data-cc-district-search
          className={`${FIELD} ps-8`}
        />
      </div>

      {districts.isPending && (
        <p className="flex items-center gap-2 text-[11px] text-muted-foreground" data-cc-district-loading>
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('address.form.districtLoading')}
        </p>
      )}

      {districts.isError && (
        <>
          <p className={NOTE.danger} data-cc-district-error>
            {apiErrorMessage(districts.error, t('address.form.districtLoadFailed'))}
          </p>
          <Button
            variant="outlined"
            onClick={() => void districts.refetch()}
            disabled={districts.isFetching}
            data-cc-district-reload
          >
            {t('actions.retry')}
          </Button>
        </>
      )}

      {districts.isSuccess && (
        <div className="max-h-40 space-y-1 overflow-y-auto" data-cc-district-results>
          {rows.length === 0 && total === 0 && (
            <p className="text-[11px] text-muted-foreground" data-cc-district-none>
              {t('address.form.districtNone')}
            </p>
          )}
          {rows.map((row) => (
            <button
              key={row.districtCode}
              type="button"
              // 🚩 Visible and unpickable, saying why — never hidden. An agent
              // who cannot find the caller's own district would keep hunting;
              // one who sees it greyed tells the caller now (§2.3).
              onClick={() =>
                onChange({
                  districtCode: row.districtCode,
                  districtName: row.districtName,
                  cityCode: row.cityCode,
                  cityName: row.cityName,
                })
              }
              disabled={busy || !row.deliverable}
              data-cc-district-option={row.districtCode}
              data-cc-district-deliverable={row.deliverable ? 'yes' : 'no'}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-start text-[0.8125rem] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card"
            >
              <span className="min-w-0 truncate">
                {t('address.form.districtLine', { district: row.districtName, city: row.cityName })}
              </span>
              {!row.deliverable && (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t('address.form.districtNoStore')}
                </span>
              )}
            </button>
          ))}
          {truncated && (
            <p className="text-[11px] text-muted-foreground" data-cc-district-truncated>
              {t('address.form.districtTruncated', { total })}
            </p>
          )}
        </div>
      )}

      {invalid && (
        <p className={NOTE.danger} data-cc-address-field-error="district">
          {t('address.form.errors.district')}
        </p>
      )}
    </div>
  )
}
