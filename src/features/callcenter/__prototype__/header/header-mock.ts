/* PROTOTYPE — throwaway. Wayfinder ticket 175 (map 126), reaching into 176 and 155.
 *
 * The mock the three header-capture variants render. Shapes follow contract
 * v1.2 (.issues/assets/136-cc-contract/CONTRACT.md) plus the fields 175 rules
 * on — `plantSource: 'seededAtOpen' | 'chosenForPickup'` and the
 * `STORE_NOT_CHOSEN` blocker — flattened for drawing. No fetching, no engine.
 *
 * Six surfaces are on trial here, and only two of them are drawn anywhere today:
 *
 *   1. the opening gate      175 — order open, nothing may go into it yet
 *   2. fulfilment mode       176 — Delivery | PickInStore, undrawn
 *   3. the store pick        154 — the whole estate, unfiltered, under pickup
 *   4. the slot              drawn as a chip, never as a picker
 *   5. source + reference    drawn as two chips, never as capture
 *   6. payment type          155 — CashOnDelivery | PaidOnline, undrawn ENTIRELY
 */

export type Mode = 'Delivery' | 'PickInStore'

/** 175's ruling: four values, and `!== 'seededAtOpen'` is the store half of the gate. */
export type PlantSource = 'seededAtOpen' | 'derivedFromAddress' | 'operatorOverride' | 'chosenForPickup'

/** 155. `Cc2DocumentHeaderBuilder.cs:36-38` writes it; nothing on the web draws it. */
export type Payment = 'CashOnDelivery' | 'PaidOnline'

/** Which capture surface the agent is inside right now. The variants disagree
 *  about WHERE that surface appears, which is the whole argument. */
export type OpenSurface = 'none' | 'fulfilment' | 'where' | 'when' | 'reference' | 'payment'

export type Customer = { name: string; mobile: string; customerId: string; loyalty: string; orders: number }
export type Address = { label: string; line: string; districtName: string; cityName: string }
/**
 * 🚩 The PICK-IN-STORE estate — `OmsHttpService.GetStoreDetails()` →
 * `StoreDetailsModel`. CC2 loads it UNFILTERED (`EnsureStoresLoadedAsync` adds
 * every row), and `deliveryStore` is carried on the model and read by nobody.
 * 154's "whole estate, unfiltered" ruling stands for this list.
 */
export type Store = {
  code: string
  name: string
  city: string
  district: string
  /** `StoreDetailsModel.DeliveryStore`. Carried, never filtered on — CC2 parity. */
  deliveryStore: boolean
}

/**
 * 🚩 The DELIVERY geography — a DIFFERENT read and a DIFFERENT population:
 * `GetCities()` + `GetDistricts(cityCode)`. The agent picks a city and a
 * district as part of the ADDRESS and never sees a store list; the store is
 * derived from the district itself:
 *
 *     DeriveStoreCode(d) => d.TempStoreCode ?? d.StoreCode      (StoreSelectionVM:519)
 *
 * Two facts this shape carries that a single shared store list cannot:
 *   - a district may have NO delivery store assigned (`storeCode: null`), which
 *     CC2 refuses in words and contract §7 has no code for
 *   - `tempStoreCode` overrides the permanent assignment (a store closed for
 *     renovation reassigns its districts) and outranks it
 */
export type District = {
  districtCode: string
  districtName: string
  /** The district's permanently assigned delivery store. Null = none assigned. */
  storeCode: string | null
  /** A temporary reassignment. Outranks `storeCode` when present. */
  tempStoreCode?: string
}
export type City = { cityCode: string; cityName: string; districts: District[] }
export type SlotTime = { slotId: string; from: string; to: string; isActive: boolean }
export type SlotDay = { day: string; description: string; times: SlotTime[] }
export type Line = { lineId: string; itemNumber: string; description: string; qty: number; uom: string; gross: number }

export type HeaderState = {
  mode: Mode
  customer: Customer | null
  address: Address | null
  plant: { code: string; name: string; source: PlantSource }
  slot: { day: string; from: string; to: string; isActive: boolean } | null
  documentSource: string | null
  sourceReference: string | null
  payment: Payment | null
  /** CC2's `IsPaymentForced` — a P2E source locks the pair to PaidOnline. */
  paymentForced: boolean
  lines: Line[]
  open: OpenSurface
  /** 175 — `customer != null && plantSource !== 'seededAtOpen'`. */
  canAddItem: boolean
  submitBlockers: string[]
}

const CUSTOMER: Customer = {
  name: 'Fatima Al-Harbi',
  mobile: '+966 55 214 8890',
  customerId: '0001234567',
  loyalty: 'Gold · 4,120 pts',
  orders: 11,
}

const ADDRESS: Address = {
  label: 'Home',
  line: 'Villa 22, Anas Ibn Malik Rd',
  districtName: 'Al Malqa',
  cityName: 'Riyadh',
}

/** The agent's entry store — what `open` binds `PcHeader.Plant` to (map note 6). */
const ENTRY_STORE = { code: '1001', name: 'King AbdelAziz Road', source: 'seededAtOpen' as const }

/**
 * The estate, unfiltered — 154's ruling. Grouped by city because CC2's own
 * picker is `GetStoreAreas()`, a two-level area → store read, and an agent who
 * knows "the Yasmin branch" should not have to know its code.
 */
export const STORES: Store[] = [
  { code: '1001', name: 'King AbdelAziz Road', city: 'Riyadh', district: 'Al Murabba', deliveryStore: false },
  { code: '1101', name: 'Al Malqa', city: 'Riyadh', district: 'Al Malqa', deliveryStore: true },
  { code: '1204', name: 'Al Yasmin', city: 'Riyadh', district: 'Al Yasmin', deliveryStore: true },
  // Collection-only: in the estate, and NOT any district's delivery store.
  { code: '1310', name: 'Hittin Plaza', city: 'Riyadh', district: 'Hittin', deliveryStore: false },
  { code: '2004', name: 'Tahlia Street', city: 'Jeddah', district: 'Al Andalus', deliveryStore: true },
  { code: '2088', name: 'Corniche', city: 'Jeddah', district: 'Al Shati', deliveryStore: false },
  { code: '3011', name: 'Prince Sultan Rd', city: 'Dammam', district: 'Al Faisaliyah', deliveryStore: true },
]

/**
 * The delivery geography. Deliberately NOT derivable from `STORES` — proving the
 * two populations differ is the whole point:
 *   - `1310 Hittin Plaza` is in the estate and is no district's delivery store
 *   - `1402` serves Al Narjis and is NOT in the estate at all (delivery-only)
 *   - `Al Aqiq` has NO delivery store assigned — the refusal CC2 words and the
 *     contract cannot currently express
 *   - `Al Yasmin` is on a TEMP reassignment to 1101 while 1204 is closed
 */
export const DELIVERY_CITIES: City[] = [
  {
    cityCode: '0021',
    cityName: 'Riyadh',
    districts: [
      { districtCode: 'R-114', districtName: 'Al Malqa', storeCode: '1101' },
      { districtCode: 'R-118', districtName: 'Al Yasmin', storeCode: '1204', tempStoreCode: '1101' },
      { districtCode: 'R-140', districtName: 'Al Narjis', storeCode: '1402' },
      { districtCode: 'R-155', districtName: 'Al Aqiq', storeCode: null },
    ],
  },
  {
    cityCode: '0002',
    cityName: 'Jeddah',
    districts: [
      { districtCode: 'J-020', districtName: 'Al Andalus', storeCode: '2004' },
      { districtCode: 'J-044', districtName: 'Al Shati', storeCode: null },
    ],
  },
]

/** `DeriveStoreCode` — `StoreSelectionVM:519`, temp outranks permanent. */
export const deriveStore = (d: District): string | null => d.tempStoreCode ?? d.storeCode

/** Every store the DELIVERY path can reach — the image of the assignment, and
 *  demonstrably not the pickup estate. */
export const DELIVERY_STORE_CODES = [
  ...new Set(DELIVERY_CITIES.flatMap((c) => c.districts.map(deriveStore).filter((x): x is string => !!x))),
]

/** Recently used by this agent — the 90% case in a call centre, and the reason
 *  a flat A–Z list is the wrong default shape. */
export const RECENT_STORE_CODES = ['1101', '1001', '1204']

/**
 * Days → times, which is the shape `SlotsController` actually holds
 * (`TimeSlotModel.Times`, `TimeSlotTimeModel.SlotFrom/SlotTo/Status`) and the
 * shape contract v1.2's `setSlot { slotId, day?, description?, from?, to? }`
 * carries back. Two rules the WPF controller applies, drawn here:
 *   - a window already past on TODAY is not offered at all
 *   - `Status: false` is an inactive window — WPF drops it; we SHOW it disabled,
 *     because "there is no 21:00 today" and "21:00 is full" are different
 *     answers to give a caller out loud.
 */
export const SLOT_DAYS: SlotDay[] = [
  {
    day: '2026-07-28',
    description: 'Today',
    times: [
      { slotId: '2026-07-28#S1', from: '09:00', to: '12:00', isActive: false },
      { slotId: '2026-07-28#S2', from: '15:00', to: '18:00', isActive: true },
      { slotId: '2026-07-28#S3', from: '18:00', to: '21:00', isActive: true },
    ],
  },
  {
    day: '2026-07-29',
    description: 'Tomorrow',
    times: [
      { slotId: '2026-07-29#S1', from: '09:00', to: '12:00', isActive: true },
      { slotId: '2026-07-29#S2', from: '12:00', to: '15:00', isActive: true },
      { slotId: '2026-07-29#S3', from: '15:00', to: '18:00', isActive: false },
      { slotId: '2026-07-29#S4', from: '18:00', to: '21:00', isActive: true },
    ],
  },
  {
    day: '2026-07-30',
    description: 'Thu 30 Jul',
    times: [
      { slotId: '2026-07-30#S2', from: '12:00', to: '15:00', isActive: true },
      { slotId: '2026-07-30#S4', from: '18:00', to: '21:00', isActive: true },
    ],
  },
]

/** `MyDocumentSources` — the agent's own permitted list (801). */
export const DOCUMENT_SOURCES = [
  { code: 'CALLCENTER', label: 'Call centre', requiresReference: true, forcesOnline: false },
  { code: 'CRM', label: 'CRM case', requiresReference: true, forcesOnline: false },
  { code: 'P2E', label: 'Pay to enter (P2E)', requiresReference: true, forcesOnline: true },
  { code: 'WHATSAPP', label: 'WhatsApp', requiresReference: false, forcesOnline: false },
]

const LINES: Line[] = [
  { lineId: 'L1', itemNumber: '100001', description: 'Panadol Extra 500mg — 24 tabs', qty: 2, uom: 'EA', gross: 27.6 },
  { lineId: 'L2', itemNumber: '100455', description: 'Sensodyne Repair & Protect 75ml', qty: 1, uom: 'EA', gross: 32.2 },
]

const BASE: HeaderState = {
  mode: 'Delivery',
  customer: null,
  address: null,
  plant: ENTRY_STORE,
  slot: null,
  documentSource: null,
  sourceReference: null,
  payment: null,
  paymentForced: false,
  lines: [],
  open: 'none',
  canAddItem: false,
  submitBlockers: ['NO_LINES', 'NO_CUSTOMER', 'STORE_NOT_CHOSEN', 'NO_ADDRESS', 'MISSING_SLOT', 'MISSING_SOURCE_REFERENCE'],
}

/** Caller attached, delivery, address still to come. */
const CALLER: HeaderState = {
  ...BASE,
  customer: CUSTOMER,
  submitBlockers: ['NO_LINES', 'STORE_NOT_CHOSEN', 'NO_ADDRESS', 'MISSING_SLOT', 'MISSING_SOURCE_REFERENCE'],
}

/** The gate is open: caller attached and a store somebody chose. */
const OPEN_GATE: HeaderState = {
  ...CALLER,
  address: ADDRESS,
  plant: { code: '1101', name: 'Al Malqa', source: 'derivedFromAddress' },
  canAddItem: true,
  submitBlockers: ['NO_LINES', 'MISSING_SLOT', 'MISSING_SOURCE_REFERENCE'],
}

const READY: HeaderState = {
  ...OPEN_GATE,
  slot: { day: 'Today', from: '18:00', to: '21:00', isActive: true },
  documentSource: 'CALLCENTER',
  sourceReference: 'CRM-889231',
  payment: 'CashOnDelivery',
  lines: LINES,
  submitBlockers: [],
}

export type Scenario = { key: string; label: string; proves: string; state: HeaderState }

export const SCENARIOS: Scenario[] = [
  {
    key: 'opening',
    label: '1 · Order open, nothing attached',
    proves:
      '175 — the true opening state. canAddItem FALSE, plant seededAtOpen, store chip carrying STORE_NOT_CHOSEN. Must read as intended sequence, never as everything disabled.',
    state: BASE,
  },
  {
    key: 'fulfilment',
    label: '2 · Choosing delivery or collection',
    proves: '176 — undrawn today. Where does the mode live, and does it read as a question the agent asks the caller?',
    state: { ...CALLER, open: 'fulfilment' },
  },
  {
    key: 'caller',
    label: '3 · Caller attached, delivery, no address',
    proves: '137 ordering + 175 — the gate is still shut on the store half, and the address is what closes it.',
    state: CALLER,
  },
  {
    key: 'deliveryWhere',
    label: '4 · Delivery — city, district, derived store',
    proves:
      'THE OTHER LIST. GetCities/GetDistricts, not the store estate. The district CARRIES its delivery store; one is on a temp reassignment and two have none assigned at all.',
    state: { ...CALLER, open: 'where' },
  },
  {
    key: 'pickupStore',
    label: '4 · Pick-in-store, choosing the store',
    proves: 'The store is the PRIMARY input, not an override. Each variant draws a different picker — this is the comparison.',
    // 154: under collection `submitBlockers` carries NEITHER NO_ADDRESS NOR
    // MISSING_SLOT — the builder discards an address and RequiresSlot is
    // delivery-only. A receipt still asking for them would be asking for
    // something the order cannot hold.
    state: {
      ...CALLER,
      mode: 'PickInStore',
      open: 'where',
      submitBlockers: ['NO_LINES', 'STORE_NOT_CHOSEN', 'MISSING_SOURCE_REFERENCE'],
    },
  },
  {
    key: 'pickupChosen',
    label: '5 · Store chosen for collection',
    proves: 'plantSource: chosenForPickup. Gate OPEN with no address at all — address and slot hidden, not optional (154).',
    state: {
      ...CALLER,
      mode: 'PickInStore',
      plant: { code: '1204', name: 'Al Yasmin', source: 'chosenForPickup' },
      canAddItem: true,
      submitBlockers: ['NO_LINES', 'MISSING_SOURCE_REFERENCE'],
    },
  },
  {
    key: 'when',
    label: '6 · Picking a delivery slot',
    proves: 'Days → times, real data. A full window and a past window are different answers to give out loud.',
    state: { ...OPEN_GATE, open: 'when' },
  },
  {
    key: 'reference',
    label: '7 · Source and its reference',
    proves: 'Two chips today, never a capture surface. The source DECIDES whether a reference is mandatory.',
    state: {
      ...OPEN_GATE,
      slot: { day: 'Today', from: '18:00', to: '21:00', isActive: true },
      open: 'reference',
      submitBlockers: ['NO_LINES', 'MISSING_SOURCE_REFERENCE'],
    },
  },
  {
    key: 'payment',
    label: '8 · Payment type',
    proves: '155 — drawn NOWHERE today. Cash on delivery or paid online, and a P2E source forces the pair locked.',
    state: {
      ...OPEN_GATE,
      slot: { day: 'Today', from: '18:00', to: '21:00', isActive: true },
      documentSource: 'CALLCENTER',
      sourceReference: 'CRM-889231',
      open: 'payment',
      submitBlockers: ['NO_LINES'],
    },
  },
  {
    key: 'paymentForced',
    label: '9 · Payment forced by the source',
    proves: 'CC2 IsPaymentForced — a P2E source locks PaidOnline. The lock must say WHY, or it reads as broken.',
    state: {
      ...OPEN_GATE,
      slot: { day: 'Today', from: '18:00', to: '21:00', isActive: true },
      documentSource: 'P2E',
      sourceReference: 'P2E-55210',
      payment: 'PaidOnline',
      paymentForced: true,
      open: 'payment',
      submitBlockers: ['NO_LINES'],
    },
  },
  {
    key: 'ready',
    label: '10 · Header complete, items added',
    proves:
      'Progressive collapse: every settled section is a chip and the centre is the basket. Also the GS1 defect — a call-centre line demands NO scan.',
    state: READY,
  },
]

export const money = (n: number) => n.toFixed(2)

/** The words a blocker gets. Same table discipline as `submit-blockers.ts`. */
export const BLOCKER_WORDS: Record<string, string> = {
  NO_LINES: 'no items yet',
  NO_CUSTOMER: 'no caller attached',
  STORE_NOT_CHOSEN: "this order's store has not been chosen",
  NO_ADDRESS: 'no delivery address',
  MISSING_SLOT: 'no delivery slot',
  MISSING_SOURCE_REFERENCE: 'no source reference',
}

/**
 * The item master the command line searches. `estimatePriceExVat` is deliberately
 * ~13% under the basket line (131): the catalogue estimate is ex-VAT while the
 * basket is VAT-inclusive, and an agent who quotes the search row raw under-quotes
 * the caller out loud. 135 amendment 1 keeps it OFF the money column entirely.
 */
export type Catalogue = { itemNumber: string; description: string; arabic: string; estimateExVat: number; atp: number | null }

export const CATALOGUE: Catalogue[] = [
  { itemNumber: '100001', description: 'Panadol Extra 500mg — 24 tabs', arabic: 'بنادول إكسترا', estimateExVat: 12.0, atp: 5 },
  { itemNumber: '100002', description: 'Panadol Advance 500mg — 48 tabs', arabic: 'بنادول أدفانس', estimateExVat: 19.57, atp: 0 },
  { itemNumber: '100019', description: 'Panadol Cold & Flu Day — 24 tabs', arabic: 'بنادول للبرد', estimateExVat: 16.52, atp: null },
  { itemNumber: '100077', description: 'Panadol Children suspension 100ml', arabic: 'بنادول أطفال', estimateExVat: 11.3, atp: 44 },
  { itemNumber: '100455', description: 'Sensodyne Repair & Protect 75ml', arabic: 'سنسوداين', estimateExVat: 28.0, atp: 18 },
  { itemNumber: '200145', description: 'Oral-B Pro floss 50m', arabic: 'خيط أسنان', estimateExVat: 9.13, atp: 12 },
  { itemNumber: '200188', description: 'Colgate Total mouthwash 500ml', arabic: 'غسول فم', estimateExVat: 21.3, atp: 4 },
  { itemNumber: '300012', description: 'Centrum Silver multivitamin — 60', arabic: 'سنتروم', estimateExVat: 78.26, atp: 9 },
]

/** The header verbs the same line reaches with a leading `/` — 153's grammar,
 *  without a second surface to learn. */
export const VERBS = [
  { cmd: '/store', label: 'Change the store', surface: 'where' },
  { cmd: '/slot', label: 'Pick a delivery slot', surface: 'when' },
  { cmd: '/source', label: 'Set source and reference', surface: 'reference' },
  { cmd: '/pay', label: 'Payment type', surface: 'payment' },
  { cmd: '/collect', label: 'Switch to collection in store', surface: 'fulfilment' },
] as const
