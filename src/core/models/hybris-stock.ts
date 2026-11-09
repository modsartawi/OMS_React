// The Hybris stock sync's web doors (BackOffice spec 3447, ADR 0127; oms tickets 847–850).
//
// Built to the door contract `C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md`
// (BackOffice 3453–3456, reconciled 2026-11-09 at BackOffice 6749be2de; ticket 851 walks them live).
// `HybrisStockWeb/` prefix, cookie auth, a BARE 403 for a missing grant, refusal codes in
// `errors[].errorCode`, every `errorMessage` "<English> / <Arabic>". Every stamp is local KSA wall-clock
// time `yyyy-MM-ddTHH:mm:ss`, no offset (the `no-utc-time` rule); an absent one is `null`.

/** The `HybrisStockWeb/*` refusal codes the screens read by name (the contract's "Error codes"). */
export const HYBRIS_STOCK_ERRORS = {
  /** 400 — a reason is required (1–200 characters once trimmed). */
  reasonInvalid: 'HYS-00001',
  /** 404 — no such store in the store master (nor on the Hybris stock list). */
  noSuchStore: 'HYS-00002',
  /** 400 — Mark: the store is closed. */
  storeClosed: 'HYS-00003',
  /** 409 — Mark: the store is already a Hybris stock store. */
  alreadyMarked: 'HYS-00004',
  /** 409 — Unmark: the store is not a Hybris stock store. */
  notMarked: 'HYS-00005',
  /** 404 — Add: no such material in the material master. */
  unknownMaterial: 'HYS-00010',
  /** 409 — Add: the material is already on the list. */
  materialListed: 'HYS-00011',
  /** 404 — Enable / Disable / material History: the material is not on the list. */
  materialNotListed: 'HYS-00012',
  /** 409 — Enable: already enabled. */
  alreadyEnabled: 'HYS-00013',
  /** 409 — Disable: already disabled. */
  alreadyDisabled: 'HYS-00014',
  /** 409 — Upload commit: the file, or the list, changed since the preview — preview again. */
  previewStale: 'HYS-00015',
  /** 400 — Upload: no file, over 10 MB, not .csv/.xlsx, unreadable, no rows, > 50,000 rows, no material column. */
  fileUnreadable: 'HYS-00016',
  /** 404 — Lines: no such push. */
  noSuchPush: 'HYS-00020',
  /** 409 — Push now: a chosen store is being pushed. Nothing is recorded. */
  pushBusy: 'HYS-00030',
  /** 409 — Push now: a chosen store is not a marked Hybris stock store. */
  pushStoreNotMarked: 'HYS-00031',
  /** 400 — Materials push now: a chosen material is not an ENABLED Hybris stock material. */
  materialNotEnabled: 'HYS-00032',
  /** 400 — Materials push now: no store or no material, or more than 200 stores / 1,000 materials. */
  pushSelectionInvalid: 'HYS-00033',
  /** 409 — Push now: the rail is switched off (`Hybris:StockSync:Enabled`). Nothing is recorded. */
  railOff: 'HYS-00034',
  /** 400 — a filter value the door does not know. */
  filterUnknown: 'HybrisStockFilterUnknown',
  /** 400 — paging out of range, a malformed day, `from` after `to`. */
  inputInvalid: 'HybrisStockInputInvalid',
} as const

/** A material number as the upload reads it: letters, digits, `.`, `_`, `-`; up to 30. Kept as typed. */
export const MATERIAL_NUMBER = /^[A-Za-z0-9._-]{1,30}$/

/** The materials push-now door's selection limits (HYS-00033). */
export const PUSH_LIMITS = { stores: 200, materials: 1000 } as const

// ── Access and status ────────────────────────────────────────────────────────────────────────────

/** `GET HybrisStockWeb/Access` — exactly these two keys. Manage implies view (by role). */
export interface HybrisStockAccessResult {
  canView: boolean
  canManage: boolean
}

/** Off (the feature flag), shadow (a path Hybris does not import) or live. */
export type HybrisStockMode = 'off' | 'shadow' | 'live'

export type HybrisStockTarget = 'shadow' | 'live'

/** A standing alert of the rail, one per kind at most, oldest raised first. */
export interface HybrisStockAlert {
  kind: 'upload-failing' | 'stock-visibility' | 'store-behind' | string
  /** Server text. */
  title: string
  /** When it was raised; it does not move while the alert stands. */
  raisedAt: string | null
}

/** `GET HybrisStockWeb/Status` — the rail's settings as this host read them at start. */
export interface HybrisStockStatus {
  mode: HybrisStockMode | string
  target: HybrisStockTarget | string
  /** `master/hotfolder-shadow/` or `master/hotfolder/`. */
  targetPath: string
  deltaMinutes: number
  overlapMinutes: number
  fullRoundHours: number[]
  storesPerRound: number
  maxRowsPerFile: number
  minutesBetweenParts: number
  lineRetentionDays: number
  alerts: HybrisStockAlert[]
}

// ── Stores (847) ─────────────────────────────────────────────────────────────────────────────────

/** A marked store's sync health. The server decides every flag (`HybrisStockHealth`); the screen never
 *  does the arithmetic (story 11). */
export interface HybrisStockStoreHealth {
  /** Start of the last SUCCESSFUL delta / full; `null` before one. */
  lastDeltaAt: string | null
  lastFullAt: string | null
  /** A "due by" time; `null` when the store never had a full and none is requested. */
  nextFullDue: string | null
  /** Set by Mark; cleared by a full that started after the request. */
  fullRequested: boolean
  /** The last failed push's error; `null` once a push succeeds. */
  lastError: string | null
  lastErrorAt: string | null
  deltaBehind: boolean
  fullOverdue: boolean
  /** Not delta behind and not full overdue. */
  healthy: boolean
}

/** One row of `GET HybrisStockWeb/Stores` — every OPEN store, plus every marked store even when closed. */
export interface HybrisStockStoreRow {
  storeCode: string
  /** `""` when the store master has no row for the code. */
  storeName: string
  closed: boolean
  marked: boolean
  /** `null` while unmarked. */
  markedAt: string | null
  markedBy: string | null
  /** `null` while unmarked. */
  health: HybrisStockStoreHealth | null
}

/** `flag` on the stores list — `any` is the default and is left off the wire. */
export type HybrisStockFlagFilter = 'any' | 'marked' | 'unmarked'
/** `health` on the stores list — `ok` and `unhealthy` match marked stores only. */
export type HybrisStockHealthFilter = 'any' | 'ok' | 'unhealthy'

export interface HybrisStockStoresQuery {
  flag: HybrisStockFlagFilter
  health: HybrisStockHealthFilter
  q: string | null
}

/** Mark, Unmark, Enable, Disable, store push now. */
export interface HybrisStockReasonBody {
  reason: string
}

/** One row of `GET HybrisStockWeb/Stores/{storeCode}/History?take=`, newest first. */
export interface HybrisStockStoreChange {
  changeId: string
  /** `M` mark, `U` unmark. */
  action: 'M' | 'U' | string
  /** `oms-react`; `api` is reserved for the deferred Hybris API. */
  door: string
  /** Free text the user typed. */
  reason: string
  changedBy: string
  changedAt: string
}

// ── Materials (848) ──────────────────────────────────────────────────────────────────────────────

export interface HybrisStockMaterialRow {
  materialNumber: string
  /** The material master's names (`Item.Description` / `Description2`), `""` when absent. */
  nameEn: string
  nameAr: string
  enabled: boolean
  addedAt: string | null
  addedBy: string | null
  updatedAt: string | null
  updatedBy: string | null
  /** Stamped on add-enabled and re-enable: the next delta sends it everywhere. `null` if never enabled. */
  lastEnabledAt: string | null
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

/** `POST HybrisStockWeb/Materials` — `enabled` omitted means `true`. */
export interface HybrisStockAddMaterialBody {
  materialNumber: string
  enabled?: boolean
  reason: string
}

export type HybrisStockPreviewOutcome = 'new' | 'changed' | 'unchanged' | 'refused'

/** Why a preview row is refused. */
export type HybrisStockRefusal = 'malformed' | 'repeated' | 'unknownMaterial' | string

/** One row of an upload preview, in file order. */
export interface HybrisStockPreviewRow {
  /** The row a spreadsheet shows (the header is row 1). */
  rowNumber: number
  /** The list's / master's spelling when known, else as typed. */
  materialNumber: string
  /** What the file asks; `null` = states nothing. */
  enabled: boolean | null
  /** The list's state now; `null` = not on the list. */
  currentEnabled: boolean | null
  outcome: HybrisStockPreviewOutcome
  /** Only on a refused row. */
  refusal: HybrisStockRefusal | null
}

/** `POST HybrisStockWeb/Materials/Upload/Preview` (multipart `file`). A dry run — writes nothing. */
export interface HybrisStockUploadPreview {
  /** 64 hex; the commit must reproduce it. */
  contentHash: string
  counts: Record<HybrisStockPreviewOutcome, number>
  rows: HybrisStockPreviewRow[]
}

/** `POST HybrisStockWeb/Materials/Upload/Commit` (multipart `file`, `contentHash`, `reason`). */
export interface HybrisStockUploadResult {
  /** On every history row it wrote; `null` when it changed nothing. */
  uploadId: string | null
  counts: Record<HybrisStockPreviewOutcome, number>
}

// ── Pushes (849) ─────────────────────────────────────────────────────────────────────────────────

/** The push log's type words (`type=` filter and the row's `type`). */
export type HybrisStockPushType = 'delta' | 'full' | 'now-store' | 'now-materials'

/** The push log's status words: `sent` = delivered to the hot folder, never "live on the website". */
export type HybrisStockPushStatus = 'running' | 'sent' | 'failed'

/** One push of `GET HybrisStockWeb/Pushes`. Kept permanently; its lines `lineRetentionDays`. */
export interface HybrisStockPushRow {
  pushId: string
  type: HybrisStockPushType | string
  status: HybrisStockPushStatus | string
  /** Server text, `"<English> / <Arabic>"`. */
  statusText: string
  startedAt: string
  /** `null` while running. */
  finishedAt: string | null
  storeCount: number
  storeCodes: string[]
  /** Push now only; `null` for a scheduled delta or full. */
  requestedBy: string | null
  reason: string | null
  rows: number
  target: HybrisStockTarget | string
  targetPath: string
  fileCount: number
  /** `[]` when no file was uploaded (a failed push, or an empty run). */
  fileNames: string[]
  /** Server text, verbatim; on a running push, a failing part's error. */
  error: string | null
  /** On a running SPLIT push only. */
  parts: { uploaded: number; total: number } | null
  /** The push's lines are still within the retention (Lines answers them). */
  linesKept: boolean
}

export interface HybrisStockPushesQuery {
  store: string | null
  type: HybrisStockPushType | null
  status: HybrisStockPushStatus | null
  /** `yyyy-MM-dd`, inclusive, on the start. */
  from: string | null
  to: string | null
  /** The newest N — the door takes no `skip` and answers no total (1–500). */
  take: number
}

export interface HybrisStockPushLine {
  storeCode: string
  materialNumber: string
  /** Whole units, never below 0. */
  quantity: number
}

/** `GET HybrisStockWeb/Pushes/{pushId}/Lines?store=&material=&skip=&take=` */
export interface HybrisStockPushLinesPage {
  pushId: string
  /** `false` past the retention: `total: 0`, `lines: []`. */
  linesKept: boolean
  /** Every line matching the filters, not only this page. */
  total: number
  lines: HybrisStockPushLine[]
}

/** One row of `GET HybrisStockWeb/Stores/{storeCode}/Materials/{materialNumber}/History`, newest first. */
export interface HybrisStockMaterialSent {
  pushId: string
  type: HybrisStockPushType | string
  status: HybrisStockPushStatus | string
  /** The push's start. */
  sentAt: string
  quantity: number
}

// ── Push now (850) ───────────────────────────────────────────────────────────────────────────────

/** `POST HybrisStockWeb/Pushes/MaterialsNow` — chosen materials × chosen stores. */
export interface HybrisStockPushMaterialsBody {
  storeCodes: string[]
  materialNumbers: string[]
  reason: string
}

/** Push now's answer (both doors): the push as recorded. A failed upload is a 200 with `status: "E"`. */
export interface HybrisStockPushNowResult {
  pushId: string
  /** `S` store (a full), `M` materials. */
  pushType: 'S' | 'M' | string
  /** `S` delivered to the hot folder, `E` failed, `R` running (a split push, later parts to go). */
  status: 'S' | 'E' | 'R' | string
  storeCodes: string[]
  rowsSent: number
  fileCount: number
  fileNames: string[]
  target: HybrisStockTarget | string
  targetPath: string
  requestedBy: string
  reason: string
  startedAt: string
  finishedAt: string | null
  error: string | null
}
