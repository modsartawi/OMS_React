// Pure DTO→render-model map for the BBY Details modal (spec 061, ticket 066) — the
// tested seam that carries the modal's one real branch. Mirrors the sim `promoView`
// precedent (ticket 045): the Page/modal component stays a thin renderer, the logic
// lives here, in-memory testable. Kept dependency-free (no `@/` imports, no i18n, no
// network, no `Date`) so it runs in a node/tsx harness alongside `formatters` /
// `codeLabels` / `list-params`. `today` is passed in (never read off the clock here)
// so the validity branch is deterministic under test.
//
// The one meaningful decision: `condTargetType === 'R'` selects the **total-discount**
// branch (Document mode — Get collapses to one card, Buy shows an empty note), every
// other target selects the **rows** branch. Raw codes/dates ride through untouched;
// the render tier resolves them via `codeLabels` + `t()` and `formatters`.

import type {
  BbyBuyRow,
  BbyDetailDto,
  BbyGetRow,
  BbyTotalDiscount,
} from '@/core/models/bonus-buy-inquiry'

/** Which layout the Get side renders: the per-condition table, or the single
 *  Document total-discount card (`condTargetType === 'R'`). */
export type DetailMode = 'rows' | 'totalDiscount'

/** Title-bar validity marker, computed from the header status + window vs `today`
 *  (glossary 054: ordinal `yyyyMMdd` compare). `null` = no badge (e.g. an in-window
 *  but non-Activated BBY — the status badge already carries that). */
export type ValidityState = 'live' | 'ended' | 'notStarted' | null

/** How a Get-side discount value reads: `percent` shows `condValueP` with `%`,
 *  `amount` shows `condValue` with the org currency, `plain` shows `condValue` bare
 *  (the defensive fallback for an unexpected discount code — spec's stray `N`). */
export type DiscountKind = 'percent' | 'amount' | 'plain'

/** A Buy prerequisite row, shaped for the lightweight modal table. Raw values pass
 *  through; `drilldownEnabled` marks a grouping worth a members drilldown (slice 067). */
export interface DetailBuyRow extends BbyBuyRow {
  drilldownEnabled: boolean
}

/** A Get condition row plus the resolved discount presentation. */
export interface DetailGetRow extends BbyGetRow {
  drilldownEnabled: boolean
  /** Which value + unit to show (see DiscountKind). */
  discountKind: DiscountKind
  /** The number to render — `condValueP` for `percent`, else `condValue`. */
  discountAmount: number
}

/** The Document total-discount figure, carrying the SAME resolved presentation as a
 *  Get row so the render tier never re-decides `%`-vs-currency for one code path. */
export interface DetailTotalDiscount extends BbyTotalDiscount {
  discountKind: DiscountKind
  discountAmount: number
}

export interface DetailView {
  header: BbyDetailDto['header']
  org: BbyDetailDto['org']
  /** Title-bar "active now / ended / not started" marker (or null). */
  validity: ValidityState
  /** `'totalDiscount'` iff `condTargetType === 'R'`; `'rows'` otherwise. */
  mode: DetailMode
  buy: DetailBuyRow[]
  /** Empty in `totalDiscount` mode. */
  get: DetailGetRow[]
  /** Non-null only in `totalDiscount` mode. */
  totalDiscount: DetailTotalDiscount | null
}

/** A grouping row is drilldown-enabled when it stands for at least one member SKU. */
function drilldownEnabled(row: { isGrouping: boolean; memberCount: number }): boolean {
  return row.isGrouping && row.memberCount > 0
}

/** `%` → percent (`condValueP`); `R` → amount (`condValue` + currency); anything else
 *  → plain `condValue` (defensive: a legacy free-goods `N` degrades, never throws). */
function discountKind(discountType: string): DiscountKind {
  if (discountType === '%') return 'percent'
  if (discountType === 'R') return 'amount'
  return 'plain'
}

/** Validity marker per the glossary rule — window first (ended / not-yet-started
 *  read regardless of status), then Activated → live. Ordinal string compare on the
 *  raw `yyyyMMdd` values; empty bounds are treated as open. */
function validityState(
  header: { bbyStatus: string; validFrom: string; validTo: string },
  today: string,
): ValidityState {
  if (header.validTo && header.validTo < today) return 'ended'
  if (header.validFrom && header.validFrom > today) return 'notStarted'
  if (header.bbyStatus === 'A') return 'live'
  return null
}

/**
 * Map a `BbyDetailDto` to the modal's render model. `today` is a `yyyyMMdd` string
 * (the render tier supplies it) so the validity branch is deterministic. The Get
 * branch is selected on `condTargetType === 'R'`: Document mode keeps `get: []` and a
 * non-null `totalDiscount`; every other target maps the per-condition rows and leaves
 * `totalDiscount: null`.
 */
export function toDetailView(dto: BbyDetailDto, today: string): DetailView {
  const isDocument = dto.header.condTargetType === 'R'

  const buy: DetailBuyRow[] = dto.buy.map((r) => ({
    ...r,
    drilldownEnabled: drilldownEnabled(r),
  }))

  const get: DetailGetRow[] = isDocument
    ? []
    : dto.get.map((r) => {
        const kind = discountKind(r.discountType)
        return {
          ...r,
          drilldownEnabled: drilldownEnabled(r),
          discountKind: kind,
          discountAmount: kind === 'percent' ? r.condValueP : r.condValue,
        }
      })

  let totalDiscount: DetailTotalDiscount | null = null
  if (isDocument && dto.totalDiscount) {
    const kind = discountKind(dto.totalDiscount.discountType)
    totalDiscount = {
      ...dto.totalDiscount,
      discountKind: kind,
      discountAmount: kind === 'percent' ? dto.totalDiscount.condValueP : dto.totalDiscount.condValue,
    }
  }

  return {
    header: dto.header,
    org: dto.org,
    validity: validityState(dto.header, today),
    mode: isDocument ? 'totalDiscount' : 'rows',
    buy,
    get,
    totalDiscount,
  }
}
