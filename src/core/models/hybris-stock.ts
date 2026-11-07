// The Hybris stock sync's web doors (BackOffice spec 3447, ADR 0127; oms tickets 847–850).
//
// 🚩 GUESSED SHAPES. The door contract (`C:\Work\DMSCO\BackOffice\.issues\assets\
// 3447-hybris-stock-web-door-contract.md`) is written by BackOffice 3453 and extended by 3454–3456,
// and none of them is built yet (2026-11-07). Every route, field and refusal code below is read off
// spec 3447's "Web API" and "Data" sections, in the HungerStation contract's style (`…Web/` prefix,
// `<CODE>-00000` refusals, a bare 403 for a missing grant, local-time stamps with no zone). Ticket
// 851 reconciles them with the real doors. Every stamp is local KSA time (the `no-utc-time` rule).

/** The `HybrisStockWeb/*` refusal codes the screens read by name. */
export const HYBRIS_STOCK_ERRORS = {
  /** 400 — a reason is required (1–200 characters). */
  reasonInvalid: 'HYS-00001',
  /** 404 — no such store in the store master. */
  noSuchStore: 'HYS-00002',
  /** 409 — the store is already marked (mark) or not marked (unmark). */
  storeState: 'HYS-00003',
  /** 404 — the material number is not a known material. */
  unknownMaterial: 'HYS-00004',
  /** 409 — the material is already on the list (add). */
  materialListed: 'HYS-00005',
  /** 404 — the upload's preview is gone (expired, or committed already). */
  uploadGone: 'HYS-00006',
  /** 400 — the file could not be read (not CSV/XLSX, or no material column). */
  fileUnreadable: 'HYS-00007',
  /** 404 — no such push. */
  noSuchPush: 'HYS-00008',
  /** 409 — push now on a store that is not a Hybris stock store. */
  storeNotMarked: 'HYS-00009',
  /** 409 — the rail is off (`Hybris:StockSync:Enabled` false): push now refused. */
  railOff: 'HYS-00010',
  /** 502 — the file could not be written to the target; the push IS recorded as failed. */
  sinkFailed: 'HYS-00011',
  /** 409 — a push of this store is already running; nothing was recorded. */
  pushBusy: 'HybrisStockPushBusy',
} as const

/** A material number as the material master holds it: 1–18 digits, kept as typed (leading zeros too). */
export const MATERIAL_NUMBER = /^\d{1,18}$/

// ── Access and status ────────────────────────────────────────────────────────────────────────────

/** `GET HybrisStockWeb/Access` — what the signed-in user may do. Manage implies view. */
export interface HybrisStockAccessResult {
  canView: boolean
  canManage: boolean
}

/** Where the rail writes: off (the feature flag), a shadow blob path Hybris does not import, or live. */
export type HybrisStockMode = 'off' | 'shadow' | 'live'

/** A standing alert of the rail (spec 3447 "Alerts"), one per kind. */
export interface HybrisStockAlert {
  kind: 'uploadFailing' | 'stockSourceDown' | 'storeBehind' | string
  /** Server text, `"<English> / <Arabic>"`. */
  message: string
  since: string | null
}

/** `GET HybrisStockWeb/Status` — the rail's mode and its settings. */
export interface HybrisStockStatus {
  mode: HybrisStockMode | string
  deltaMinutes: number
  overlapMinutes: number
  fullRoundHours: number[]
  storesPerRound: number
  lineRetentionDays: number
  alerts: HybrisStockAlert[]
}

// ── Stores (847) ─────────────────────────────────────────────────────────────────────────────────

/** A marked store's sync health. The server decides `deltaBehind` (more than two intervals since the
 *  anchor) and `fullOverdue`; the screen never does the arithmetic (story 11). */
export interface HybrisStockStoreHealth {
  lastDeltaAt: string | null
  lastFullAt: string | null
  nextFullDue: string | null
  /** Set on mark, cleared by a successful full: the store waits for its first full. */
  fullRequested: boolean
  lastErrorAt: string | null
  /** Server text of the last failed push, `null` once a push succeeds. */
  lastError: string | null
  deltaBehind: boolean
  fullOverdue: boolean
}

/** One row of `GET HybrisStockWeb/Stores?marked=&q=` — every store, marked or not. */
export interface HybrisStockStoreRow {
  storeCode: string
  storeName: string
  marked: boolean
  /** The last mark or unmark. */
  changedAt: string | null
  changedBy: string | null
  /** `null` on a store that is not marked. */
  health: HybrisStockStoreHealth | null
}

/** `marked` on the stores list — `any` is the default and is left off the wire. */
export type HybrisStockMarkedFilter = 'any' | 'marked' | 'unmarked'

export interface HybrisStockStoresQuery {
  marked: HybrisStockMarkedFilter
  q: string | null
}

/** `POST HybrisStockWeb/Stores/{storeCode}/Mark` and `/Unmark`. */
export interface HybrisStockReasonBody {
  reason: string
}

/** One row of `GET HybrisStockWeb/Stores/{storeCode}/History`, newest first. */
export interface HybrisStockStoreChange {
  at: string
  by: string
  action: 'mark' | 'unmark'
  /** Free text the user typed. */
  reason: string
  /** `oms-react` now; `api` is reserved for the deferred Hybris API. */
  door: string
}

// ── Materials (848) ──────────────────────────────────────────────────────────────────────────────

export interface HybrisStockMaterialRow {
  materialNumber: string
  materialName: string
  enabled: boolean
  addedAt: string | null
  addedBy: string | null
  updatedAt: string | null
  updatedBy: string | null
}

export type HybrisStockEnabledFilter = 'any' | 'enabled' | 'disabled'

export interface HybrisStockMaterialsQuery {
  q: string | null
  enabled: HybrisStockEnabledFilter
  page: number
}

/** `GET HybrisStockWeb/Materials?q=&enabled=&skip=&take=` */
export interface HybrisStockMaterialsPage {
  total: number
  rows: HybrisStockMaterialRow[]
}

/** `POST HybrisStockWeb/Materials` */
export interface HybrisStockAddMaterialBody {
  materialNumber: string
  reason: string
}

/** `PUT HybrisStockWeb/Materials/{materialNumber}/Enabled` */
export interface HybrisStockEnabledBody {
  enabled: boolean
  reason: string
}

export type HybrisStockPreviewOutcome = 'new' | 'changed' | 'unchanged' | 'refused'

/** Why a preview row is refused. */
export type HybrisStockRefusal = 'unknownMaterial' | 'malformed' | 'badEnabled' | 'repeated' | string

/** One row of an upload preview, in file order. */
export interface HybrisStockPreviewRow {
  /** The 1-based line (CSV) or sheet row (XLSX). */
  line: number
  /** As read from the file — may be malformed on a refused row. */
  materialNumber: string
  /** The master's name; `""` on a refused row. */
  materialName: string
  /** The enabled value the row asks for; `null` when the column is absent (a new row → enabled). */
  enabled: boolean | null
  /** The list's value before the upload; `null` for a new or refused row. */
  wasEnabled: boolean | null
  outcome: HybrisStockPreviewOutcome
  refusal: HybrisStockRefusal | null
}

/** `POST HybrisStockWeb/Materials/Upload/Preview` (multipart `file`). Nothing changes yet. */
export interface HybrisStockUploadPreview {
  uploadId: string
  fileName: string
  counts: Record<HybrisStockPreviewOutcome, number>
  rows: HybrisStockPreviewRow[]
}

/** `POST HybrisStockWeb/Materials/Upload/{uploadId}/Commit` `{ reason }` — what it applied. */
export interface HybrisStockUploadResult {
  uploadId: string
  added: number
  changed: number
  unchanged: number
  refused: number
}

// ── Pushes (849, 850) ────────────────────────────────────────────────────────────────────────────

/** `D` delta, `F` full, `S` push-now store (a full), `M` push-now materials. */
export type HybrisStockPushType = 'D' | 'F' | 'S' | 'M'

/** `R` running, `S` delivered to the hot folder (never "live on the website"), `E` failed. */
export type HybrisStockPushStatus = 'R' | 'S' | 'E'

export type HybrisStockTarget = 'shadow' | 'live'

/** One push. Kept permanently; its lines are kept `lineRetentionDays` (15). */
export interface HybrisStockPushRow {
  pushId: string
  type: HybrisStockPushType | string
  storeCodes: string[]
  startedAt: string
  finishedAt: string | null
  status: HybrisStockPushStatus | string
  rows: number
  target: HybrisStockTarget | string
  files: string[]
  /** Server text; `null` on a push that did not fail. */
  error: string | null
  /** A push now's asker and reason; `null` on a scheduled push. */
  requestedBy: string | null
  reason: string | null
  /** The retention sweeper removed its lines. */
  linesSwept: boolean
}

export interface HybrisStockPushesQuery {
  store: string | null
  type: HybrisStockPushType | null
  status: HybrisStockPushStatus | null
  /** `yyyy-MM-dd`, inclusive. */
  from: string | null
  to: string | null
  page: number
}

/** `GET HybrisStockWeb/Pushes?store=&type=&status=&from=&to=&skip=&take=`, newest first. */
export interface HybrisStockPushesPage {
  total: number
  rows: HybrisStockPushRow[]
}

export interface HybrisStockPushLine {
  storeCode: string
  materialNumber: string
  quantity: number
}

/** `GET HybrisStockWeb/Pushes/{pushId}/Lines?store=&material=&skip=&take=` */
export interface HybrisStockPushLinesPage {
  pushId: string
  total: number
  lines: HybrisStockPushLine[]
}

/** One row of `GET HybrisStockWeb/Stores/{storeCode}/Materials/{materialNumber}/History`, newest first. */
export interface HybrisStockMaterialSent {
  pushId: string
  type: HybrisStockPushType | string
  status: HybrisStockPushStatus | string
  target: HybrisStockTarget | string
  sentAt: string
  quantity: number
}

/** `POST HybrisStockWeb/Pushes/Materials` — push now, chosen materials across chosen stores. */
export interface HybrisStockPushMaterialsBody {
  storeCodes: string[]
  materialNumbers: string[]
  reason: string
}
