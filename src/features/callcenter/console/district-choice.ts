/**
 * The district picker's one box, as a pure projection — CC2's unified search
 * ([inventory §3](../../../../.issues/assets/175-cc2-inventory/CC2-INVENTORY.md))
 * over the district list this repo has cached since Screen 2, plus the single
 * question the client is allowed to ask about a store.
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
  /** Picked WITH the district — CC2's pick commits both, so a caller who names
   *  their district never has to be asked their city. */
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
  /** The list is ~1,700 rows; an empty box must not hand all of them to the DOM. */
  limit?: number
}

const DEFAULT_LIMIT = 30

export function districtChoices(
  districts: SdDistrictModel[] | null | undefined,
  { query = '', currentDistrictCode = null, limit = DEFAULT_LIMIT }: DistrictQuery,
): DistrictResults {
  const rows = (districts ?? []).filter((d) => text(d?.districtCode) !== '')
  const term = query.trim().toLowerCase()
  const current = currentDistrictCode === null ? null : text(currentDistrictCode)

  const matched = rows.filter((d) => matches(d, term))
  const pinnedRow = current ? (rows.find((d) => text(d.districtCode) === current) ?? null) : null
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

function choice(d: SdDistrictModel, current: string | null): DistrictChoice {
  return {
    districtCode: text(d.districtCode),
    // The English name is what the console reads; the Arabic one is searchable
    // but is not what this en-only screen draws, and falling back to it beats
    // drawing an unnamed row.
    districtName: text(d.districtNameEn) || text(d.districtNameAr),
    cityCode: text(d.cityCode),
    cityName: text(d.cityNameEn) || text(d.cityNameAr),
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
