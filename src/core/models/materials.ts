// Wire shapes for the `MaterialWeb/*` doors (BackOffice spec 2544, ticket 451).
//
// 🚩 The ONE source is the door contract,
// `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`. Every type below
// mirrors it field for field in the camelCase ASP.NET Core emits: no field invented, none renamed,
// none dropped. Written once, for every door, by the area's first slice — 452–454 read them here
// rather than each re-deciding a shape.
//
// Material numbers and store codes are STRINGS on the wire and stay strings: leading zeros are
// kept and nothing here is ever `Number()`-ed. Times are local wall-clock with no offset
// (`yyyy-MM-ddTHH:mm:ss`), dates `yyyy-MM-dd`; an absent value is `null`.

// ── Errors ───────────────────────────────────────────────────────────────────────────────────────

/** The area's own refusal codes (contract § Error codes), read through `apiErrorCode`. */
export const MATERIAL_ERRORS = {
  /** 404 — `Material/{no}`: no such material. */
  notFound: 'MAT-00001',
  /** 400 — `Stock`: more than 50 materials. */
  tooManyMaterials: 'MAT-00002',
  /** 400 — `Stock`: no materials. */
  noMaterials: 'MAT-00003',
  /** 502 — `Stock`: Stock Visibility unreachable, or any chunk failed. */
  stockUnavailable: 'MAT-00004',
  /** 400 — `Gs1/Check`: no codes, or more than 500. */
  gs1CodeCount: 'MAT-00005',
  /** 400 — `Search`: a text `q` shorter than 3 characters with no other filter set. */
  searchTooShort: 'MAT-00006',
} as const

// ── GET MaterialWeb/Access ───────────────────────────────────────────────────────────────────────

/**
 * Exactly the three keys the probe returns. Cookie-gated, not grant-gated.
 *
 * - `canSearchMaterials` ← `BackOfficeScreen[ItemInquiryCustome,03]` (sic — the WPF ControllerID):
 *   Search, Levels, Facets, Material.
 * - `canCheckStock` ← `MaterialStockInquiry,03`: Stock, StoreSets.
 * - `canCheckGs1` ← `Gs1SerialInquiry,03` (new): Gs1/Check, Gs1/History.
 */
export interface MaterialAccessResult {
  canSearchMaterials: boolean
  canCheckStock: boolean
  canCheckGs1: boolean
}

// ── GET MaterialWeb/Search ───────────────────────────────────────────────────────────────────────

/** How the server read `q`. `null` when `q` was absent and only filters were sent. */
export type MaterialResolvedAs = 'text' | 'barcode' | 'gs1' | 'code'

/** What `q` resolved through — present only when `resolvedAs` is `gs1` or `barcode`. */
export interface MaterialResolvedFrom {
  gtin: string | null
  barcode: string | null
}

/**
 * One search row: `Item` left-joined to `ItemInfo`. `hasInfo: false` means no ItemInfo row — the
 * level, vendor, brand and status fields are then `null`.
 */
export interface MaterialSearchRow {
  materialNumber: string
  description: string | null
  description2: string | null
  aCode: string | null
  aDesc: string | null
  bCode: string | null
  bDesc: string | null
  cCode: string | null
  cDesc: string | null
  dCode: string | null
  dDesc: string | null
  eCode: string | null
  eDesc: string | null
  /** The vendor's NUMBER — a string, leading zeros kept. */
  vendorNo: string | null
  vendorName: string | null
  brand: string | null
  manufacturer: string | null
  status: string | null
  itemType: number | null
  blocked: boolean
  serialised: boolean
  /** As the master holds it, EXCLUDING VAT — shown with 3 decimals and labelled ex VAT. */
  unitPriceExVat: number | null
  hasInfo: boolean
}

export interface MaterialSearchResult {
  resolvedAs: MaterialResolvedAs | null
  resolvedFrom: MaterialResolvedFrom | null
  /** True exactly when more rows matched than `take`. */
  limited: boolean
  rows: MaterialSearchRow[]
}

// ── GET MaterialWeb/Levels ───────────────────────────────────────────────────────────────────────

/** The five hierarchy levels, top to bottom. */
export type MaterialLevel = 'A' | 'B' | 'C' | 'D' | 'E'

/** One distinct value at a level. The empty code is never returned. */
export interface MaterialLevelValue {
  code: string
  description: string | null
}

// ── GET MaterialWeb/Facets ───────────────────────────────────────────────────────────────────────

export type MaterialFacetKind = 'vendor' | 'brand' | 'manufacturer' | 'status'

/** A typeahead value. A vendor's `value` is its number; its `label` the name. */
export interface MaterialFacetValue {
  value: string
  label: string | null
}

// ── GET MaterialWeb/Material/{materialNumber} ────────────────────────────────────────────────────

/** The Master tab: every Search row field, plus the ItemInfo fields the search does not carry. */
export interface MaterialMaster extends MaterialSearchRow {
  vendorName2: string | null
  manufactureCode: string | null
  manufactureName: string | null
  sfdaCode: string | null
  wasfatyCode: string | null
  houseBrand: string | null
  otcList: string | null
  itemGrade: string | null
  abc: string | null
  categoryManager: string | null
  purchaseGroup: string | null
  materialGroup: string | null
  itemClass: string | null
  uomBase: string | null
  salesUom: string | null
  purchaseUom: string | null
  trackingType: number | null
  temperature: string | null
  /** `yyyy-MM-dd`. */
  createdDate: string | null
}

export interface MaterialBarcode {
  barcode: string
  uom: string | null
  quantity: number | null
  isMain: boolean
}

export interface MaterialBatch {
  batch: string
  vendorBatch: string | null
  /** `yyyy-MM-dd`. */
  expiry: string | null
}

export interface MaterialDetail {
  master: MaterialMaster
  barcodes: MaterialBarcode[]
  /** `[]` for a material that is not serialised. */
  batches: MaterialBatch[]
}

// ── POST MaterialWeb/Stock ───────────────────────────────────────────────────────────────────────

export interface MaterialStockRequest {
  materials: string[]
  /** `null` means every store (filtered by `includeClosed`). */
  stores: string[] | null
  includeZero: boolean
  includeClosed: boolean
}

/** One material × store cell. Quantities are signed: POS and OMS can be negative. */
export interface MaterialStockCell {
  materialNumber: string
  storeCode: string
  storeName: string | null
  atp: number
  sapUnrestricted: number
  pos: number
  oms: number
  /** Local wall-clock, no offset. */
  updatedAt: string | null
}

export interface MaterialStockResult {
  /** Sorted by material, then ATP descending. */
  cells: MaterialStockCell[]
  storesAsked: number
  materialsAsked: number
}

// ── GET MaterialWeb/StoreSets ────────────────────────────────────────────────────────────────────

export type MaterialStoreSetKind = 'area' | 'city' | 'district' | 'supervisor'

export interface MaterialStoreSet {
  value: string
  label: string | null
  storeCount: number
}

/** `GET MaterialWeb/StoreSets/{kind}/{value}?includeClosed=` — one store of the set. */
export interface MaterialStoreSetStore {
  storeCode: string
  storeName: string | null
  city: string | null
  closed: boolean
}

// ── POST MaterialWeb/Gs1/Check ───────────────────────────────────────────────────────────────────

export interface Gs1CheckRequest {
  /** 1–500 raw scans, byte for byte. */
  codes: string[]
}

/** The GS1 parser's issue categories. */
export type Gs1IssueCategory = 'Structure' | 'GtinIntegrity' | 'Charset' | 'Expiry'

export interface Gs1Issue {
  category: Gs1IssueCategory
  message: string
}

export interface Gs1Parse {
  /** False when any issue blocks parsing. */
  valid: boolean
  gtin: string | null
  /** `yyyy-MM-dd`. */
  expiry: string | null
  lot: string | null
  serial: string | null
  issues: Gs1Issue[]
}

export interface Gs1Material {
  materialNumber: string
  description: string | null
  description2: string | null
}

/** Why `material` is null. */
export type Gs1MaterialReason = 'NOT_PARSED' | 'GTIN_UNKNOWN'

export type Gs1BatchVerdict = 'known' | 'unknown' | 'notApplicable'

/** The estate serial check's verdict; `null` when there is no material or serial. */
export type Gs1UnitStatus = 'SELLABLE' | 'SOLD' | 'HELD'

export interface Gs1SoldRef {
  storeCode: string
  machine: string
  trxNumber: string
}

export interface Gs1HeldBy {
  documentNo: string
  storeCode: string
}

/** One answer, in request order. */
export interface Gs1CheckAnswer {
  /** The raw scan as sent. */
  code: string
  /** A second identical code in one request: flagged, and given the same answer. */
  duplicate: boolean
  parse: Gs1Parse
  material: Gs1Material | null
  materialReason: Gs1MaterialReason | null
  batch: Gs1BatchVerdict
  status: Gs1UnitStatus | null
  soldRef: Gs1SoldRef | null
  heldBy: Gs1HeldBy | null
  historyCount: number
}

// ── GET MaterialWeb/Gs1/History ──────────────────────────────────────────────────────────────────

/** `SALE` is transaction type 100, `RETURN` 110. */
export type Gs1TrxType = 'SALE' | 'RETURN'

/** One row of a serial's trail, oldest → newest. Completed invoices only. */
export interface Gs1HistoryRow {
  /** `yyyy-MM-dd`. */
  date: string
  /** `HH:mm:ss`, a separate field from `date`. */
  time: string
  trxType: Gs1TrxType
  storeCode: string
  storeName: string | null
  machine: string
  trxNumber: string
  lot: string | null
  /** Set when `lot` differs from the scanned lot; always false when no lot was sent. */
  lotMismatch: boolean
}
