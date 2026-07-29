/**
 * The guidance strip's view model (ticket 171) — near-misses in, cards out.
 *
 * This is the screen's differentiator reduced to its rules, which is why it is a
 * module rather than a component: the three classes, the order they are read in,
 * what a card may promise, and why an offer that cannot fire says so **in the
 * agent's words**. A component that decided any of those would be deciding them
 * once per surface.
 *
 * 🚩 **No savings total, ever.** `wouldSave` does not exist on the wire and is
 * not computable client-side (spec 574 US26) — a real one requires firing the
 * promotion. What a card says it GIVES is the discount *definition*, and the
 * wording rule for that is 161's, in `@/core/promotions/discount-definition`
 * (a feature may never import a feature, and the Simulation screen asks the
 * identical question).
 *
 * 🚩 **Nothing here is formatted as money.** The guidance region holds no engine
 * money at all, so the region can guarantee absolutely what a row elsewhere can
 * only guarantee per row. The rule is *formatted as money* — two forced decimals,
 * ready for a currency word beside it — and **not** "no `SAR` anywhere": real BBY
 * descriptions carry currency words the console may not edit (`"2 PC for 29.95
 * SR"` is in this repo's own 098 captures), and `description` is server text
 * passed through as data.
 *
 * Like `discount-definition`, every phrase this module produces is a **key plus
 * its params** — no user-visible text is authored here, and the render tier
 * resolves them with `t()`. Keys are namespace-qualified so a caller in any
 * namespace can resolve one.
 */
import type { NearMiss } from '@/core/models/callcenter'
import {
  discountDefinition,
  discountKindFromCode,
  type DiscountDefinition,
} from '@/core/promotions/discount-definition'

/**
 * 130's three classes. They are **three different decisions**, so they may never
 * differ by hue alone — rank, treatment AND words tell them apart:
 *
 * - `actionable` — the only class with an action: add what it still needs.
 * - `counted` — `isReady`: fully qualified, out-ranked by a better offer. There
 *   is nothing to do, which is a fact the agent needs and not a failure.
 * - `unavailable` — an origin or accumulation refusal **no basket change can
 *   fix** (128 makes this class permanent and common once Origin becomes C000).
 */
export type GuidanceClass = 'actionable' | 'counted' | 'unavailable' | 'needsCoupon'

/** An i18n key plus what `t()` needs to resolve it. Nothing user-visible. */
export interface GuidancePhrase {
  key: string
  params: Record<string, string | number | boolean>
}

/** One offer, as the strip draws it. */
export interface GuidanceCard {
  offerId: string
  /**
   * The card's identity on THIS projection — what the strip keys, opens and
   * closes by. It is the `offerId` where the wire supplied one, and the offer's
   * position in the server's own list where it did not.
   *
   * 🚩 It exists because the wire really does not always supply one: every
   * `offerId` in the v1.2 capture is the empty string
   * ([859](C:\Work\DMSCO\BackOffice\.issues\859-near-miss-offer-id-is-blank.md)),
   * so two distinct offers arrive under the same key. Keyed on `offerId`, React
   * de-duplicates them and opening one opens both — the agent is shown one offer
   * where the engine sent two. Position is a safe fallback precisely because
   * this view model **preserves the server's order** and never re-sorts.
   *
   * It is NOT an offer identity and must never be sent to the server: `addItem`
   * and `ResolvePrereq` address an offer by `offerId`, and a positional id there
   * would name a different offer on the next projection.
   */
  cardId: string
  klass: GuidanceClass
  /**
   * What the offer GIVES, at headline size — `20% off`, `3rd free`,
   * `both for 29.95`. `null` when the wire carried no discount facts (or none
   * that classify), and the server's own `description` is then the whole of what
   * the card can honestly say. Drawn as a caption the definition disappears;
   * this is the ticket's first ruling and the reason the field exists at all.
   */
  definition: DiscountDefinition | null
  /** The server's own words for the offer, **passed through as data** — demoted
   *  to the sub-line where a definition resolved, and the headline where none
   *  did. Never edited, never re-worded: it is not a literal (i18n rule). */
  description: string
  /** The meter's two figures, or `null` where the wire stated no requirement a
   *  meter could draw. `have` is clamped to `need` so a meter never overfills. */
  progress: { have: number; need: number } | null
  /** How many more the offer still needs. `0` on a class with nothing to add. */
  shortfall: number
  /** The honest set statement — *any 1 from this selection · 42 qualify*. A
   *  grouping prerequisite is a **set, not an item**, and a card that named one
   *  item would imply the caller must buy that one. `null` when there is nothing
   *  honest to say about the prerequisite. */
  set: GuidancePhrase | null
  /** The population the prerequisite draws from, where the wire stated one — the
   *  `42` of *42 qualify*. Held as a figure as well as inside `set`'s phrase
   *  because the on-demand resolution (172) subtracts the handful it shows from
   *  it to offer the route to the rest. `null` where the wire stated none. */
  eligible: number | null
  /** Why no basket change reaches this offer, in the agent's words. `null` on
   *  every class but `unavailable`. 🚩 The wire code never reaches the screen —
   *  an unknown category still reads as words. */
  reason: GuidancePhrase | null
}

export interface GuidanceView {
  /** Every near-miss, **in the order the server sent them** (§3.1 sorts
   *  ready-first). Nothing here re-sorts the list: the classes are a rendering
   *  rank, and a view model that re-ordered would be overruling the engine's. */
  cards: GuidanceCard[]
  actionable: GuidanceCard[]
  counted: GuidanceCard[]
  unavailable: GuidanceCard[]
  /** v1.10 (159) — offers whose prerequisite is a coupon. Stated, never offered
   *  as an add; the coupon chip is where they are answered. */
  needsCoupon: GuidanceCard[]
  /** Mirrored in the top bar (US51), so an offer that arrives while the agent is
   *  reading search results still announces itself. */
  actionableCount: number
  /**
   * Whether "buy X get Y" offers are being checked at all. Until BackOffice
   * 787-C lands they are **absent, not empty** — BBY lookup keys on the
   * condition-side access tables, so a basket holding only the buy-side item
   * never loads the promotion (130's headline blocker).
   *
   * 🚩 Derived from the projection rather than configured: a get-side
   * prerequisite (`kind: 'condition'`) in the list IS the coverage landing. So
   * the acknowledgement the surface prints disappears **on its own** when the
   * server starts sending them, with no other change (138 scenario 9).
   */
  getSideCovered: boolean
  /** 🚩 The card that opens **by construction** — the top-ranked actionable
   *  offer, never a hardcoded id (138 finding 4: drawn with one, the big-set
   *  scenario rendered collapsed, and a card whose items are one click away is a
   *  card nobody reads mid-call). `null` when there is nothing to act on. */
  openByDefault: string | null
}

/** §3.2's categories. Listed because an unknown one is a **minor-version
 *  addition** that must degrade to words rather than leak a code onto the
 *  screen — the list is what tells the two apart. */
const SKIP_CATEGORIES = [
  'ORIGIN_FILTERED',
  'PLANT_FILTERED',
  'VALIDITY_WINDOW',
  'CUSTOMER_SEGMENT',
  'NOT_DISCOVERED',
]

export function guidanceView(nearMisses: NearMiss[] | null | undefined): GuidanceView {
  const cards = (nearMisses ?? []).map(toCard)
  const actionable = cards.filter((card) => card.klass === 'actionable')
  return {
    cards,
    actionable,
    counted: cards.filter((card) => card.klass === 'counted'),
    unavailable: cards.filter((card) => card.klass === 'unavailable'),
    // Deliberately NOT folded into `actionable`, which is what drives both the
    // expandable cards and the top bar's count — an offer nothing in the basket
    // can reach must not be counted as one within reach.
    needsCoupon: cards.filter((card) => card.klass === 'needsCoupon'),
    actionableCount: actionable.length,
    getSideCovered: (nearMisses ?? []).some((miss) => miss.prereq?.kind === 'condition'),
    openByDefault: actionable[0]?.cardId ?? null,
  }
}

function toCard(miss: NearMiss, index: number): GuidanceCard {
  const klass = classOf(miss)
  const progress = progressOf(miss)
  const shortfall = klass === 'actionable' && progress ? progress.need - progress.have : 0
  return {
    offerId: miss.offerId,
    // Position where the wire named no offer (859) — see `cardId`.
    cardId: miss.offerId === '' || miss.offerId == null ? `#${index}` : miss.offerId,
    klass,
    definition: definitionOf(miss),
    description: miss.description ?? '',
    progress,
    shortfall,
    set: klass === 'actionable' ? setStatement(miss, shortfall) : null,
    eligible: klass === 'actionable' ? numberOrNull(miss.prereq?.eligibleCount) : null,
    reason: klass === 'unavailable' ? reasonOf(miss.skipReason) : null,
  }
}

/**
 * 🚩 The skip reason is asked FIRST. An offer the engine never evaluated is out
 * of reach whatever its progress says, and `isReady` on an offer that was
 * origin-filtered would otherwise draw a card promising nothing to do about an
 * offer that is not on this order at all.
 */
function classOf(miss: NearMiss): GuidanceClass {
  if (typeof miss.skipReason === 'string' && miss.skipReason !== '') return 'unavailable'
  // 🚩 159. A coupon-gated offer is reachable — but not by anything the agent
  // can put in the basket, so it must never become an *add N more* card. It is
  // neither `actionable` (no basket change reaches it) nor `unavailable` (it is
  // real and the caller may hold the coupon): it is a statement, answered at the
  // coupon chip. Drawn as a material prerequisite it would offer a one-click add
  // of the campaign SKU, which qualifies the same bonus buy while burning
  // nothing — see `NearMissPrereq.kind`.
  if (miss.prereq?.kind === 'coupon') return 'needsCoupon'
  return miss.isReady === true ? 'counted' : 'actionable'
}

/** The meter's figures, kept honest: a requirement of nought is not a
 *  requirement, and `have` beyond `need` is a projection the meter cannot draw
 *  — it is clamped rather than dropped, because the offer is still real. */
function progressOf(miss: NearMiss): { have: number; need: number } | null {
  const need = numberOrNull(miss.progress?.need)
  const have = numberOrNull(miss.progress?.have) ?? 0
  if (need === null || need <= 0) return null
  return { have: Math.max(0, Math.min(have, need)), need }
}

/**
 * What the offer gives, through 161's rule. The console's own payload may carry
 * more than `Pricing/Simulate` does — a piece count for a set price, the ordinal
 * a free-goods offer lands on — so those ride through where the wire sent them.
 *
 * The whole block is **optional and additive** (§9: unknown fields are ignored
 * by rule, additive changes ship server-first). While it is absent the card
 * degrades to the server's description as its headline, which is the pattern
 * `AppliedBonusBuy.applications?` already uses in this repo.
 */
function definitionOf(miss: NearMiss): DiscountDefinition | null {
  const discount = miss.discount
  if (!discount) return null
  return discountDefinition({
    kind: discountKindFromCode(discount.discountType),
    value: discount.value,
    quantity: discount.quantity,
    nthFree: discount.nthFree,
  })
}

/**
 * *any 1 from this selection · 42 qualify* — the honest cardinality (US42).
 *
 * A **grouping** is a set: `eligibleCount` is the population, and it is printed
 * whenever the wire states it. A **material** prerequisite is one item, and says
 * so. A prerequisite kind this client does not know is not guessed at: the line
 * is dropped rather than invented, and the meter still says what is missing.
 */
function setStatement(miss: NearMiss, shortfall: number): GuidancePhrase | null {
  if (shortfall <= 0) return null
  const prereq = miss.prereq
  if (!prereq) return null
  if (prereq.kind === 'material') return { key: 'callcenter:guidance.setItem', params: { count: shortfall } }
  if (prereq.kind !== 'grouping' && prereq.kind !== 'condition') return null
  const eligible = numberOrNull(prereq.eligibleCount)
  return eligible !== null && eligible > 0
    ? { key: 'callcenter:guidance.setCounted', params: { count: shortfall, eligible } }
    : { key: 'callcenter:guidance.set', params: { count: shortfall } }
}

/**
 * Why an offer cannot be reached, **in the agent's words** (US41). Every §3.2
 * category has its own phrase; a category this client has never seen resolves to
 * the one that says the honest thing without the code — *this offer isn't
 * available on this order*. 🚩 The code is never interpolated into it: a wire
 * code on screen is a sentence the agent cannot say to a caller.
 */
function reasonOf(skipReason: string | null | undefined): GuidancePhrase {
  const known = typeof skipReason === 'string' && SKIP_CATEGORIES.includes(skipReason)
  return { key: known ? `callcenter:guidance.skip.${skipReason}` : 'callcenter:guidance.skip.unknown', params: {} }
}

const numberOrNull = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
