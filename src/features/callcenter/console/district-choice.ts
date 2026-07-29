/**
 * The location picker's two steps as pure projections — **city, then district** —
 * over the district list this repo has cached since Screen 2, plus the single
 * question the client is allowed to ask about a store.
 *
 * 🚩 **City first** (owner-stated 2026-07-29). CC2's unified search
 * ([inventory §3](../../../../.issues/assets/175-cc2-inventory/CC2-INVENTORY.md))
 * put every district in one box and 179 inherited it; the operator's actual
 * opening question is *what city are you in*, and answering it narrows ~1,700
 * rows to a few dozen before the caller has to name anything harder to spell.
 * The district search survives inside the chosen city, so a caller who names
 * their district still skips no step — the city is implied by their district and
 * committed with it either way.
 *
 * 🚩 **It asks WHETHER there is a delivering store, never WHICH.**
 * `address-book.ts` carries the standing rule that nothing on this console
 * derives a store, and 179 ruling 4 is what keeps it literally true: the
 * predicate lives here rather than in that file, `DistrictChoice` has no store
 * field to leak one, and the **server refusal stays authoritative** —
 * `NO_DELIVERY_STORE_FOR_DISTRICT` on `setAddress` is the guard, and the greying
 * below is the courtesy that steers the caller before the order refuses.
 * Same advisory-but-authoritative shape as `capabilities`.
 *
 * ⚠️ **Residual, knowingly inherited** (179, and the map's own Out of scope):
 * the list is session-cached at `staleTime: Infinity`, so an ops flip of
 * `tempStoreCode` is invisible for the agent's whole shift. In the direction
 * that matters — a district that became undeliverable — the server refusal still
 * catches it.
 *
 * ⚠️ **Arabic matching inherits CC2's `OrdinalIgnoreCase` limitation knowingly**:
 * no diacritic or hamza folding, which CC2's own comment calls *"good enough for
 * a dropdown filter"*. Recorded here so it is not re-discovered as a bug.
 */
import type { SdDistrictModel } from '@/core/models/lookups'

export interface DistrictChoice {
  /** What the capture carries, and what the server derives the store from. */
  districtCode: string
  districtName: string
  /** Committed WITH the district, whichever step the agent got there by — the
   *  district is what the server derives the store from, and the city rides it
   *  rather than being a second thing to keep in step. */
  cityCode: string
  cityName: string
  /**
   * Whether **some** store delivers here. Never which one, and no store code is
   * carried on this type at all — see the module note.
   */
  deliverable: boolean
  isCurrent: boolean
}

export interface DistrictResults {
  /**
   * The pick the form is holding, drawn **above** the results rather than
   * force-kept inside them (179 ruling 4: on the web there is no WPF
   * `SelectedItem`/`ItemsSource` coupling to work around, so pinning is the
   * honest shape of *a search that would hide the current pick must not clear
   * it*).
   */
  pinned: DistrictChoice | null
  /** The matches, minus the pin, capped at `limit`. */
  rows: DistrictChoice[]
  /** More matched than were handed to the eye. */
  truncated: boolean
  /** How many matched in total, pin included — what `truncated` is honest about. */
  total: number
}

export interface DistrictQuery {
  query?: string
  currentDistrictCode?: string | null
  /**
   * 🚩 **The city the agent asked for first**, and the whole reason this narrows
   * at all. Null means *every* district — the shape this module shipped with, and
   * still what the city step falls back to before a city is named.
   */
  cityCode?: string | null
  /** The list is ~1,700 rows; an empty box must not hand all of them to the DOM. */
  limit?: number
}

/**
 * One city, folded up out of the district rows — there is no city table to read
 * and no second request to make (~1,700 rows collapse to 34).
 *
 * 🚩 It answers the same store question the same way: `deliverable` is *whether
 * any district here has a delivering store*, never which, and there is no store
 * field on this type either. A city with none is drawn and unpickable for the
 * same reason a district with none is — an agent who cannot find the caller's
 * city keeps hunting; one who sees it greyed tells the caller now.
 */
export interface CityChoice {
  cityCode: string
  cityName: string
  /** How many of this city's districts some store delivers to — 0 greys it out. */
  deliverableDistricts: number
  deliverable: boolean
  isCurrent: boolean
}

export interface CityQuery {
  query?: string
  currentCityCode?: string | null
  limit?: number
}

export interface CityResults {
  pinned: CityChoice | null
  rows: CityChoice[]
  truncated: boolean
  total: number
}

const DEFAULT_LIMIT = 30

/**
 * The city step (owner-stated 2026-07-29: *"the operator usually asks the caller
 * what city you are in first"*).
 *
 * 🚩 This **replaces** the single unified box CC2 uses and 179 inherited. That
 * decision was recorded as *"a caller who names their district is answered in one
 * step"* — true, and it optimised for the wrong half of the conversation: an
 * agent working an unfiltered list of 1,700 districts has to hear a district name
 * spelled well enough to type, while the question they actually ask first is the
 * city. Narrowing by city first is what the call sounds like; the district search
 * survives *inside* the city, so naming the district still skips nothing.
 */
export function cityChoices(
  districts: SdDistrictModel[] | null | undefined,
  { query = '', currentCityCode = null, limit = DEFAULT_LIMIT }: CityQuery,
): CityResults {
  const term = query.trim().toLowerCase()
  const current = currentCityCode === null ? null : text(currentCityCode)

  const byCode = new Map<string, CityChoice>()
  for (const d of districts ?? []) {
    const cityCode = text(d?.cityCode)
    if (cityCode === '' || text(d?.districtCode) === '') continue

    const existing = byCode.get(cityCode)
    const deliverable = hasDeliveringStore(d)
    if (existing) {
      existing.deliverableDistricts += deliverable ? 1 : 0
      existing.deliverable ||= deliverable
      // The first non-empty name wins — a blank English name on one row must not
      // leave the city unnamed when a sibling row carries it.
      if (existing.cityName === '') existing.cityName = cityName(d)
      continue
    }
    byCode.set(cityCode, {
      cityCode,
      cityName: cityName(d),
      deliverableDistricts: deliverable ? 1 : 0,
      deliverable,
      isCurrent: cityCode === current,
    })
  }

  const all = [...byCode.values()].sort((a, b) => a.cityName.localeCompare(b.cityName))
  const matched = all.filter((c) => term === '' || c.cityName.toLowerCase().includes(term))
  const pinned = current ? (all.find((c) => c.cityCode === current) ?? null) : null
  const listed = pinned ? matched.filter((c) => c.cityCode !== current) : matched

  return {
    pinned,
    rows: listed.slice(0, limit),
    truncated: listed.length > limit,
    total: matched.length,
  }
}

export function districtChoices(
  districts: SdDistrictModel[] | null | undefined,
  { query = '', currentDistrictCode = null, cityCode = null, limit = DEFAULT_LIMIT }: DistrictQuery,
): DistrictResults {
  const city = cityCode === null ? null : text(cityCode)
  const pickable = (districts ?? []).filter((d) => text(d?.districtCode) !== '')
  const rows = pickable.filter(
    (d) => city === null || city === '' || text(d?.cityCode) === city,
  )
  const term = query.trim().toLowerCase()
  const current = currentDistrictCode === null ? null : text(currentDistrictCode)

  const matched = rows.filter((d) => matches(d, term))
  // 🚩 The pin is looked up across the WHOLE list, never the city-scoped one.
  // The city step is one more thing that could hide the current pick, and the
  // rule this module already holds is that nothing which would hide it may clear
  // it — an address settled in Riyadh must not read as districtless the moment
  // the agent opens the city step to change it.
  const pinnedRow = current ? (pickable.find((d) => text(d.districtCode) === current) ?? null) : null
  const listed = pinnedRow ? matched.filter((d) => text(d.districtCode) !== current) : matched

  return {
    pinned: pinnedRow ? choice(pinnedRow, current) : null,
    rows: listed.slice(0, limit).map((d) => choice(d, current)),
    truncated: listed.length > limit,
    total: matched.length,
  }
}

/** CC2's four fields, `OrdinalIgnoreCase`, no folding. An empty box matches all. */
function matches(d: SdDistrictModel, term: string): boolean {
  if (term === '') return true
  return [d.districtNameEn, d.districtNameAr, d.cityNameEn, d.cityNameAr].some((name) =>
    text(name).toLowerCase().includes(term),
  )
}

/** The English name is what this en-only console reads; the Arabic one stays
 *  searchable, and falling back to it beats drawing an unnamed row. */
const cityName = (d: SdDistrictModel): string => text(d.cityNameEn) || text(d.cityNameAr)

function choice(d: SdDistrictModel, current: string | null): DistrictChoice {
  return {
    districtCode: text(d.districtCode),
    districtName: text(d.districtNameEn) || text(d.districtNameAr),
    cityCode: text(d.cityCode),
    cityName: cityName(d),
    deliverable: hasDeliveringStore(d),
    isCurrent: text(d.districtCode) === current,
  }
}

/**
 * The whole store question, asked as a boolean and answered inside this file.
 *
 * The operational override and the normal code are read the same way and neither
 * value leaves — which is exactly `NO_DELIVERY_STORE_FOR_DISTRICT`'s own
 * condition (§2.3: *"a district carrying neither `StoreCode` nor
 * `TempStoreCode`"*), so the client and the server are answering the same
 * question rather than two derivations of one.
 */
function hasDeliveringStore(d: SdDistrictModel): boolean {
  return text(d.tempStoreCode) !== '' || text(d.storeCode) !== ''
}

const text = (value: string | null | undefined): string => (value ?? '').trim()
