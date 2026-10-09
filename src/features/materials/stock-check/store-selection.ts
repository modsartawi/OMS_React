// The stock check's store choice (ticket 453): stores picked one by one, whole sets added at once
// (an area, a city, a district, a supervisor), and "All stores". Pure: no React, no `t`.
//
// Store codes are strings, leading zeros kept. A chip remembers the name it was added with — the
// store lookup's address, or the set's `storeName` — so it can be shown; only the code is sent.

/** One chosen store. */
export interface ChosenStore {
  storeCode: string
  /** Free text, either script; `null` when the store was added by code alone. */
  storeName: string | null
}

export interface StoreSelection {
  /** "All stores": every store, sent as `stores: null`. The chips are kept, not sent. */
  all: boolean
  /** The chips, in the order they were added, each code once. */
  stores: ChosenStore[]
}

export const emptyStoreSelection = (): StoreSelection => ({ all: false, stores: [] })

/**
 * Add stores — one picked store, or a whole set — merged into the chips: a code already there is
 * not added twice (its first name is kept unless it had none). Choosing a store is choosing
 * specific stores, so it turns "All stores" off.
 */
export function addStores(selection: StoreSelection, added: readonly ChosenStore[]): StoreSelection {
  const byCode = new Map(selection.stores.map((s) => [s.storeCode, s]))
  for (const store of added) {
    const code = store.storeCode.trim()
    if (code === '') continue
    const had = byCode.get(code)
    if (!had) byCode.set(code, { storeCode: code, storeName: store.storeName })
    else if (had.storeName === null && store.storeName !== null) byCode.set(code, { ...had, storeName: store.storeName })
  }
  return { all: false, stores: [...byCode.values()] }
}

/** Remove one chip. */
export function removeStore(selection: StoreSelection, storeCode: string): StoreSelection {
  return { ...selection, stores: selection.stores.filter((s) => s.storeCode !== storeCode) }
}

/** Clear every chip. */
export const clearStores = (selection: StoreSelection): StoreSelection => ({ ...selection, stores: [] })

/** Turn "All stores" on or off. The chips survive, so turning it off again gives them back. */
export const setAllStores = (selection: StoreSelection, all: boolean): StoreSelection => ({ ...selection, all })

/** The request's `stores`: `null` for "All stores", else the chips' codes, in order. */
export function selectedStoreCodes(selection: StoreSelection): string[] | null {
  return selection.all ? null : selection.stores.map((s) => s.storeCode)
}

/** True when the choice can be asked about: "All stores", or at least one chip. */
export const hasStoreChoice = (selection: StoreSelection): boolean => selection.all || selection.stores.length > 0

/** The fields of the store lookup a store is found by and named with (`StoreDetailModel`). */
export interface LookupStore {
  storeCode: string
  city: string | null
  region: string | null
  storeAddress: string | null
}

/** A looked-up store as a chip: the lookup has no name field, so its address names it (else its city). */
export function chosenFromLookup(store: LookupStore): ChosenStore {
  const name = (store.storeAddress ?? '').trim() || (store.city ?? '').trim()
  return { storeCode: (store.storeCode ?? '').trim(), storeName: name === '' ? null : name }
}

/**
 * "Pick stores by code or name": every typed word must appear in the store's code, city, region
 * or address, ignoring case. A blank query matches nothing — the list is offered as you type.
 */
export function matchesStore(store: LookupStore, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter((w) => w !== '')
  if (words.length === 0) return false
  const haystack = [store.storeCode, store.city, store.region, store.storeAddress]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
    .toLowerCase()
  return words.every((w) => haystack.includes(w))
}

/** A store of a set (`StoreSets/{kind}/{value}`) as a chip, named by the set's own `storeName`. */
export const chosenFromSet = (store: { storeCode: string; storeName: string | null }): ChosenStore => ({
  storeCode: store.storeCode,
  storeName: store.storeName,
})
