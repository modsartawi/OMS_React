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
 * 1. 🚩 **The location picker is CITY, then district** (owner-stated 2026-07-29:
 *    *"the operator usually asks the caller what city you are in first"*). This
 *    replaces CC2's single box over all ~1,700 districts, which 179 inherited on
 *    the reasoning that *a caller who names their district is answered in one
 *    step* — true, and the wrong half of the conversation to optimise for. Both
 *    steps read the district list this repo has cached at `staleTime: Infinity`
 *    since Screen 2 — still no new read, and no city table to add one for. Only
 *    the district is written; the pick commits the **city with it**.
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
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { lookupQueries } from '@/core/services/lookups'
import Button from '@/core/ui/Button'
import { addressFormErrors, type AddressFormValues } from './address-capture'
import { cityChoices, districtChoices, type CityChoice, type DistrictChoice } from './district-choice'
import { NOTE } from './console-notes'
import {
  NO_HIGHLIGHT,
  highlightMoveOf,
  highlightedIndex,
  moveHighlight,
  type HighlightList,
  type HighlightState,
} from './highlight'

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

  /**
   * 🚩 Where the caret lands once the LOCATION is answered — the field that
   * follows it in reading order. The city step hands off to the district step and
   * the district step hands off to here, so an agent keying an address the way a
   * caller dictates it never leaves the keyboard between *which city* and *which
   * street*.
   *
   * It is owned HERE rather than inside `DistrictField` because it is the one
   * thing about that hand-off the location picker cannot know: what comes next is
   * this form's layout, not the picker's business.
   */
  const street1Box = useRef<HTMLInputElement | null>(null)

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

      <DistrictField
        values={values}
        onChange={set}
        busy={busy}
        invalid={Boolean(errors.district)}
        onSettled={() => street1Box.current?.focus()}
      />

      <Text
        id="street1"
        label={t('address.form.street1')}
        value={values.street1}
        onChange={(street1) => set({ street1 })}
        busy={busy}
        inputRef={street1Box}
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
  inputRef,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  busy: boolean
  /** Present only where something else has to be able to put the caret here —
   *  today, the location picker handing off once the district is settled. */
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className={LABEL} htmlFor={`cc-address-${id}`}>
        {label}
      </label>
      <input
        id={`cc-address-${id}`}
        ref={inputRef}
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

/**
 * City, then district — the order the call is actually conducted in (owner-stated
 * 2026-07-29: *"the operator usually asks the caller what city you are in
 * first"*).
 *
 * 🚩 It **replaces** CC2's single box over all ~1,700 districts. The city step
 * narrows to a few dozen before the caller has to name anything harder to spell,
 * and the district search survives inside it — so an agent whose caller opens
 * with their district still types it once and picks it.
 *
 * Only the DISTRICT is ever written: the city rides it (`district-choice.ts`), so
 * the two can never drift apart, and choosing a city commits nothing. The pick
 * seeds its own city on re-open, which is why the city step needs no field of its
 * own on `AddressFormValues`.
 *
 * 🚩 **Both steps are driven from the box** (owner-stated 2026-07-29), on 191's
 * grammar and `highlight.ts` unchanged: `↓` aims, `Enter` commits, and committing
 * **hands the caret to the next question** — city → district → street. Two steps
 * cost two more keys than CC2's single box and that is the whole of the price;
 * without the hand-off they would cost a reach for the mouse in the middle of a
 * sentence, which is what would have made the split a regression.
 *
 * 🚩 Nothing is aimed until the first `↓`, here as there: the district match is a
 * substring scan over ~1,700 rows and the top one is a guess. And a **collapsed**
 * list is a count of zero, so `Enter` on a settled district reaches no row at all
 * rather than silently re-picking one.
 */
function DistrictField({
  values,
  onChange,
  busy,
  invalid,
  onSettled,
}: {
  values: AddressFormValues
  onChange: (patch: Partial<AddressFormValues>) => void
  busy: boolean
  invalid: boolean
  /** The location is answered. What the caret does next is the FORM's layout and
   *  not this picker's business, so it only says *done*. */
  onSettled: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [cityQuery, setCityQuery] = useState('')
  const [query, setQuery] = useState('')
  // 🚩 The city step is LOCAL — it steers the district list and is never sent.
  // Seeded from the address the form already holds, so re-opening a settled
  // address lands in its own city rather than back at the top of the estate.
  const [cityCode, setCityCode] = useState<string | null>(values.cityCode || null)

  const cityBox = useRef<HTMLInputElement | null>(null)
  const districtBox = useRef<HTMLInputElement | null>(null)

  /**
   * The two aims, one per step — `highlight.ts` unchanged, the module 191 built
   * to be reused. Two states rather than one because the steps are two different
   * questions asked against two different terms, and a shared index would carry a
   * city's row number into the district list.
   */
  const [cityHighlight, setCityHighlight] = useState(NO_HIGHLIGHT)
  const [districtHighlight, setDistrictHighlight] = useState(NO_HIGHLIGHT)
  /**
   * 🚩 Whether the district list is on screen at all — owner-stated 2026-07-29,
   * *"hide the selection after move from the input"*.
   *
   * A settled district collapses its own list: the pick is already drawn above
   * the box, so leaving ~86 rows standing under an answered question is a wall
   * the agent has to scroll past to reach the street. Returning to the box
   * reopens it, because the only reason to go back there is to change the answer.
   *
   * ⚠️ Clicking a row would blur the box before the click landed, so the results
   * container refuses the mousedown's default (below) and the caret never leaves.
   * Mouse and keyboard then close it the same way: through the pick.
   */
  const [districtFocused, setDistrictFocused] = useState(false)

  // The list Screen 2's Change Store picker already fetched — one shared
  // session cache key this feature JOINS rather than a read it adds (179).
  const districts = useQuery(lookupQueries.districts())
  const cities = cityChoices(districts.data, { query: cityQuery, currentCityCode: cityCode })
  const { pinned, rows, truncated, total } = districtChoices(districts.data, {
    query,
    currentDistrictCode: values.districtCode || null,
    cityCode,
  })

  const cityListOpen = districts.isSuccess && !cityCode
  const districtListOpen = districts.isSuccess && cityCode !== null && (districtFocused || !values.districtCode)

  /**
   * 🚩 ONE predicate per step, read by the button and by `Enter` alike. A
   * keyboard that could commit what the row's own control refuses is the defect
   * this arrangement exists to make impossible (191's ruling, in as many words) —
   * so neither branch below re-states `deliverable`, they both call these.
   */
  const cityPickable = (city: CityChoice) => !busy && city.deliverable
  const districtPickable = (row: DistrictChoice) => !busy && row.deliverable

  // A list nobody can see is a list of nothing to aim at — so a collapsed
  // district step disarms `Enter` by construction rather than by a second guard.
  const cityList: HighlightList = { count: cityListOpen ? cities.rows.length : 0, term: cityQuery, armed: !busy }
  const districtList: HighlightList = { count: districtListOpen ? rows.length : 0, term: query, armed: !busy }
  const cityAim = highlightedIndex(cityHighlight, cityList)
  const districtAim = highlightedIndex(districtHighlight, districtList)

  /**
   * ⚠️ The district box **does not exist yet** at the moment the city is
   * answered — it is rendered by the very state this pick sets, so a `focus()`
   * on the spot finds a null ref and the agent's next word lands nowhere. The
   * intent is therefore recorded and spent after the render that draws the box.
   *
   * A ref rather than state: wanting the caret is not something to re-render
   * for, and it must be consumed exactly once — a `useState` flag would need its
   * own clearing render and could fire twice under StrictMode's double effects.
   */
  const wantDistrictCaret = useRef(false)
  useEffect(() => {
    if (!wantDistrictCaret.current) return
    wantDistrictCaret.current = false
    districtBox.current?.focus()
  })

  /** Answering the city hands the caret straight to the district box — the next
   *  thing the agent is about to be told, and the reason the two steps are not a
   *  step backwards from CC2's single box. */
  const takeCity = (city: CityChoice) => {
    setCityCode(city.cityCode)
    setQuery('')
    setDistrictHighlight(NO_HIGHLIGHT)
    wantDistrictCaret.current = true
  }

  /** Answering the district settles the whole location — only the district is
   *  written, the city rides it, and the form takes the caret from here. */
  const takeDistrict = (row: DistrictChoice) => {
    onChange({
      districtCode: row.districtCode,
      districtName: row.districtName,
      cityCode: row.cityCode,
      cityName: row.cityName,
    })
    onSettled()
  }

  /**
   * One step's key grammar. Shared by both boxes because they are the same three
   * keys over the same module, and a second copy is a second chance to get
   * *↓ from nothing is the first row* wrong.
   *
   * 🚩 The composing guard comes FIRST, before the arrows and before `Enter` —
   * half this console's typing is Arabic, and an IME's own navigation keys reach
   * this handler as ordinary ones. A key still finishing a word is not a key
   * aimed at the list.
   */
  const stepKeys = <T,>(
    event: React.KeyboardEvent<HTMLInputElement>,
    step: {
      list: HighlightList
      highlight: HighlightState
      setHighlight: (next: HighlightState) => void
      aim: number | null
      rows: T[]
      pickable: (row: T) => boolean
      take: (row: T) => void
    },
  ) => {
    if (event.nativeEvent.isComposing) return
    const move = highlightMoveOf(event.key)
    if (move) {
      // The caret stays where the agent is typing: an unhandled arrow jumps it to
      // one end of the term, so the next character lands in the wrong place.
      event.preventDefault()
      step.setHighlight(moveHighlight(step.highlight, step.list, move))
      return
    }
    if (event.key !== 'Enter' || step.aim === null) return
    // 🚩 Never lets `Enter` submit the dialog past an unanswered list. The picker
    // is inside a form-shaped surface and the default action here would be the
    // footer's *Save*.
    event.preventDefault()
    const row = step.rows[step.aim]
    if (step.pickable(row)) step.take(row)
  }

  return (
    <div className="flex flex-col gap-1" data-cc-district-field>
      <label className={LABEL} htmlFor="cc-address-city">
        {t('address.form.city')}
      </label>

      <div className="relative">
        <Search
          className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          id="cc-address-city"
          ref={cityBox}
          value={cityCode ? (cities.pinned?.cityName ?? '') : cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          onKeyDown={(event) =>
            stepKeys(event, {
              list: cityList,
              highlight: cityHighlight,
              setHighlight: setCityHighlight,
              aim: cityAim,
              rows: cities.rows,
              pickable: cityPickable,
              take: takeCity,
            })
          }
          // Once a city is settled the box shows it and is read-only — *Change*
          // is the way back out, so a stray keystroke cannot silently widen the
          // district list under a pick the agent has already made.
          readOnly={Boolean(cityCode)}
          disabled={busy}
          autoComplete="off"
          placeholder={t('address.form.citySearchPlaceholder')}
          // 🚩 The aim is announced through `aria-activedescendant` and NEVER by
          // moving focus — the caret has to stay in the box so the agent can keep
          // typing the city while the caller is still saying it (153).
          role="combobox"
          aria-expanded={cityListOpen && cities.rows.length > 0}
          aria-controls="cc-city-results"
          aria-autocomplete="list"
          aria-activedescendant={cityAim === null ? undefined : `cc-city-option-${cities.rows[cityAim].cityCode}`}
          data-cc-city-search
          data-cc-city-current={cityCode ?? undefined}
          className={`${FIELD} ps-8 ${cityCode ? 'pe-20' : ''}`}
        />
        {cityCode && (
          <button
            type="button"
            onClick={() => {
              setCityCode(null)
              setCityQuery('')
              setQuery('')
              // Both aims dropped and the caret handed back to the box that is
              // now the question — *Change* puts the agent at the start of the
              // location again, not at the top of a list they cannot reach.
              setCityHighlight(NO_HIGHLIGHT)
              setDistrictHighlight(NO_HIGHLIGHT)
              cityBox.current?.focus()
            }}
            disabled={busy}
            data-cc-city-change
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {t('address.form.cityChange')}
          </button>
        )}
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

      {/* THE CITY STEP — the district list does not exist until this is answered. */}
      {cityListOpen && (
        <div
          className="max-h-40 space-y-1 overflow-y-auto"
          id="cc-city-results"
          role="listbox"
          // ⚠️ Keeps the caret in the box through a mouse pick: without this the
          // blur would land first and the list would be gone before the click.
          onMouseDown={(event) => event.preventDefault()}
          data-cc-city-results
        >
          {cities.rows.length === 0 && (
            <p className="text-[11px] text-muted-foreground" data-cc-city-none>
              {t('address.form.cityNone')}
            </p>
          )}
          {cities.rows.map((city, index) => (
            <button
              key={city.cityCode}
              type="button"
              // Same rule as a district: visible and unpickable, saying why. A
              // city no store delivers to anywhere is answered NOW rather than
              // after the agent has hunted through its districts.
              onClick={() => takeCity(city)}
              disabled={!cityPickable(city)}
              id={`cc-city-option-${city.cityCode}`}
              role="option"
              aria-selected={index === cityAim}
              data-cc-city-option={city.cityCode}
              data-cc-city-deliverable={city.deliverable ? 'yes' : 'no'}
              {...(index === cityAim ? { 'data-cc-city-highlighted': city.cityCode } : {})}
              // Ground AND an outline on the aim, never a tint alone — the ring is
              // inset and direction-neutral, so it mirrors for free.
              className={`flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-start text-[0.8125rem] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card ${
                index === cityAim ? 'bg-accent ring-1 ring-inset ring-primary' : ''
              }`}
            >
              <span className="min-w-0 truncate">{city.cityName}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {city.deliverable
                  ? t('address.form.cityDistrictCount', { count: city.deliverableDistricts })
                  : t('address.form.districtNoStore')}
              </span>
            </button>
          ))}
          {cities.truncated && (
            <p className="text-[11px] text-muted-foreground" data-cc-city-truncated>
              {t('address.form.districtTruncated', { total: cities.total })}
            </p>
          )}
        </div>
      )}

      {/* THE DISTRICT STEP — within the named city, and only there. */}
      {districts.isSuccess && cityCode && (
        <>
          <label className={`${LABEL} mt-2`} htmlFor="cc-address-district">
            {t('address.form.district')}
          </label>

          {pinned && (
            // The pick, held above the results — never filtered away by a search
            // for somewhere else, and never re-derived from the box's contents.
            <p
              className="flex items-center gap-1.5 rounded-md border border-success-800/30 bg-success-800/5 px-2.5 py-1.5 text-[0.8125rem]"
              data-cc-district-current={pinned.districtCode}
            >
              <Check className="h-3.5 w-3.5 shrink-0 text-success-800" aria-hidden />
              <span>
                {t('address.form.districtLine', { district: pinned.districtName, city: pinned.cityName })}
              </span>
            </p>
          )}

          <div className="relative">
            <Search
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              id="cc-address-district"
              ref={districtBox}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(event) =>
                stepKeys(event, {
                  list: districtList,
                  highlight: districtHighlight,
                  setHighlight: setDistrictHighlight,
                  aim: districtAim,
                  rows,
                  pickable: districtPickable,
                  take: takeDistrict,
                })
              }
              onFocus={() => setDistrictFocused(true)}
              onBlur={() => setDistrictFocused(false)}
              disabled={busy}
              autoComplete="off"
              placeholder={t('address.form.districtSearchPlaceholder')}
              role="combobox"
              aria-expanded={districtListOpen && rows.length > 0}
              aria-controls="cc-district-results"
              aria-autocomplete="list"
              aria-activedescendant={
                districtAim === null ? undefined : `cc-district-option-${rows[districtAim].districtCode}`
              }
              data-cc-district-search
              className={`${FIELD} ps-8`}
            />
          </div>

          {/* 🚩 Collapsed once the district is settled and the caret has moved on
              — the answer is drawn above the box, so the list has nothing left to
              say. Coming back to the box brings it back. */}
          {districtListOpen && (
            <div
              className="max-h-40 space-y-1 overflow-y-auto"
              id="cc-district-results"
              role="listbox"
              onMouseDown={(event) => event.preventDefault()}
              data-cc-district-results
            >
              {rows.length === 0 && total === 0 && (
                <p className="text-[11px] text-muted-foreground" data-cc-district-none>
                  {t('address.form.districtNone')}
                </p>
              )}
              {rows.map((row, index) => (
                <button
                  key={row.districtCode}
                  type="button"
                  // 🚩 Visible and unpickable, saying why — never hidden. An agent
                  // who cannot find the caller's own district would keep hunting;
                  // one who sees it greyed tells the caller now (§2.3).
                  onClick={() => takeDistrict(row)}
                  disabled={!districtPickable(row)}
                  id={`cc-district-option-${row.districtCode}`}
                  role="option"
                  aria-selected={index === districtAim}
                  data-cc-district-option={row.districtCode}
                  data-cc-district-deliverable={row.deliverable ? 'yes' : 'no'}
                  {...(index === districtAim ? { 'data-cc-district-highlighted': row.districtCode } : {})}
                  className={`flex w-full items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-start text-[0.8125rem] hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-card ${
                    index === districtAim ? 'bg-accent ring-1 ring-inset ring-primary' : ''
                  }`}
                >
                  <span className="min-w-0 truncate">{row.districtName}</span>
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
        </>
      )}

      {invalid && (
        <p className={NOTE.danger} data-cc-address-field-error="district">
          {t('address.form.errors.district')}
        </p>
      )}
    </div>
  )
}
