/**
 * The Grid tab's pure rules (oms 935, BackOffice spec 4127 decisions 6 and 8): how a competitor cell is drawn from its
 * state. No React, no `t` — the components in `GridCells.tsx` only render what this returns.
 *
 * BO 4129 as shipped (`PriceWatchGridService.cs`, BO pricing2 d099aac36) — see the Grid section of `@/core/models/price-watch`.
 */
import { formatMoneyIn } from '@/core/money'
import {
  PRICE_GRID_CELL_STATES,
  type PriceGridCell,
  type PriceGridCellState,
  type PriceGridCompetitor,
  type PriceGridQuery,
  type PriceGridRow,
  type PriceGridSort,
} from '@/core/models/price-watch'
import { formatDateTime } from '@/core/util/date-format'

/** A cell with a price to show: PRICED, or OOS with its last price. */
export interface PricedCellView {
  kind: 'price'
  state: 'PRICED' | 'OOS'
  /** The paid price (offer ?? regular), formatted. */
  paid: string
  /** The regular price, struck through — only when there is an offer below it. */
  struck: string | null
  /** The offer as a discount, `-10%`; null without an offer. */
  offerPercent: string | null
  /** The seller — only when a third party sells it (`isPlatformSeller` false: such a price never counts); '' otherwise. */
  seller: string
  /** When the price shown was read (`priceObservedAt`, else `observedAt`): `yyyy-MM-dd HH:mm`, '' when absent. */
  observed: string
  stale: boolean
  cheapest: boolean
}

/** A cell with no price by its nature: not carried, no product match, comparable only. */
export interface AbsentCellView {
  kind: 'absent'
  state: Exclude<PriceGridCellState, 'PRICED' | 'OOS'>
  cheapest: boolean
}

/** A state this client does not know (a newer server): drawn as unknown, never as a price. */
export interface UnknownCellView {
  kind: 'unknown'
  cheapest: false
}

export type CellView = PricedCellView | AbsentCellView | UnknownCellView

const isState = (s: string): s is PriceGridCellState => (PRICE_GRID_CELL_STATES as readonly string[]).includes(s)

const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

/** An offer as the discount it is: `-10%`, `-12.5%`. */
export function formatOfferPercent(p: number | null): string | null {
  if (p === null || !Number.isFinite(p) || p <= 0) return null
  return `-${percent.format(p)}%`
}

/**
 * How one competitor cell is drawn. `competitor` is the cell's column. The grid wire carries no column kind, so the
 * seller is named by the cell's own `isPlatformSeller` (a marketplace third party), not by the column.
 */
export function cellView(cell: PriceGridCell, _competitor: PriceGridCompetitor, currency: string): CellView {
  if (!isState(cell.state)) return { kind: 'unknown', cheapest: false }
  if (cell.state !== 'PRICED' && cell.state !== 'OOS') return { kind: 'absent', state: cell.state, cheapest: cell.isCheapest }
  const hasOffer = cell.offerPrice !== null && cell.regularPrice !== null && cell.offerPrice < cell.regularPrice
  const paid = cell.paidPrice ?? cell.offerPrice ?? cell.regularPrice
  return {
    kind: 'price',
    state: cell.state,
    paid: formatMoneyIn(paid, currency),
    struck: hasOffer ? formatMoneyIn(cell.regularPrice, currency) : null,
    offerPercent: hasOffer ? formatOfferPercent(cell.offerPercent) : null,
    seller: cell.isPlatformSeller ? '' : cell.sellerName.trim(),
    observed: formatDateTime(cell.priceObservedAt ?? cell.observedAt),
    stale: cell.isStale,
    cheapest: cell.isCheapest,
  }
}

/** The grid's filters and sort, as the form holds them. */
export interface GridFilter {
  /** A-level code, exact; '' = any. */
  aLevel: string
  /** B-level code, exact; '' = any. */
  bLevel: string
  brand: string
  /** Competitor code; '' = any. */
  competitor: string
  /** Only rows where a competitor is cheaper than us. */
  competitorCheaper: boolean
  sort: PriceGridSort
}

export const DEFAULT_GRID_FILTER: GridFilter = { aLevel: '', bLevel: '', brand: '', competitor: '', competitorCheaper: false, sort: 'units' }

/** Rows a server page (BO 4129: default 50, max 200). */
export const GRID_PAGE_SIZE = 50

/** The query one page of the grid reads. Blank text filters are dropped; "competitor cheaper" only when asked. */
export function gridRequest(filter: GridFilter, page: number): PriceGridQuery {
  const query: PriceGridQuery = { sort: filter.sort, page: Math.max(1, Math.floor(page)), pageSize: GRID_PAGE_SIZE }
  const aLevel = filter.aLevel.trim()
  const bLevel = filter.bLevel.trim()
  const brand = filter.brand.trim()
  const competitor = filter.competitor.trim()
  if (aLevel) query.aLevel = aLevel
  if (bLevel) query.bLevel = bLevel
  if (brand) query.brand = brand
  if (competitor) query.competitor = competitor
  if (filter.competitorCheaper) query.competitorCheaper = true
  return query
}

/** Our column: effective over basic, and the deal text (the applied deal when there is one). */
export interface OursView {
  priced: boolean
  effective: string
  basic: string
  deal: string
}

export function oursView(row: PriceGridRow): OursView {
  const priced = row.isPriced && row.effectivePrice !== null
  return {
    priced,
    effective: priced ? formatMoneyIn(row.effectivePrice, row.currency) : '',
    basic: priced ? formatMoneyIn(row.basicPrice, row.currency) : '',
    deal: (row.appliedDealText || row.dealText).trim(),
  }
}
