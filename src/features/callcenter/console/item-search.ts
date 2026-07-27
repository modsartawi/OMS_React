/**
 * The item search's two derivations — **how availability is classified** and
 * **what one search row reads as** — as one pure module, because they are the
 * two rulings of ticket 168 and both are properties of the row rather than of
 * the panel.
 *
 * 🚩 **The estimate never enters the money column.** The row price is
 * `Item.UnitPrice`, a material-master column served as an ex-VAT estimate; VAT
 * is a separate 15% condition, so it reads **~13% under** the basket line beside
 * it and an agent who quotes it raw under-quotes, mid-call, out loud. 135
 * amendment 1's fix is spatial and typographic: the estimate rides the **meta
 * line beside the item number**, where a price never otherwise appears, with `≈`
 * and **no currency word** — `SAR` is reserved for engine money — and the row's
 * end edge carries availability and *Add* only.
 *
 * That rule lives HERE, in a view model of exactly four fields, rather than in
 * JSX. A component whose markup happened to put the estimate in the right place
 * is one refactor away from putting it back in the wrong one; a row model with
 * no money-column field to assign cannot.
 *
 * 🚩 **`unknown` is not `zero`.** A degraded stock read is `atp: null` on a 200
 * (never a non-200), and *none at store* and *stock unknown* are opposite
 * decisions for the agent: one says stop, the other says carry on and find out.
 * So they differ in ground, ink **and** wording — three classifications, never
 * one word re-toned.
 *
 * Nothing here filters, ranks or re-prices. Eligibility (CC1's whitelist), the
 * ATP annotation and the ordering are all the server's (BackOffice 799), which
 * is what makes every row addable in one action.
 */
import type { ItemSearchResult, ItemSearchRow } from '@/core/models/callcenter'
import { formatMoney } from '@/core/util/number-format'

/** The endpoint rejects a shorter term with a 400 (799). Held client-side so the
 *  console does not spend a round trip being told off while the caller waits. */
export const MIN_QUERY_LENGTH = 3

/** What marks the estimate as an approximation. Not a currency word, and
 *  deliberately not a word at all: it survives being read at a glance. */
export const ESTIMATE_MARK = '≈'

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH
}

/**
 * The three availability states, as one closed classification.
 *
 * - `count` — stock at the order's plant. The number is the fact.
 * - `none` — the plant has none. A refusal to plan around, not an error.
 * - `unknown` — the stock read degraded (`atp: null`, or a field the server did
 *   not send at all). **Not a zero**, and not a reason to stop: unknown
 *   availability never gates order entry (§5.2).
 *
 * `tone` and `labelKey` are separate on purpose. Together they are what makes
 * the three differ in ground, ink AND wording — a single `tone` would let a
 * future edit distinguish them by colour alone, which is precisely what 135
 * ruled out.
 */
export type AvailabilityKind = 'count' | 'none' | 'unknown'

export interface Availability {
  kind: AvailabilityKind
  /** The count where there is one, `null` where availability is unknown. Never
   *  a stand-in: a `null` rendered through the count's slot reads as none. */
  quantity: number | null
  /** i18n key suffix under `search.atp.*` — three distinct sentences. */
  labelKey: AvailabilityKind
  /** Ground + ink. Distinct per kind, and never the only difference. */
  tone: 'positive' | 'negative' | 'caution'
}

export function availabilityOf(atp: number | null | undefined): Availability {
  if (typeof atp !== 'number' || !Number.isFinite(atp))
    return { kind: 'unknown', quantity: null, labelKey: 'unknown', tone: 'caution' }
  // Negative stock is a real master-data state; it is none, not a count to show.
  if (atp <= 0) return { kind: 'none', quantity: atp, labelKey: 'none', tone: 'negative' }
  return { kind: 'count', quantity: atp, labelKey: 'count', tone: 'positive' }
}

/**
 * One part of the row's **second line**, in the order it is read.
 *
 * All three are bidi-isolated with the **`dir`-pinned** wrapper (`@/core/ui/Ltr`
 * — `<bdi dir="ltr">`), which is 138's ruling: a bare `<bdi>` implies
 * `dir="auto"`, and an Arabic run then flips the whole block, detaching the name
 * from the line it belongs to. The isolation is wanted; the flip is not.
 */
export interface MetaPart {
  id: 'itemNumber' | 'description2' | 'estimate'
  /** Server text, or the composed estimate. Never a key. */
  text: string
}

/**
 * One search row, as four fields and no fifth.
 *
 * `availability` IS the end edge — there is nowhere else for a figure to go, and
 * that is the guarantee this shape exists to give.
 */
export interface SearchRowView {
  /** What `addItem` is given. */
  itemNumber: string
  /** The row's first line, and nothing else on it: the name the agent reads out. */
  title: string
  /** The second line: item number · Arabic name · estimate, each dropped where
   *  the master carries nothing rather than drawn as an empty segment. */
  meta: MetaPart[]
  availability: Availability
}

export function searchRowView(row: ItemSearchRow): SearchRowView {
  const meta: MetaPart[] = [{ id: 'itemNumber', text: row.materialNumber }]
  if (row.descriptionAr) meta.push({ id: 'description2', text: row.descriptionAr })
  // 🚩 An absent estimate is dropped, never rendered as `≈0.00`: a nought price
  // on a row an agent may quote from is worse than no price at all. `formatMoney`
  // already answers a non-number with an empty string, so the absence is read
  // off the formatter rather than predicated a second time here.
  const estimate = formatMoney(row.estimatePriceExVat)
  if (estimate) meta.push({ id: 'estimate', text: `${ESTIMATE_MARK}${estimate}` })

  return {
    itemNumber: row.materialNumber,
    title: row.descriptionEn,
    meta,
    availability: availabilityOf(row.atp),
  }
}

/** The whole answer, in the server's own ranking — nothing here re-sorts it. */
export function searchRowViews(result: ItemSearchResult | undefined | null): SearchRowView[] {
  return (result?.rows ?? []).map(searchRowView)
}
