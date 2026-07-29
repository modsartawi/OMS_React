/**
 * The *about this item* panel's stock half (ticket 186, CONTRACT.md §3.5) — a
 * second pure module beside `price-check-view.ts` rather than a branch inside it,
 * because the two reads share a panel and a gate but **not a shape and not a
 * failure**.
 *
 * 🚩 **The separation IS the design.** The price is a lock-free engine run inside
 * SIS.Api's own process; this is the only read on the whole contract that is a
 * remote HTTP hop out to somebody else's service. A stock outage must not cost the
 * agent the price they asked for, so the two render together and fail
 * independently — which is a fact about two queries and two models, not about two
 * `try` blocks.
 *
 * 🚩 **Read-only by ruling, not omission** (§3.5 rule 1). Nothing this module
 * returns is a control, and there is no verb it could be wired to. A store change
 * re-prices every line, re-freezes every ATP and refuses atomically — a blast
 * radius that cannot live inside a per-item disclosure — and this list is ranked
 * *from* the order's plant, so a one-click rebind would invalidate the very list
 * it was clicked from. The panel names that path in words instead.
 *
 * 🚩 **Three answers, not two.** *We could not check* and *nobody else has it* are
 * different sentences with opposite consequences down a phone, and 135's three-way
 * ATP rule already ruled they must render differently. Here they are different
 * **states**, so no branch can draw one as the other and the `unknown` arm carries
 * no list for rows to leak into.
 */
import { apiErrorCode } from '@/core/api'
import type { StockElsewhereResult, StockElsewhereStore } from '@/core/models/callcenter'
import type { GuidancePhrase } from './guidance-view'

/** §3.5's three refusals, and no others — the read mints no new code. An unknown
 *  one is a minor-version addition and degrades to a sentence, never to a machine
 *  string on a screen the agent reads from (§9). */
const REFUSALS = ['ITEM_NOT_FOUND', 'NO_CUSTOMER_ATTACHED', 'STORE_NOT_CHOSEN']

/**
 * One store that has it, as the panel draws it.
 *
 * 🚩 **One availability number, and it is ATP** — the same definition the search
 * row already carries. The WPF till's grid shows on-hand in the adjacent column;
 * this surface carries ATP alone, because two availability numbers read down a
 * phone is how the larger one gets promised.
 */
export interface StockRow {
  plant: string
  city: string
  areaName: string
  /**
   * 🚩 The street `address` the wire also carries is deliberately NOT here. §3.5
   * rule 7 names a store by `plant` + `city` + `areaName`, and this row is one
   * line an agent reads down a phone while a caller waits — a street line would
   * wrap it and bury the two numbers that matter. Like `PriceQuote`, this type
   * earns its existence by DROPPING something rather than restating the wire.
   */
  atp: number
  /** 🚩 `null` draws blank and the store still appears. It is never coerced to
   *  `0` — a nought distance reads as *here*, which is the one store this list
   *  excludes by construction. */
  distanceKm: number | null
}

/**
 * The stock half's five states, closed.
 *
 * 🚩 Only `listed` has rows. *Unknown* and *none* are separate arms with no list
 * between them, so the difference §3.5 rule 5 insists on is structural rather than
 * a sentence a component remembered to pick.
 */
export type StockPanel =
  /** `capabilities.canPriceCheck` is not true — the same gate the price half
   *  reads, off the same field (§3.5 rule 7). */
  | { kind: 'shut' }
  | { kind: 'pending' }
  /** The read refused (§7's codes), in the agent's words. */
  | { kind: 'refused'; refusal: GuidancePhrase }
  /** 🚩 `available: false` — the hop did not answer. *We could not check*, which
   *  is NOT *nobody has it*. */
  | { kind: 'unknown' }
  /** The hop answered, and no other store can supply it. */
  | { kind: 'none' }
  | {
      kind: 'listed'
      rows: StockRow[]
      /** 🚩 `distanceKnown: false` — the origin plant has no coordinate, so this
       *  list is ordered by store code and says so. An unranked list that does
       *  not announce itself is read as nearest-first, which is the plausible
       *  wrong answer the whole rule exists to prevent. */
      unranked: boolean
      /** The honest total with stock BEFORE the cap — the server's own count,
       *  never `rows.length`. */
      withStock: number
      truncated: boolean
    }

export interface StockAsk {
  /** The server's gate, read strictly and off the same const the price half reads
   *  — one panel, one predicate (§3.5 rule 7). */
  canPriceCheck: boolean | undefined
  result?: StockElsewhereResult | null
  /** The thrown `ApiError`, where the read refused. */
  error?: unknown
  pending?: boolean
}

export function stockView({ canPriceCheck, result, error, pending }: StockAsk): StockPanel {
  if (canPriceCheck !== true) return { kind: 'shut' }
  // The refusal is read BEFORE the result, exactly as the price half reads it: a
  // stale success beside a fresh failure must read as the failure.
  if (error) return { kind: 'refused', refusal: refusalOf(error) }
  if (pending || !result) return { kind: 'pending' }
  // 🚩 `available` outranks the rows. A partial list from a hop that has just
  // told us it failed is not a list an agent may read down a phone — *these are
  // the stores that have it* would be a claim the server itself withdrew.
  if (result.available !== true) return { kind: 'unknown' }
  const stores = result.stores ?? []
  if (stores.length === 0) return { kind: 'none' }
  const unranked = result.distanceKnown !== true
  return {
    kind: 'listed',
    // 🚩 A ranked list is left EXACTLY as the server ranked it — it ranked from
    // the order's own plant, and a second definition of *nearest* on a screen
    // whose value is agreeing with the till is precisely what §3.5 rule 2 refuses
    // for the availability number. Only the unranked case is ordered here, and
    // ordering by store code is not a ranking: it is the alphabet, which is what
    // makes it safe to state as *not ordered by distance*.
    rows: (unranked ? [...stores].sort(byPlant) : stores).map(row),
    unranked,
    // Read, never derived. `withStock` is the count before the cap; taking it
    // from `rows.length` would turn *23 stores have it* into *2 do*.
    withStock: result.withStock,
    // 🚩 The ONE thing reconciled rather than trusted, and only in the direction
    // that can harm: the contract defines `truncated` as `withStock >
    // stores.length`, so an answer carrying `withStock: 23` with `truncated:
    // false` over three rows would have the panel say *23 stores with stock*
    // above a list of three — the honest-total rule inverted into a claim about
    // stores nobody can name. A count line may never out-claim its own list.
    truncated: result.truncated === true || result.withStock > stores.length,
  }
}

/** By store **code**, ordinally — not `localeCompare`, whose collation of real
 *  mixed codes (`BZ01` beside `1102`) is locale-dependent. §3.5 rule 4 says *by
 *  store code*, and the point of the fallback is that it is not a ranking anybody
 *  could read a meaning into, which needs it to be the same everywhere. */
const byPlant = (a: StockElsewhereStore, b: StockElsewhereStore) =>
  a.plant < b.plant ? -1 : a.plant > b.plant ? 1 : 0

const row = (store: StockElsewhereStore): StockRow => ({
  plant: store.plant,
  city: store.city ?? '',
  areaName: store.areaName ?? '',
  atp: store.atp,
  // 🚩 `?? null` and never `?? 0`: an absent distance is a value of its own and
  // the store keeps its place in the list regardless.
  distanceKm: store.distanceKm ?? null,
})

/**
 * Why the stores could not be listed, **in the agent's words** — §3.5's three
 * codes plus a degrade. 🚩 A refusal is not *nobody has it* either: both of the
 * console's honest negatives are said by their own state, and neither is ever
 * said by an empty list.
 *
 * ⚠ Deliberately a second copy of `price-check-view.ts`'s shape rather than a
 * shared helper the two share: the lists are §3.4's five codes and §3.5's three,
 * two contract sections that version independently, and one sentence per code per
 * section is exactly what stops a stock refusal borrowing a price refusal's
 * wording. A third read would be the moment to extract.
 */
function refusalOf(error: unknown): GuidancePhrase {
  const code = apiErrorCode(error)
  const known = typeof code === 'string' && REFUSALS.includes(code)
  return {
    key: known ? `callcenter:panel.stock.refused.${code}` : 'callcenter:panel.stock.refused.fallback',
    params: {},
  }
}
