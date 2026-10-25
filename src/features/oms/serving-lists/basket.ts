/**
 * The add-stores basket (oms ticket 569; BackOffice spec 3042 stories 31, 41): the codes an editor gathers
 * across several searches and pastes, sent in ONE `POST ServingListWeb/Lists/{id}/Stores`. Pure: no React.
 *
 * Codes are matched case-insensitively everywhere, keeping the first spelling — the door trims and de-dups the
 * same way (BackOffice 3045), and names its `badStoreCodes` in the request's spelling.
 */
import type { ServingListAddStoresRequest, ServingListStoreRow } from '@/core/models/serving-list'
import { normaliseCodeList } from '@/core/util/code-list'

const key = (code: string) => code.trim().toUpperCase()

/** Drop a repeat of an earlier code, whatever its case; the first spelling stays. */
function uniqueCodes(codes: readonly string[]): string[] {
  const seen = new Set<string>()
  return codes.filter((c) => {
    const k = key(c)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** A pasted contract sheet: one code per line, or comma / space separated; trimmed, blanks dropped, de-duplicated. */
export function parsePastedCodes(text: string): string[] {
  const list = normaliseCodeList(text)
  return list === '' ? [] : uniqueCodes(list.split(','))
}

/**
 * One basket entry. A pick from the search knows its name, city and `closed`; a pasted code knows only itself
 * (the door says whether it exists).
 */
export interface BasketItem {
  storeCode: string
  name?: string
  city?: string
  closed?: boolean
}

/** In the order the codes went in. */
export type Basket = readonly BasketItem[]

export const EMPTY_BASKET: Basket = []

export const basketCodes = (b: Basket): string[] => b.map((i) => i.storeCode)

export const inBasket = (b: Basket, code: string): boolean => b.some((i) => key(i.storeCode) === key(code))

/** A store already on the list is shown checked off and cannot be picked; a closed one can. */
export const pickable = (row: ServingListStoreRow): boolean => !row.onList

const fromHit = (row: ServingListStoreRow): BasketItem => ({ storeCode: row.storeCode, name: row.name, city: row.city, closed: row.closed })

/** Pick a hit, or take it back out when it is already picked. A store on the list is never picked. */
export function toggleHit(b: Basket, row: ServingListStoreRow): Basket {
  if (inBasket(b, row.storeCode)) return removeCodes(b, [row.storeCode])
  return pickable(row) ? [...b, fromHit(row)] : b
}

/** Pick every shown hit that is neither on the list nor already picked. */
export function addHits(b: Basket, rows: readonly ServingListStoreRow[]): Basket {
  let next = b
  for (const row of rows) if (pickable(row) && !inBasket(next, row.storeCode)) next = [...next, fromHit(row)]
  return next
}

/** Paste codes in: the new ones go in, a code already in the basket is counted as skipped. */
export function addPasted(b: Basket, text: string): { basket: Basket; added: number; skipped: number } {
  const codes = parsePastedCodes(text)
  const fresh = codes.filter((c) => !inBasket(b, c))
  return { basket: [...b, ...fresh.map((storeCode) => ({ storeCode }))], added: fresh.length, skipped: codes.length - fresh.length }
}

/** Take codes out, whatever their case — "Remove these and retry" after a refused batch. */
export function removeCodes(b: Basket, codes: readonly string[]): Basket {
  const out = new Set(codes.map(key))
  return b.filter((i) => !out.has(key(i.storeCode)))
}

/** The add door's body: every code, and the note trimmed (absent when blank). */
export function basketBody(b: Basket, note: string): ServingListAddStoresRequest {
  const trimmed = note.trim()
  return trimmed ? { storeCodes: basketCodes(b), note: trimmed } : { storeCodes: basketCodes(b) }
}
