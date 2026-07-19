import type {
  AppliedBonusBuy,
  PotentialBonusBuy,
  PrereqStatus,
  SimulationResult,
  SimulationResultItem,
} from '@/core/models/simulation'

// Pure view model for the reworked results-and-promotions surface (spec 043,
// ticket 045). Turns a `SimulationResult` into the three collections the B+C
// hybrid renders — glanceable per-line promo annotations, plain-language buy→get
// blocks, and the didn't-fire "Could have applied" list. Kept pure and machine-
// token-only (no formatting, no i18n — those live at the render tier, tickets
// 046/047) so it is the natural first unit beside `aggregateConditions` when the
// vitest runner lands. Draws the EXACT buy→get relationship from the applied-BBY
// projection (ticket 044: `applications` + `discountKind` on each AppliedBonusBuy);
// degrades gracefully to the flat `affectedItemNumbers` when that projection is
// absent — one undivided block, no role, no cross-highlight partnering, never throws.

/** The four discount kinds (taxonomy 040): `N`→free, `%`→percent, `R`→fixed,
 *  `P`→setprice. `null` when the code can't be classified (kept honest, not guessed). */
export type PromoKind = 'free' | 'percent' | 'fixed' | 'setprice'

/** A line's role in a promotion — buy (prerequisite), get (reward), or both (a
 *  buy-line set-price). `null` on the degradation path, where the split is unknown. */
export type PromoRole = 'buy' | 'get' | 'buy+get'

/** A lightweight snapshot of a basket line a block references, carrying only what
 *  the buy/get boxes render — the render tier formats the money. */
export interface PromoItemRef {
  itemNumber: number
  materialNumber: string
  materialDescription: string
  quantity: number
  unitOfMeasure: string
  grossValue: number
  netValue: number
}

/** A reward (get) line: an item ref plus the savings landed on it and whether it is
 *  fully free (net rounds to zero) — the "FREE" vs struck-price render decision. */
export interface PromoGetLine extends PromoItemRef {
  savings: number
  free: boolean
}

/** One promotion touching a result line — the grid's per-line Promotion column
 *  shows one chip per ref (a line under two promotions carries two). */
export interface PromoLineRef {
  bbyNumber: string
  kind: PromoKind | null
  role: PromoRole | null
  conditionKey: string | null
}

/** A result line annotated with the promotions touching it, in result-item order.
 *  `promos` is empty for a plain, un-promoted line. */
export interface PromoLine {
  itemNumber: number
  promos: PromoLineRef[]
}

/** One fired promotion, presented as a buy→get relationship. `buyItems`/`getLines`
 *  are populated from the projection's `applications`; on the degradation path they
 *  are empty and `touchedItems` carries the flat affected lines instead. */
export interface PromoBlock {
  bbyNumber: string
  promoNumber: string
  offerId: string
  description: string
  kind: PromoKind | null
  remainingUsage: number
  totalSaved: number
  /** How many times this same promo fired into the one card — the count of distinct
   *  `conditionKey`s the engine stamped for it (each key = one application). Counted
   *  from the raw line conditions so it holds even on the degradation path, where the
   *  `applications` split is absent. `1` (or `0` when no key is present) means a single
   *  firing; the render shows the badge only when it is > 1. */
  appliedCount: number
  /** True when this block lacks the buy/get split (pre-projection response). */
  degraded: boolean
  applications: AppliedBonusBuyApplicationView[]
  buyItems: PromoItemRef[]
  getLines: PromoGetLine[]
  /** Every line the promotion touched, split or not — the degradation-path render. */
  touchedItems: PromoItemRef[]
}

/** An application's buy→get split, resolved to item refs. */
export interface AppliedBonusBuyApplicationView {
  conditionKey: string
  buyItems: PromoItemRef[]
  getLines: PromoGetLine[]
}

/** The driving unmet prerequisite of a missed promotion — found vs required. */
export interface MissedPrereq {
  materialNumber: string | null
  matGrouping: string | null
  requiredQty: number
  foundQty: number
  minValue: number
  foundValue: number
}

/** One promotion that could have applied but did not — the "Could have applied" list. */
export interface MissedPromo {
  bbyNumber: string
  promoNumber: string
  offerId: string
  description: string
  kind: PromoKind | null
  /** The first unmet prerequisite, or `null` when all were met but accumulation
   *  blocked it (see `skipReason`). */
  prereq: MissedPrereq | null
  /** The discount the promotion would have granted, from its potential discount. */
  wouldSave: number | null
  skipReason: string | null
}

export interface PromoView {
  lines: PromoLine[]
  blocks: PromoBlock[]
  missed: MissedPromo[]
  /** True when ANY fired block fell back to the flat affected-items path. */
  degraded: boolean
}

/** Clean discount code (`N`/`%`/`R`/`P`) → kind. */
function kindFromClean(code: string | null | undefined): PromoKind | null {
  switch (code) {
    case 'N':
      return 'free'
    case '%':
      return 'percent'
    case 'R':
      return 'fixed'
    case 'P':
      return 'setprice'
    default:
      return null
  }
}

/** Raw SAP condition code → kind, so a degraded block (only the raw `discountType`)
 *  still classifies. VKA0 = free goods, ZB03/ZB13 = percent, ZB02/ZB12 = fixed,
 *  ZB01 = set price (taxonomy 040). */
function kindFromSap(code: string | null | undefined): PromoKind | null {
  switch ((code ?? '').toUpperCase()) {
    case 'VKA0':
      return 'free'
    case 'ZB03':
    case 'ZB13':
      return 'percent'
    case 'ZB02':
    case 'ZB12':
      return 'fixed'
    case 'ZB01':
      return 'setprice'
    default:
      return null
  }
}

/** The block's kind: prefer the projection's clean `discountKind`, else map the raw
 *  SAP `discountType` (also handles a raw response that already carries a clean code). */
function appliedKind(bby: AppliedBonusBuy): PromoKind | null {
  return kindFromClean(bby.discountKind) ?? kindFromClean(bby.discountType) ?? kindFromSap(bby.discountType)
}

/** A net value rounds to zero (a fully-free reward line). Guards float dust. */
function isFree(netValue: number): boolean {
  return Math.abs(netValue) < 0.005
}

function toItemRef(item: SimulationResultItem): PromoItemRef {
  return {
    itemNumber: item.itemNumber,
    materialNumber: item.materialNumber,
    materialDescription: item.materialDescription,
    quantity: item.quantity,
    unitOfMeasure: item.unitOfMeasure,
    grossValue: item.grossValue,
    netValue: item.netValue,
  }
}

function toGetLine(item: SimulationResultItem): PromoGetLine {
  const savings = Math.max(0, item.grossValue - item.netValue)
  return { ...toItemRef(item), savings, free: isFree(item.netValue) }
}

/** Distinct, order-preserving. */
function distinct<T>(values: T[]): T[] {
  return [...new Set(values)]
}

/**
 * Build the reworked surface's view model from a simulation result. Pure — the same
 * result always yields the same view; no dates, no formatting, no i18n.
 */
export function promoView(result: SimulationResult | null | undefined): PromoView {
  const items = result?.items ?? []
  const applied = result?.appliedBonusBuys ?? []
  const potential = result?.potentialBonusBuys ?? []
  const itemByNumber = new Map<number, SimulationResultItem>(items.map((i) => [i.itemNumber, i]))

  // How many times each promo fired into its single card = its distinct `conditionKey`s,
  // the engine's per-application join (a "2 PC for 29.95" bought ×4 is ONE key per pair of
  // pieces → 2 firings, even though it stamps 4 discount rows). Only `conditionKey` groups
  // the rows of one firing, so it is the ONLY honest signal — a raw row count would count
  // pieces, not applications. Absent until the applied-BBY projection (ticket 044) ships;
  // when it is, `appliedCount` populates and the badge appears with no further change.
  const keysByBby = new Map<string, Set<string>>()
  for (const item of items) {
    for (const cond of item.conditions ?? []) {
      if (!cond.isBonusBuy || !cond.bbyNumber || !cond.conditionKey) continue
      const set = keysByBby.get(cond.bbyNumber) ?? new Set<string>()
      set.add(cond.conditionKey)
      keysByBby.set(cond.bbyNumber, set)
    }
  }

  // Per-line promotion refs, accumulated as we walk each block, then emitted in
  // result-item order (a plain line keeps an empty `promos`).
  const refsByItem = new Map<number, PromoLineRef[]>()
  const addRef = (itemNumber: number, ref: PromoLineRef) => {
    const list = refsByItem.get(itemNumber)
    if (list) list.push(ref)
    else refsByItem.set(itemNumber, [ref])
  }

  let degraded = false
  const blocks: PromoBlock[] = applied.map((bby) => {
    const kind = appliedKind(bby)
    const hasSplit = Array.isArray(bby.applications) && bby.applications.length > 0
    // Distinct condition keys, else the applications split (also per-firing) — 0 when
    // neither is present (pre-044 payload), which hides the "applied N×" badge.
    const appliedCount = keysByBby.get(bby.bbyNumber)?.size || (bby.applications?.length ?? 0)

    if (hasSplit) {
      const applications: AppliedBonusBuyApplicationView[] = bby.applications!.map((app) => {
        const buyItems = distinct(app.buyItemNumbers)
          .map((n) => itemByNumber.get(n))
          .filter((i): i is SimulationResultItem => i != null)
          .map(toItemRef)
        const getLines = distinct(app.getItemNumbers)
          .map((n) => itemByNumber.get(n))
          .filter((i): i is SimulationResultItem => i != null)
          .map(toGetLine)
        return { conditionKey: app.conditionKey, buyItems, getLines }
      })

      // Per-line refs: a line's role is derived from which side(s) of its
      // application it sits on — both sides ⇒ buy+get (a self-discounted prereq).
      for (const app of bby.applications!) {
        const buySet = new Set(app.buyItemNumbers)
        const getSet = new Set(app.getItemNumbers)
        for (const n of distinct([...app.buyItemNumbers, ...app.getItemNumbers])) {
          const role: PromoRole = buySet.has(n) && getSet.has(n) ? 'buy+get' : buySet.has(n) ? 'buy' : 'get'
          addRef(n, { bbyNumber: bby.bbyNumber, kind, role, conditionKey: app.conditionKey })
        }
      }

      const buyItems = dedupeRefs(applications.flatMap((a) => a.buyItems))
      const getLines = dedupeGetLines(applications.flatMap((a) => a.getLines))
      return {
        bbyNumber: bby.bbyNumber,
        promoNumber: bby.promoNumber,
        offerId: bby.offerId,
        description: bby.description,
        kind,
        remainingUsage: bby.remainingUsage,
        totalSaved: bby.totalDiscountValue,
        appliedCount,
        degraded: false,
        applications,
        buyItems,
        getLines,
        touchedItems: dedupeRefs([...buyItems, ...getLines.map(stripGetLine)]),
      }
    }

    // Degradation: no split — one undivided block off the flat affected lines,
    // role left null, no conditionKey partnering.
    degraded = true
    const touchedItems = distinct(bby.affectedItemNumbers ?? [])
      .map((n) => itemByNumber.get(n))
      .filter((i): i is SimulationResultItem => i != null)
      .map(toItemRef)
    for (const ref of touchedItems) {
      addRef(ref.itemNumber, { bbyNumber: bby.bbyNumber, kind, role: null, conditionKey: null })
    }
    return {
      bbyNumber: bby.bbyNumber,
      promoNumber: bby.promoNumber,
      offerId: bby.offerId,
      description: bby.description,
      kind,
      remainingUsage: bby.remainingUsage,
      totalSaved: bby.totalDiscountValue,
      appliedCount,
      degraded: true,
      applications: [],
      buyItems: [],
      getLines: [],
      touchedItems,
    }
  })

  const lines: PromoLine[] = items.map((i) => ({
    itemNumber: i.itemNumber,
    promos: refsByItem.get(i.itemNumber) ?? [],
  }))

  const missed: MissedPromo[] = potential.map((p) => buildMissed(p))

  return { lines, blocks, missed, degraded }
}

/** Dedupe item refs by item number, keeping first appearance. */
function dedupeRefs(refs: PromoItemRef[]): PromoItemRef[] {
  const seen = new Set<number>()
  const out: PromoItemRef[] = []
  for (const r of refs) {
    if (seen.has(r.itemNumber)) continue
    seen.add(r.itemNumber)
    out.push(r)
  }
  return out
}

function dedupeGetLines(lines: PromoGetLine[]): PromoGetLine[] {
  const seen = new Set<number>()
  const out: PromoGetLine[] = []
  for (const l of lines) {
    if (seen.has(l.itemNumber)) continue
    seen.add(l.itemNumber)
    out.push(l)
  }
  return out
}

function stripGetLine(l: PromoGetLine): PromoItemRef {
  const { savings: _savings, free: _free, ...ref } = l
  return ref
}

function buildMissed(p: PotentialBonusBuy): MissedPromo {
  const prereqs: PrereqStatus[] = p.prerequisites ?? []
  const driving = prereqs.find((q) => !q.isMet) ?? null
  return {
    bbyNumber: p.bbyNumber,
    promoNumber: p.promoNumber,
    offerId: p.offerId,
    description: p.description,
    kind: kindFromClean(p.discount?.discountType ?? null),
    prereq: driving
      ? {
          materialNumber: driving.materialNumber,
          matGrouping: driving.matGrouping,
          requiredQty: driving.requiredQty,
          foundQty: driving.foundQty,
          minValue: driving.minValue,
          foundValue: driving.foundValue,
        }
      : null,
    wouldSave: p.discount?.value ?? null,
    skipReason: p.skipReason,
  }
}
