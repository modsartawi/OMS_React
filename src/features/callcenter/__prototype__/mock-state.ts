/* PROTOTYPE — throwaway. Wayfinder ticket 135 (map 126).
 *
 * The mock the three console variants render. Shapes follow the frozen contract
 * v1.0 (.issues/assets/136-cc-contract/CONTRACT.md) but are flattened for the
 * prototype — this is a drawing surface, not a client. No fetching, no engine.
 *
 * Every scenario below is a state the ticket says the layout must survive.
 */

export type Atp = { qty: number | null; known: boolean }

export type Line = {
  lineId: string
  itemNumber: string
  description: string
  qty: number
  uom: string
  unitPriceGross: number
  lineTotalGross: number
  promo?: { offerId: string; description: string; amount: number }
  atpAtScan: Atp
  belowAtpAtScan: boolean
  /** rebind refusal only — this line does not price at the new plant */
  unpriceable?: boolean
}

export type NearMiss = {
  offerId: string
  description: string
  /** actionable | ready | blocked — 138's three classes */
  klass: 'actionable' | 'ready' | 'blocked'
  progress: { have: number; need: number }
  prereq: { kind: 'grouping' | 'material'; label: string; eligibleCount: number }
  skipReason?: 'ORIGIN_FILTERED' | 'PLANT_FILTERED' | 'NOT_DISCOVERED' | null
  /** resolvePrereq's handful, present only when the agent expanded the card */
  items?: SearchRow[]
}

export type SearchRow = {
  itemNumber: string
  description: string
  description2: string
  estimatePriceExVat: number
  atp: Atp
}

export type Pending =
  | {
      kind: 'belowAtp'
      detail: { itemNumber: string; description: string; requested: number; available: number; plant: string }
    }
  | {
      kind: 'storeChange'
      detail: {
        fromPlant: string
        fromName: string
        toPlant: string
        toName: string
        lineDiffs: { lineId: string; description: string; fromGross: number; toGross: number }[]
        promotionsMoved: { offerId: string; description: string; fromAmount: number; toAmount: number }[]
        atpReFreeze: { lineId: string; fromQty: number; toQty: number; belowAfter: boolean }[]
      }
    }

export type ConsoleState = {
  /** the three top-level shapes the console can be in */
  phase: 'console' | 'refusedExisting' | 'denied'

  customer: { name: string; mobile: string; customerId: string; loyalty: string; sinceOrders: number } | null
  address: { label: string; line: string; districtName: string; cityName: string } | null
  plant: { code: string; name: string; source: 'derivedFromAddress' | 'operatorOverride' } | null
  slot: { label: string; isActive: boolean } | null
  documentSource: string | null
  sourceReference: string | null

  lines: Line[]
  totals: { net: number; vat: number; deliveryFee: number; feeWaived: boolean; payable: number } | null
  nearMisses: NearMiss[]

  /** the item-search surface: what the agent is typing into */
  search: { query: string; rows: SearchRow[]; truncated: boolean } | null

  pending: Pending | null
  busy: { attempt: number; ceiling: number } | null
  submitting: boolean
  /** a business refusal the console must show without reading as a crash */
  refusal: { code: string; message: string; lines?: string[] } | null

  /** OpenResult.refusedExisting — the reconnect story */
  existing: { transactionId: string; customerName: string; lineCount: number; openedAt: string; plant: string } | null

  capabilities: { canAddItem: boolean; canSubmit: boolean; canOpenAddressBook: boolean; submitBlockers: string[] }
  hasBelowAtp: boolean
}

const CUSTOMER = {
  name: 'Fatima Al-Harbi',
  mobile: '+966 55 214 8890',
  customerId: '0001234567',
  loyalty: 'Gold · 4,120 pts',
  sinceOrders: 11,
}

const ADDRESS = { label: 'Home', line: 'Villa 22, Anas Ibn Malik Rd', districtName: 'Al Malqa', cityName: 'Riyadh' }
const PLANT = { code: '1101', name: 'Al Malqa', source: 'derivedFromAddress' as const }

const LINES: Line[] = [
  {
    lineId: 'L1',
    itemNumber: '100001',
    description: 'Panadol Extra 500mg — 24 tabs',
    qty: 2,
    uom: 'EA',
    unitPriceGross: 13.8,
    lineTotalGross: 27.6,
    promo: { offerId: 'BBY-4471', description: '70% off 2nd piece', amount: -8.4 },
    atpAtScan: { qty: 5, known: true },
    belowAtpAtScan: false,
  },
  {
    lineId: 'L2',
    itemNumber: '100455',
    description: 'Sensodyne Repair & Protect 75ml',
    qty: 1,
    uom: 'EA',
    unitPriceGross: 32.2,
    lineTotalGross: 32.2,
    atpAtScan: { qty: 18, known: true },
    belowAtpAtScan: false,
  },
]

const TOTALS = { net: 44.7, vat: 6.7, deliveryFee: 15, feeWaived: false, payable: 66.4 }

const NEAR_MISSES: NearMiss[] = [
  {
    offerId: 'BBY-5510',
    description: '20% off — oral care',
    klass: 'actionable',
    progress: { have: 1, need: 2 },
    prereq: { kind: 'grouping', label: 'Oral care selection', eligibleCount: 42 },
    skipReason: null,
    items: [
      { itemNumber: '200145', description: 'Oral-B Pro floss 50m', description2: 'خيط أسنان', estimatePriceExVat: 9.13, atp: { qty: 12, known: true } },
      { itemNumber: '200188', description: 'Colgate Total mouthwash 500ml', description2: 'غسول فم', estimatePriceExVat: 21.3, atp: { qty: 4, known: true } },
      { itemNumber: '200310', description: 'Sensodyne toothbrush soft', description2: 'فرشاة أسنان', estimatePriceExVat: 14.78, atp: { qty: 31, known: true } },
    ],
  },
  {
    offerId: 'BBY-4471',
    description: '70% off 2nd piece — Panadol',
    klass: 'ready',
    progress: { have: 2, need: 2 },
    prereq: { kind: 'material', label: 'Panadol Extra 500mg', eligibleCount: 1 },
    skipReason: null,
  },
  {
    offerId: 'BBY-6032',
    description: 'Buy 2 get 1 — vitamins',
    klass: 'blocked',
    progress: { have: 0, need: 2 },
    prereq: { kind: 'grouping', label: 'Vitamin range', eligibleCount: 0 },
    skipReason: 'NOT_DISCOVERED',
  },
]

const SEARCH_ROWS: SearchRow[] = [
  { itemNumber: '100001', description: 'Panadol Extra 500mg — 24 tabs', description2: 'بنادول إكسترا', estimatePriceExVat: 12.0, atp: { qty: 5, known: true } },
  { itemNumber: '100002', description: 'Panadol Advance 500mg — 48 tabs', description2: 'بنادول أدفانس', estimatePriceExVat: 19.57, atp: { qty: 0, known: true } },
  { itemNumber: '100019', description: 'Panadol Cold & Flu Day — 24 tabs', description2: 'بنادول للبرد', estimatePriceExVat: 16.52, atp: { qty: null, known: false } },
  { itemNumber: '100077', description: 'Panadol Children suspension 100ml', description2: 'بنادول أطفال', estimatePriceExVat: 11.3, atp: { qty: 44, known: true } },
]

const BASE: ConsoleState = {
  phase: 'console',
  customer: null,
  address: null,
  plant: null,
  slot: null,
  documentSource: null,
  sourceReference: null,
  lines: [],
  totals: null,
  nearMisses: [],
  search: null,
  pending: null,
  busy: null,
  submitting: false,
  refusal: null,
  existing: null,
  capabilities: { canAddItem: true, canSubmit: false, canOpenAddressBook: false, submitBlockers: ['NO_CUSTOMER', 'NO_ADDRESS', 'EMPTY_BASKET'] },
  hasBelowAtp: false,
}

const PRICED: ConsoleState = {
  ...BASE,
  customer: CUSTOMER,
  address: ADDRESS,
  plant: PLANT,
  slot: { label: 'Today 18:00–21:00', isActive: true },
  documentSource: 'CALL CENTER',
  sourceReference: 'CRM-889231',
  lines: LINES,
  totals: TOTALS,
  nearMisses: NEAR_MISSES,
  capabilities: { canAddItem: true, canSubmit: true, canOpenAddressBook: true, submitBlockers: [] },
}

export type Scenario = {
  key: string
  label: string
  /** what this state exists to prove — shown in the prototype chrome, not the design */
  proves: string
  state: ConsoleState
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'empty',
    label: '1 · Open, nothing yet',
    proves: 'No customer, no store, empty basket. Caret must land on the phone field (CC2 finding 1).',
    state: BASE,
  },
  {
    key: 'attached',
    label: '2 · Customer, no address',
    proves: '137: the address book is server-side unreachable before attach. Ordering must feel intended, not enforced.',
    state: {
      ...BASE,
      customer: CUSTOMER,
      capabilities: { canAddItem: true, canSubmit: false, canOpenAddressBook: true, submitBlockers: ['NO_ADDRESS', 'EMPTY_BASKET'] },
    },
  },
  {
    key: 'searching',
    label: '3 · Searching items',
    proves: '131: ex-VAT estimate beside VAT-inclusive basket money, and three ATP states — 5 / 0 / unknown.',
    state: { ...PRICED, search: { query: 'panadol', rows: SEARCH_ROWS, truncated: true } },
  },
  {
    key: 'priced',
    label: '4 · Priced basket',
    proves: 'The working state: two lines, a fired promotion, a delivery fee, three near-miss classes.',
    state: PRICED,
  },
  {
    key: 'prereq',
    label: '5 · Near-miss expanded',
    proves: '138: a grouping is a set, not an item — "any 2 of 42", ATP-filtered handful, one-click add.',
    state: { ...PRICED, nearMisses: NEAR_MISSES },
  },
  {
    key: 'belowAtp',
    label: '6 · Below-ATP confirm',
    proves: 'The acceptance IS the audit record — the screen must show the number the agent accepted.',
    state: {
      ...PRICED,
      pending: {
        kind: 'belowAtp',
        detail: { itemNumber: '100001', description: 'Panadol Extra 500mg — 24 tabs', requested: 8, available: 5, plant: '1101' },
      },
    },
  },
  {
    key: 'rebindPreview',
    label: '7 · Rebind preview',
    proves: '129: a store change re-prices every line. The agent commits a diff they were shown.',
    state: {
      ...PRICED,
      pending: {
        kind: 'storeChange',
        detail: {
          fromPlant: '1101',
          fromName: 'Al Malqa',
          toPlant: '1204',
          toName: 'Al Yasmin',
          lineDiffs: [
            { lineId: 'L1', description: 'Panadol Extra 500mg — 24 tabs', fromGross: 27.6, toGross: 25.3 },
            { lineId: 'L2', description: 'Sensodyne Repair & Protect 75ml', fromGross: 32.2, toGross: 32.2 },
          ],
          promotionsMoved: [{ offerId: 'BBY-4471', description: '70% off 2nd piece', fromAmount: -8.4, toAmount: -6.0 }],
          atpReFreeze: [{ lineId: 'L1', fromQty: 5, toQty: 2, belowAfter: true }],
        },
      },
    },
  },
  {
    key: 'rebindRefused',
    label: '8 · Rebind refused',
    proves: 'REBIND_REFUSED is atomic: nothing moved. The agent must see exactly which line to void.',
    state: {
      ...PRICED,
      lines: [LINES[0], { ...LINES[1], unpriceable: true }],
      refusal: {
        code: 'REBIND_REFUSED',
        message: 'Al Yasmin (1204) does not price 1 line. Nothing was changed.',
        lines: ['100455 · Sensodyne Repair & Protect 75ml — no price at 1204'],
      },
    },
  },
  {
    key: 'busy',
    label: '9 · Session busy, retrying',
    proves: '§6.1: SESSION_BUSY is routine. Retrying must not read as a failure, and must not block typing.',
    state: { ...PRICED, busy: { attempt: 3, ceiling: 5 } },
  },
  {
    key: 'submitting',
    label: '10 · Submit in flight',
    proves: 'The one moment money is at stake. No optimistic lie here — the order number is the proof.',
    state: { ...PRICED, submitting: true },
  },
  {
    key: 'submitRefused',
    label: '11 · Submit refused',
    proves: 'SUBMIT_REFUSED names a field. The transaction stays open — the basket must survive visibly.',
    state: {
      ...PRICED,
      slot: null,
      refusal: { code: 'SUBMIT_REFUSED', message: 'A delivery slot is required before this order can be placed.', lines: ['field: slot'] },
      capabilities: { canAddItem: true, canSubmit: false, canOpenAddressBook: true, submitBlockers: ['MISSING_SLOT'] },
    },
  },
  {
    key: 'refusedExisting',
    label: '12 · Order already open',
    proves: '§8.1: never a silent auto-resume. Resume or abandon — an explicit choice on a new caller.',
    state: {
      ...BASE,
      phase: 'refusedExisting',
      existing: { transactionId: '01JC8Q4KYZ3M7N2P5R8T1V6W9X', customerName: 'Mohammed Al-Otaibi', lineCount: 4, openedAt: '08:41', plant: '1101' },
    },
  },
  {
    key: 'denied',
    label: '13 · Not granted',
    proves: '134: the console is chrome-less, so its refusal is a dead end — it carries its own way home.',
    state: { ...BASE, phase: 'denied' },
  },
]

export const money = (n: number) => n.toFixed(2)
