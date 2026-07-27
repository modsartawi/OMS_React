/* PROTOTYPE — throwaway. Wayfinder ticket 138 (map 126).
 *
 * The near-miss data the three guidance variants render. Shapes follow the
 * frozen contract v1.0 §2/§3 (.issues/assets/136-cc-contract/CONTRACT.md) —
 * `nearMisses[]` inline, `resolvePrereq` on demand — flattened for drawing.
 *
 * THE RULE THIS FILE ENFORCES BY CONSTRUCTION: there is no `wouldSave` field
 * and there never will be (130 / spec 574 US26). A card carries the discount
 * DEFINITION (`20% off`, `3rd free`) and the delta (`add 1 more`). A savings
 * total requires firing the promotion, so the honest surface cannot print one.
 */

export type Atp = { qty: number | null; known: boolean }

/** 130's three classes. They must not read alike, mid-call, at a glance. */
export type NearMissClass =
  /** add N of these and it fires — the only class with an action */
  | 'actionable'
  /** `IsReady` — fully qualified, out-ranked by a better promotion. Nothing to do */
  | 'ready'
  /** an origin/accumulation refusal no basket change can fix (128 makes this permanent + common) */
  | 'blocked'

export type PrereqItem = {
  itemNumber: string
  description: string
  description2: string
  /** 131: ex-VAT estimate off the material master. NEVER carries `SAR`, never in a money column. */
  estimatePriceExVat: number
  atp: Atp
  /** the ranked handful is ATP-filtered server-side; this is why THIS row is here */
  rank?: string
}

export type NearMiss = {
  offerId: string
  /** server text, passed through as data */
  description: string
  klass: NearMissClass
  /** what the offer GIVES, as a definition — never a money total */
  gives: string
  progress: { have: number; need: number }
  prereq: {
    kind: 'grouping' | 'material' | 'condition'
    label: string
    /** the honest cardinality: "any 2 from these ~1,000" */
    eligibleCount: number
  }
  skipReason?: 'ORIGIN_FILTERED' | 'PLANT_FILTERED' | 'VALIDITY_WINDOW' | 'CUSTOMER_SEGMENT' | 'NOT_DISCOVERED' | null
  /** resolvePrereq's answer: the ranked, ATP-filtered handful. Absent until asked for. */
  items?: PrereqItem[]
  /** resolvePrereq's `truncated` + `topN` — the "…and 994 more" route */
  truncated?: boolean
  /** one-click add is a server round trip under resume-per-request (map note 3) */
  addingItem?: string | null
}

/** The outcome of an add that has come back. The re-price may fire this offer,
 *  a different one, or nothing at all — the prerequisite was one of several. */
export type AddOutcome =
  | { kind: 'fired'; offerId: string; description: string }
  | { kind: 'firedOther'; offerId: string; description: string; insteadOf: string }
  | { kind: 'noFire'; offerId: string; itemNumber: string; description: string; stillNeeds: string }
  | null

const ORAL_ITEMS: PrereqItem[] = [
  {
    itemNumber: '200145',
    description: 'Oral-B Pro floss 50m',
    description2: 'خيط أسنان أورال-بي',
    estimatePriceExVat: 9.13,
    atp: { qty: 12, known: true },
    rank: 'cheapest that qualifies',
  },
  {
    itemNumber: '200310',
    description: 'Sensodyne toothbrush soft',
    description2: 'فرشاة أسنان سنسوداين',
    estimatePriceExVat: 14.78,
    atp: { qty: 31, known: true },
  },
  // Third by rank on purpose: at a handful of THREE this is the last row the
  // agent sees, and `unknown` ATP must not read as `zero` (135's ruling) even
  // in the position where the eye is already moving on.
  {
    itemNumber: '200455',
    description: 'Oral-B interdental brushes ×8',
    description2: 'فرش ما بين الأسنان',
    estimatePriceExVat: 18.04,
    atp: { qty: null, known: false },
  },
  {
    itemNumber: '200188',
    description: 'Colgate Total mouthwash 500ml',
    description2: 'غسول فم كولجيت',
    estimatePriceExVat: 21.3,
    atp: { qty: 4, known: true },
  },
  {
    itemNumber: '200402',
    description: 'Listerine Cool Mint 250ml',
    description2: 'ليسترين نعناع',
    estimatePriceExVat: 12.6,
    atp: { qty: 7, known: true },
  },
]

const VITAMIN_ITEMS: PrereqItem[] = [
  {
    itemNumber: '300121',
    description: 'Centrum Adults 30 tabs',
    description2: 'سنتروم للبالغين',
    estimatePriceExVat: 41.3,
    atp: { qty: 9, known: true },
    rank: 'cheapest that qualifies',
  },
  {
    itemNumber: '300144',
    description: 'Vitamin D3 1000 IU — 60 caps',
    description2: 'فيتامين د3',
    estimatePriceExVat: 26.09,
    atp: { qty: 22, known: true },
  },
  {
    itemNumber: '300190',
    description: 'Omega-3 1000mg — 100 caps',
    description2: 'أوميغا 3',
    estimatePriceExVat: 55.65,
    atp: { qty: 3, known: true },
  },
]

/* ---- the three classes, one of each ---- */

const ACTIONABLE: NearMiss = {
  offerId: 'BBY-5510',
  description: '20% off oral care',
  klass: 'actionable',
  gives: '20% off',
  progress: { have: 1, need: 2 },
  prereq: { kind: 'grouping', label: 'Oral care selection', eligibleCount: 42 },
  skipReason: null,
  items: ORAL_ITEMS,
  truncated: true,
}

const READY: NearMiss = {
  offerId: 'BBY-4471',
  description: '70% off 2nd piece — Panadol',
  klass: 'ready',
  gives: '70% off the 2nd piece',
  progress: { have: 2, need: 2 },
  prereq: { kind: 'material', label: 'Panadol Extra 500mg', eligibleCount: 1 },
  skipReason: null,
}

const BLOCKED: NearMiss = {
  offerId: 'BBY-6501',
  description: 'SAR 20 off skin care',
  klass: 'blocked',
  gives: '20 off',
  progress: { have: 0, need: 2 },
  prereq: { kind: 'grouping', label: 'Skin care range', eligibleCount: 0 },
  skipReason: 'ORIGIN_FILTERED',
}

/** 130 + 128: the origin class becomes permanent and common once Origin = C000. */
const BLOCKED_2: NearMiss = {
  offerId: 'BBY-6110',
  description: '15% off baby care',
  klass: 'blocked',
  gives: '15% off',
  progress: { have: 1, need: 3 },
  prereq: { kind: 'grouping', label: 'Baby care range', eligibleCount: 0 },
  skipReason: 'CUSTOMER_SEGMENT',
}

/** The honest big set: "any 2 from these ~1,000" (130's working figure). */
const BIG_SET: NearMiss = {
  offerId: 'BBY-7001',
  description: '25% off personal care',
  klass: 'actionable',
  gives: '25% off',
  progress: { have: 0, need: 2 },
  prereq: { kind: 'grouping', label: 'Personal care range', eligibleCount: 997 },
  skipReason: null,
  items: ORAL_ITEMS,
  truncated: true,
}

const SECOND_ACTIONABLE: NearMiss = {
  offerId: 'BBY-6032',
  description: 'Buy 2 get 1 — vitamins',
  klass: 'actionable',
  gives: '3rd free',
  progress: { have: 1, need: 2 },
  prereq: { kind: 'grouping', label: 'Vitamin range', eligibleCount: 18 },
  skipReason: null,
  items: VITAMIN_ITEMS,
  truncated: false,
}

const THIRD_ACTIONABLE: NearMiss = {
  offerId: 'BBY-6210',
  description: 'SAR 29.95 for any 2 — first aid',
  klass: 'actionable',
  gives: 'both for 29.95',
  progress: { have: 1, need: 2 },
  prereq: { kind: 'material', label: 'Elastoplast fabric plasters ×20', eligibleCount: 1 },
  skipReason: null,
  items: [
    {
      itemNumber: '400118',
      description: 'Elastoplast fabric plasters ×20',
      description2: 'لاصقات جروح',
      estimatePriceExVat: 17.39,
      atp: { qty: 15, known: true },
      rank: 'the only qualifying item',
    },
  ],
  truncated: false,
}

export type GuidanceState = {
  nearMisses: NearMiss[]
  /** an add the agent clicked that has not come back yet (server round trip) */
  addingOffer?: string | null
  addingItem?: string | null
  /** what the last completed add turned out to do */
  outcome?: AddOutcome
  /** 787-C has not landed: get-side ("buy X get Y") near-misses are ABSENT, not empty */
  getSideAbsent: boolean
}

export type Scenario = {
  key: string
  label: string
  /** what this state exists to prove — prototype chrome, not the design */
  proves: string
  state: GuidanceState
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'three',
    label: '1 · One of each class',
    proves:
      'The working state. Actionable / ready / blocked in ONE list — can the agent tell them apart at a glance, mid-call?',
    state: { nearMisses: [ACTIONABLE, READY, BLOCKED], getSideAbsent: true },
  },
  {
    key: 'bigSet',
    label: '2 · "Any 2 from these 997"',
    proves:
      'A grouping prerequisite is a SET, not an item. A ranked ATP-filtered handful plus a route to the rest — without becoming a second screen.',
    state: { nearMisses: [BIG_SET, READY, BLOCKED], getSideAbsent: true },
  },
  {
    key: 'adding',
    label: '3 · One-click add in flight',
    proves:
      'Every add is a server round trip (resume-per-request). What does the agent look at while the basket is authoritative-but-stale?',
    state: { nearMisses: [ACTIONABLE, READY, BLOCKED], addingOffer: 'BBY-5510', addingItem: '200145', getSideAbsent: true },
  },
  {
    key: 'didNotFire',
    label: '4 · The add did not fire it',
    proves:
      'The prerequisite was one of several. The re-price fired nothing — this must not read as a bug, and the offer must not silently vanish.',
    state: {
      nearMisses: [{ ...ACTIONABLE, progress: { have: 2, need: 3 } }, READY, BLOCKED],
      outcome: {
        kind: 'noFire',
        offerId: 'BBY-5510',
        itemNumber: '200145',
        description: 'Oral-B Pro floss 50m',
        stillNeeds: '1 more from Oral care selection',
      },
      getSideAbsent: true,
    },
  },
  {
    key: 'firedOther',
    label: '5 · It fired a different offer',
    proves: 'The re-price is the engine’s, not the card’s. The agent asked for one thing and got another — say so.',
    state: {
      nearMisses: [READY, BLOCKED],
      outcome: {
        kind: 'firedOther',
        offerId: 'BBY-5590',
        description: '30% off oral care bundle',
        insteadOf: '20% off oral care',
      },
      getSideAbsent: true,
    },
  },
  {
    key: 'many',
    label: '6 · Density stress — 7 offers',
    proves: '135 amendment 2: the strip wraps, it never scrolls sideways. Does the class order still hold at seven?',
    state: {
      nearMisses: [
        ACTIONABLE,
        SECOND_ACTIONABLE,
        THIRD_ACTIONABLE,
        BIG_SET,
        READY,
        BLOCKED,
        BLOCKED_2,
      ],
      getSideAbsent: true,
    },
  },
  {
    key: 'readyOnly',
    label: '7 · Nothing actionable',
    proves: 'Only ready + blocked. The count in the top bar must be honest: there is nothing to do, and that is fine.',
    state: { nearMisses: [READY, BLOCKED, BLOCKED_2], getSideAbsent: true },
  },
  {
    key: 'none',
    label: '8 · No near-misses at all',
    proves: 'The region’s empty state. It should not leave a hole where the basket could have grown.',
    state: { nearMisses: [], getSideAbsent: true },
  },
  {
    key: 'getSideLanded',
    label: '9 · 787-C has landed',
    proves: 'Get-side coverage arrives. The partial-coverage acknowledgement must disappear on its own, with no other change.',
    state: {
      nearMisses: [
        ACTIONABLE,
        { ...SECOND_ACTIONABLE, prereq: { kind: 'condition', label: 'Vitamin range (get side)', eligibleCount: 18 } },
        READY,
        BLOCKED,
      ],
      getSideAbsent: false,
    },
  },
]

export const money = (n: number) => n.toFixed(2)

export const CLASS_ORDER: Record<NearMissClass, number> = { actionable: 0, ready: 1, blocked: 2 }

export function sorted(list: NearMiss[]) {
  return [...list].sort(
    (a, b) => CLASS_ORDER[a.klass] - CLASS_ORDER[b.klass] || a.progress.need - a.progress.have - (b.progress.need - b.progress.have),
  )
}

/** Why an offer cannot be reached, in the agent's words — never the wire code alone. */
export const SKIP_COPY: Record<string, string> = {
  ORIGIN_FILTERED: 'not offered on call-center orders',
  PLANT_FILTERED: 'not offered at this store',
  VALIDITY_WINDOW: 'not running today',
  CUSTOMER_SEGMENT: 'not for this caller',
  NOT_DISCOVERED: 'can’t be checked from this basket',
}
