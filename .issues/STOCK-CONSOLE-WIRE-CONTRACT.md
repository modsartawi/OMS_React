# Stock console — the web's wire contract (spec 4157, tickets 940–945)

Not an issue. The contract the web was built against, ahead of the server, with each ticket's "as built" notes. Reconcile it with the C# DTOs of BackOffice 4158–4163 when they land.

# Stock console — the wire contract (oms-react 940–945)

THE contract every implementer follows. The server (SIS.Api `StockConsole/*`, BackOffice 4158–4163; Stock Visibility
`Stock/Console/*`, SIS.Stock 075–080) is **not built yet**. Everything below is derived from:

- spec `E:\Projects\BackOffice\.issues\4157-…-spec.md` (cited `[spec Lnnn]`),
- BackOffice tickets `E:\Projects\BackOffice\.issues\4158…4163-*.md` (cited `[BO4158]` …),
- SIS.Stock tickets `E:\Projects\SIS.Stock\.issues\075…080-*.md` (cited `[SV075]` …) — they carry TS-ish shapes,
- `[GUESS]` = not stated anywhere; chosen here so all six tickets agree. When the server lands, reconcile in ONE place
  (the model file + `api.ts` normalisers), not per tab.

## Ground rules (apply to every type)

- **File:** `src/core/models/stock-console.ts` (models live in `src/core/models/<feature>.ts`, one file per feature —
  cf. `stock-health.ts`, `store-stage.ts`, `sync-console.ts`). Header comment in the house style: which routes, which
  grant, "times are local wall clock `yyyy-MM-ddTHH:mm:ss`, no offset, never shifted" (copy the ⚠️ line from
  `src/core/models/stock-health.ts`).
- **camelCase** fields (SIS.Api's Newtonsoft camelCase; every existing stock model is camelCase).
- **Enums are strings**, PascalCase where SIS.Api owns them (`'Computed' | 'Stale' | 'NeverComputed'`, `'Ok' | 'Watch' |
  'Problem'`, `'Gs1' | 'Barcode' | 'Unknown'`, `'HeldServed' | 'LiveOrders'`, `'Applied' | …`) and **camelCase/lowercase
  where Stock Visibility's query vocabulary is passed through** (`filter=withStock`, `state=open`, take `kind: 'granted'`).
  Type them as the union but read defensively (an unknown string must not crash: draw it raw / as "watch").
- **Times:** `string` (`"2026-11-22T10:00:05"`), local, no offset `[spec L271]`. Days: `string` `yyyy-MM-dd`
  (`LocalDate` from `@/core/util/date-window`). Draw with `formatDateTime` / `formatDay` (`@/core/util/date-format`),
  or show raw without the `T`; never `toISOString()`.
- **Quantities:** `number`, base units `[spec L292]`. A figure that may be absent is `number | null` — **null is never
  drawn as 0** (reserved above all `[spec L288-290]`).
- **Store code field is `plant`** `[SV075, SV078]` — SIS.Api "passes through" Stock Visibility's rows and adds its own
  fields `[BO4158 "every store's row from Stock Visibility, with what SIS.Api owns added"]`. `[GUESS]` that SIS.Api does
  not rename `plant` → `store`. Route params still say `{store}`.
- **Item numbers** are strings as Stock Visibility stores them (no leading zeros) `[spec L225]`. Never `Number()` them.
- **Names:** every row that carries an item gets `nameEn`, `nameAr` from HQ's item master `[BO4159]`; empty string when
  the master does not know the number. Draw with `localizedName({nameEn, nameAr}, i18n.language)`
  (`@/core/util/localized-name`) inside `<bdi>`.

### The paged answer `[SV076]` (shared by every list route)

```ts
/** Stock Visibility's page, passed through by SIS.Api. size defaults 25, clamped at 200 [SV076]. */
export interface StockConsolePage<T> {
  total: number   // the whole match, not this page
  page: number    // 1-based
  size: number
  rows: T[]
}
```

The repo has **no shared core paged type**: `Paged<T>` is re-declared per model (`sync-console.ts:130`,
`sap-export.ts:126`) as `{ items, total, page, pageSize }`. The console's wire is Stock Visibility's
`{ total, page, size, rows }`, so declare `StockConsolePage<T>` in `stock-console.ts` `[GUESS: SIS.Api keeps SV's
names]`. `api.ts` normalises (`toPage`, the one page normaliser): `rows ?? lines ?? []`, `total ?? rows.length` (review
fix A5: never 0 over rows), `page ?? asked`, `size ?? asked`; a bare array reads as one page of it.

Page size used by the web: **25** `[spec L49]` (`STOCK_CONSOLE_PAGE_SIZE = 25`, in the feature's `search.ts`).

## Refusal codes

All arrive through `@/core/api` as an `ApiError`; read the code with `apiErrorCode(err)` (= `err.details[0].errorCode`),
show the server sentence with `apiErrorMessage(err, fallback)`. SIS.Api's `EndpointHelpers.ExecuteAsync` turns a
`DomainException` into **HTTP 400** `{ success:false, message, errors:[{ errorCode, internalErrorCode, errorMessage }] }`
(read in `BackOffice\…\Services\SIS.Api\Endpoints\Helpers\EndpointHelpers.cs`). `core/api.ts`'s `failureFromEnvelope`
maps any coded envelope to `kind:'business'` **even on a 5xx** ("A CODED refusal outranks its status").

| Code | From | Meaning / when | Web sentence key (proposed `refusal.<code>`) |
|---|---|---|---|
| `ConsoleBusy` | SV 429 → SIS.Api by name `[SV075, BO4158]` | 4 console reads already running | "The console is busy. Try again in a moment." |
| `ConsoleTimeout` | SV 504 → SIS.Api `[SV075, BO4158]` | the read passed its 8 s limit | "The read took too long. Narrow the search or try again." |
| `NoStore` | SV 404 `[SV075, BO4158]` | unknown store on `Stores/{store}` | store page "no such store" panel (sync `StorePage` `noStore` precedent) |
| `NoRow` | SV 404 `[SV078]` | item with no stock row at the store | item page "no such item at this store" panel |
| `NarrowTheName` | SIS.Api `[BO4159]` | name search found > 200 items ("name too wide") | "Over 200 items match this name. Type more of it, or the item number." |
| `NothingToFind` | SIS.Api `[BO4161]` | Find with both boxes empty (the web never sends it — guard) | "Fill the item or the batch box." |
| `BatchTooShort` | SV 400 `[SV076]` | prefix `*` with < 3 chars | "A batch prefix needs three characters or more before *." |
| `PrefixNeedsItem` | SV 400 `[SV078]` / SIS.Api `[BO4161]` | fleet-wide prefix without an item | "A batch prefix across the fleet needs an item." |
| `BatchNeeded` | SV 400 `[SV078]` | Find on SV without batch (SIS.Api answers items instead — should never reach web) | generic |
| `WindowTooLong` | SIS.Api first, SV too `[BO4163, SV079, SV080]` | movement window > 7 days (ledger) / > 5 entry days (SAP) | web stops it before the call; this is the backstop |
| `SapNotConfigured` | SV 503 → by name `[SV080, BO4163]` | SAP not connected on this host | "SAP is not connected on this host." — **never an empty list** |
| `SapUnreachable` | SV 502 → by name `[SV080, BO4163]` | SAP error / over its limit | "SAP could not be reached." + `apiErrorMessage` reason |
| `StockVisibilityUnreachable` | SIS.Api `[BO4158 "its own named error, as the stage screen reports it"]` **[GUESS name]** | SV down / over the client's time limit | "Stock Visibility could not be reached. Try again in a moment." |
| `StockVisibilityTimeout` | **[GUESS — may be folded into the one above]** | SIS.Api's HTTP client gave up | same family as above |
| *(bare 403)* | grant filter | person lost `StockConsole:03` | `isBareDenial(err)` from `@/core/api`; `core/permissions` already invalidates on 403 so `ScreenGate` re-gates |
| *(no code, `kind:'network'/'server'`)* | | outage | `apiErrorMessage(err, t('…failed'))` |

⚠️ The stage screen today does **not** name its unreachable error (`StoreStageHttpClient.Read` throws a bare
`HttpRequestException` → 500 → web `kind:'server'`). So the two `StockVisibility*` names are guesses. Rule for the web:
**one pure table** `refusalSentence(err)` in the feature (`refusals.ts`, ticket 941) maps code → key; unknown code →
`apiErrorMessage(err, t('refusal.failed'))`; `kind` `network`/`server` with no code → the "not reached" sentence. A
renamed code is then a one-line change.

Retry policy for react-query: do not retry `ConsoleBusy`, `NoStore`, `NoRow`, `NarrowTheName`, `WindowTooLong`,
`SapNotConfigured`, `PrefixNeedsItem`, `BatchTooShort` (they are answers). Suggested
`retry: (n, err) => apiErrorKind(err) !== 'business' && n < 1`.

---

## Types per route

Ticket that introduces each type in brackets. **940 creates the file**; later tickets append below a
`// ── <ticket> ──` divider (keeps parallel merges of 942 ∥ 944 to appends).

### Shared figure pieces — [940]

```ts
/** Reserved's three states, judged by SIS.Api [BO4158; spec L288-290]. */
export type ReservedState = 'Computed' | 'Stale' | 'NeverComputed'

/** The store's status: the worst of its flags [spec L316]. */
export type StoreStatus = 'Ok' | 'Watch' | 'Problem'

export type FlagLevel = 'Watch' | 'Problem'

/** The six flags [spec L307-314]. Codes are [GUESS: PascalCase of the spec's names]. */
export const STOCK_CONSOLE_FLAGS = ['SapQuiet', 'BelowZero', 'OldHold', 'SalesNotApplied', 'ComparisonDiffers', 'PlaceholderStock'] as const
export type StockConsoleFlagCode = (typeof STOCK_CONSOLE_FLAGS)[number]

/** One flag, with its measured value and its limit [BO4158 "{ code, level, value, limit }"]. */
export interface StockConsoleFlag {
  code: string            // StockConsoleFlagCode, read defensively
  level: string           // FlagLevel
  /** The measured value in the flag's own unit [GUESS units]: SapQuiet hours, BelowZero items, OldHold days,
   *  SalesNotApplied hours, ComparisonDiffers batches, PlaceholderStock base units. */
  value: number | null
  /** The limit in the same unit; null for "any" (ComparisonDiffers, PlaceholderStock) [GUESS]. */
  limit: number | null
}
```

Unit table (web locale templates, e.g. `"flag.SapQuiet": "No SAP document for {{value}} hours, limit {{limit}}"`
`[spec L184 story 76]`): SapQuiet h · BelowZero items (Watch > 0, Problem > 500 or any in Blocking) · OldHold days ·
SalesNotApplied h · ComparisonDiffers batches (Problem in Blocking) · PlaceholderStock base units. `[GUESS]` units.

### `GET StockConsole/Stores` → `StockConsoleStores` — [940] (+`fleet` from [942])

```ts
export interface StockConsoleStoreRow {
  plant: string                     // [SV075]
  city: string                      // [SV075] StockPlant.City
  stage: string                     // 'Shadow'|'Seeding'|'Seeded'|'Blocking' as Stock/StoreStages answers [SV075]
  itemsWithStock: number            // [SV075] rows with either counter <> 0
  sapStock: number                  // [SV075] SUM(Unrestricted) — the SAP counter
  tillStock: number                 // [SV075] SUM(UnrestrictedPos) — the till-side counter, the store's "stock"
  gap: number                       // [BO4158] sapStock - tillStock
  heldStanding: number              // [SV075]
  heldSold: number                  // [SV075] "sold not applied"
  held: number                      // [BO4158] heldStanding + heldSold
  reserved: number | null           // [SV075/BO4158] null = never computed / no row — NEVER 0
  reservedState: ReservedState      // [BO4158]
  reservedAt: string | null         // [GUESS name] the recompute's last success time (SV reservedRun.lastSuccessAt), for "stale since"
  free: number                      // [BO4158] till − held − reserved, not floored (reserved 0 when NeverComputed)
  reservedIncluded: boolean         // [BO4158] false in NeverComputed → "reserved not included"
  belowZero: number                 // [SV075] items with UnrestrictedPos < 0
  lastUpdate: string | null         // [SV075] MAX(UpdatedAt)
  oldestStandingAt: string | null   // [SV075]
  oldestSoldAt: string | null       // [SV075]
  sapPlace: string | null           // [SV075] SAP feed's place (entry date+time) = "last SAP document applied" [spec Comments]
  sapLastAttempt: string | null     // [SV075]
  tillPlace: string | null          // [SV075] = "last till read"
  tillLastAttempt: string | null    // [SV075]
  driftBatches: number | null       // [SV075] nightly comparison, counted stores only (null = shadow / not counted)
  driftRanAt: string | null         // [SV075]
  placeholderStock: number | null   // [SV075] counted stores only
  flags: StockConsoleFlag[]         // [BO4158]
  status: string                    // StoreStatus [BO4158]
}

export interface StockConsoleStores {
  readAt: string                         // [BO4158] when SIS.Api read it (≤ 60 s old copy)
  stores: StockConsoleStoreRow[]         // whole list, < 1000 rows; tiles/search/sort in the browser [spec L265]
  fleet: StockConsoleFleetProblem[]      // [BO4160] added by 942 server-side; 940 treats missing as []
}
```

`api.ts` normaliser: `{ readAt: d?.readAt ?? '', stores: d?.stores ?? [], fleet: d?.fleet ?? [] }`, and per row
`flags ?? []`. "Counted" = `stage === 'Seeded' || stage === 'Blocking'` `[940 ticket]`.

### `GET StockConsole/Stores/{store}` → `StockConsoleStoreRow` — [941]

Same row as the list, read fresh, never the 60 s copy `[BO4159]`. `NoStore` on an unknown store. The header reads
everything it needs from the row (six figures + sapPlace/tillPlace + flags). No new type.

### `GET StockConsole/Stores/{store}/Items?item=&batch=&filter=&sort=&page=&size=` → `StockConsolePage<StockConsoleItemRow>` — [941]

```ts
export const ITEM_FILTERS = ['all', 'withStock', 'belowZero', 'held', 'differ'] as const   // [SV076; spec L335]
export const ITEM_SORTS = ['item', 'held', 'till', 'gap'] as const                         // [SV076] default 'item'

/** The seven non-unrestricted stock types [SV076/SV078]; shown on the item page "when not zero" [943]. */
export interface StockConsoleOtherStock {
  quality: number; blocked: number; returnsBlocked: number; restricted: number
  inTransit: number; inTransferPlant: number; inTransferLocation: number
}

export interface StockConsoleItemRow extends StockConsoleOtherStock {
  item: string; nameEn: string; nameAr: string     // [SV076; names BO4159]
  sapStock: number; tillStock: number              // [SV076]
  gap: number                                      // [BO4159]
  heldStanding: number; heldSold: number           // [SV076]
  held: number                                     // [BO4159]
  reserved: number | null                          // [SV076]
  reservedState: string                            // ReservedState [BO4159 "as the store list does"]
  free: number; reservedIncluded: boolean          // [BO4159]
  lastUpdate: string | null                        // [SV076]
}
```

Item box rules (server side, the web sends the raw trimmed text as `item`): digits → item number; else name ≥ 2 chars →
SIS.Api searches the master; no match → empty page, SV not called; > 200 → `NarrowTheName` `[BO4159]`. The web does
**not** send `items=` (that is SIS.Api → SV only). `filter=all` / `sort=item` may be omitted (defaults).

### `GET StockConsole/Stores/{store}/Batches?item=&batch=&filter=&page=&size=` → `StockConsolePage<StockConsoleBatchRow>` — [941]

```ts
export const BATCH_FILTERS = ['all', 'withStock', 'belowZero', 'held', 'placeholder', 'expired', 'expiring'] as const // [SV076] expiring = within 90 days

export interface StockConsoleBatchRow {
  item: string; nameEn: string; nameAr: string
  batch: string                    // our batch [SV076]
  vendorBatch: string | null       // [SV076] [GUESS nullable]
  expiry: string | null            // [SV076] a day ("yyyy-MM-dd" or "yyyy-MM-ddT00:00:00") [GUESS form — compare on the first 10 chars]
  sapStock: number; tillStock: number
  held: number                     // holds on this batch not released [SV076]
  freeForTheDoor: number           // [BO4159] tillStock - held (ignores reserved)
  firstReceivedOn: string | null   // [SV076] (no last-update per batch [spec L291])
  placeholder: boolean             // [SV076] SV's own PlaceholderBatches rule
}
```

Sorted by item then expiry (server) `[spec L338]` — no sort param.

### `GET StockConsole/Stores/{store}/Holds?item=&batch=&state=&page=&size=` → `StockConsolePage<StockConsoleHoldRow>` — [942]

```ts
export const HOLD_STATES = ['open', 'standing', 'sold', 'released'] as const  // [SV077] default 'open' (= Held+Sold); released = last 7 local days

export interface StockConsoleHoldRow {
  takeId: string                  // [SV077]
  item: string; nameEn: string; nameAr: string
  batch: string                   // [SV077] may be blank (hold on no batch)
  quantity: number
  takenAt: string
  state: string                   // [GUESS values] 'Held' | 'Sold' | 'Released' (SV's StockHold.State) — 'Held'=standing, 'Sold'=sold not applied
  source: string                  // [SV077] picking source / till / DRS — draw raw, isolated
  documentNo: string | null       // [SV077] picking document number
  lineNumber: number | null       // [SV077]
  soldStore: string | null        // [SV077] till sale: store
  soldTrx: string | null          // [SV077] till sale: transaction
  updatedAt: string | null        // [SV077]
  releasedAt: string | null       // [SV077] only for released
  releaseReason: string | null    // [SV077]
}
```

Order: oldest first; `released` newest first (server). Age = now − `takenAt` (web, pure, `now` injected).

### `GET StockConsole/Stores/{store}/Takes?item=&batch=&day=&outcome=&page=&size=` → `StockConsoleTakes` — [942]

```ts
export const TAKE_OUTCOMES = ['all', 'granted', 'refused', 'failed'] as const   // [SV077; spec L342]

interface TakeRowBase { takeId: string; at: string }   // [GUESS 'at'] the row's time
export interface StockConsoleTakeGranted extends TakeRowBase {
  kind: 'granted'
  item: string; nameEn: string; nameAr: string
  quantity: number; code: string | null; available: number | null; stage: string | null
  scannedVendorBatch: string | null; scannedExpiry: string | null; enteredBatch: string | null   // [SV077] [GUESS names]
  batches: { batch: string; quantity: number }[]   // the batches it took, from its holds [SV077] [GUESS shape]
}
export interface StockConsoleTakeRefused extends TakeRowBase {
  kind: 'refused'
  item: string; nameEn: string; nameAr: string
  namedBatch: string | null      // the batch the door named instead [SV077 "the batch the door named"] [GUESS name]
  asked: number; available: number | null
  code: string | null; reason: string | null        // [spec L341] reason shown
  isShadow: boolean; stage: string | null
}
export interface StockConsoleTakeFailed extends TakeRowBase {
  kind: 'failed'                                   // no item: the request log has none [SV077; spec Comments]
  durationMs: number | null; statusCode: number | null; instance: string | null
}
export type StockConsoleTakeRow = StockConsoleTakeGranted | StockConsoleTakeRefused | StockConsoleTakeFailed

export interface StockConsoleTakes extends StockConsolePage<StockConsoleTakeRow> {
  failedLeftOut: boolean          // [SV077] true when item/batch was set: failed calls are not searchable by item
}
```

`day` required (web default: today, `localToday()`), `days` 1–3 not sent by the store tab (item tab uses 3 server-side).
An unknown `kind` → draw generic row.

### `GET StockConsole/Stores/{store}/Feeds` → `StockConsoleStoreFeeds` — [942]

```ts
export interface StockConsoleStoreFeeds {     // [BO4160] "from the store's own console row"
  plant: string
  sapPlace: string | null; sapLastAttempt: string | null
  tillPlace: string | null; tillLastAttempt: string | null
  stage: string                                // [GUESS] to say "not a counted store" when no comparison
  driftBatches: number | null; driftRanAt: string | null   // null = no comparison (not counted)
}
```
`[GUESS]` field names = the summary row's. (The web could even derive this from the header row; still read the route.)

### `GET StockConsole/Stores/{store}/Stage` → `StockConsoleStoreStage` — [942]

```ts
export interface StockConsoleStageMove {     // mirrors SV064/BO StoreStageMove (+ whoName, owner ruling 2026-11-15)
  store: string; from: string; to: string; mover: string; who: string; whoName?: string | null; why: string; movedAt: string
}
export interface StockConsoleSeedRun {       // mirrors BO StoreSeedStatus subset (src/core/models/store-stage.ts)
  state: string; kind: string; reason: string; askedAt: string | null; endedAt: string | null; batchRows: number
}
export interface StockConsoleGate { gate: string; holds: boolean; figure: string }   // SV StoreGateModel
export interface StockConsoleGates {          // SV StoreGatesModel (SIS.Stock …/Models/StoreGatesModels.cs)
  from: string; to: string; hold: boolean
  measured: StockConsoleGate[]; confirmed: string[]; notConfirmed: string[]
}
export interface StockConsoleStoreStage {     // [BO4160]
  store: string; stage: string; updatedAt: string | null
  moves: StockConsoleStageMove[]              // newest first
  lastSeed: StockConsoleSeedRun | null
  gates: StockConsoleGates | null             // null when the read did not answer [GUESS]
}
```
Declared fresh in `stock-console.ts` (do NOT import the store-stage types: shapes may drift, and `whoName` is absent there).
Read-only: no move control.

### `GET StockConsole/Fleet` → `StockConsoleFleet` — [942]

Each fact `null` = **no answer** (route missing on an older SV, or unreachable) `[BO4160 "a missing route is no answer
for that fact only"]` — drawn as "no answer", never as healthy (stock-health's `noAnswer` precedent).

```ts
export interface StockConsoleFeedPass { feed: string; lastCompletePassAt: string | null; ageSeconds: number | null } // SV FeedAgeModel
export interface StockConsoleReservedRun {    // SV ReservedRunState subset
  lastStartedAt: string | null; lastSuccessAt: string | null; lastFailureAt: string | null
  consecutiveFailures: number; lastError: string | null; lastNetting: string | null
}
export interface StockConsoleHeldServed {     // SV HeldServingModel
  served: boolean; changedAt: string | null; netting: string; subtractsHeld: boolean; fellBackAt: string | null
}
export interface StockConsoleLedgerReader {   // SV HoldLedgerStatusModel subset
  lastPassAt: string | null; lagSeconds: number | null; readThroughAt: string | null
}
export interface StockConsoleTakesToday { day: string; takes: number; failed: number; skipped: number | null } // BO TakeDoorToday [GUESS +day]
export interface StockConsoleFleet {
  readAt: string
  feeds: StockConsoleFeedPass[] | null
  reservedRun: StockConsoleReservedRun | null
  heldServed: StockConsoleHeldServed | null
  ledgerReader: StockConsoleLedgerReader | null
  takesToday: StockConsoleTakesToday | null
  problems: StockConsoleFleetProblem[]   // review fix C4: the server's judged fleet facts (same list as Stores.fleet) [GUESS]
}
```
**All field names [GUESS]**, from the SV models the facts come from. Normalise every absent key to `null` (no answer);
a figure left out of an answered fact (`ageSeconds`, `lagSeconds`, `lastCompletePassAt`, …) to `null` too — never 0
("just now"). `problems` absent → `[]`.

**Judging a card (review fix C4, `fleet.ts` `factView`).** "Stale" is the server's: 15 minutes outside the recompute's
quiet window, a SIS.Api setting `[spec L288-289]`, so the web does not re-time facts. A card is `problem` when `problems`
names one of its facts (feeds ← `FeedLate`; reservedRun ← `ReservedNeverRun`/`ReservedStale`; heldServed ←
`HeldServedFellBack`; ledgerReader ← `ReaderBehind`; takesToday ← `TakesFailing`) or plainly from its own figures (a feed
never passed; the recompute never succeeded or failing; the reader never passed; the held-served switch `fellBackAt` set,
or `served && !subtractsHeld`). A fact with no answer stays `noAnswer` whatever `problems` says.

### The fleet line (in `StockConsoleStores.fleet`) — [942]

```ts
/** A fleet fact that is a problem now [BO4160]: a late feed, the recompute never run or stale, the reader behind. */
export interface StockConsoleFleetProblem {
  fact: string            // [GUESS] 'FeedLate' | 'ReservedNeverRun' | 'ReservedStale' | 'HeldServedFellBack' | 'ReaderBehind' | 'TakesFailing'
  subject: string | null  // e.g. the feed name ('Sap'/'Pos') [GUESS]
  value: number | null    // measured (minutes/seconds/count) [GUESS]
  limit: number | null
  since: string | null    // time the fact refers to
}
```
Web: one line above the stores list listing `t('fleetLine.<fact>', {…})` joined, linking to `/stock/console/fleet`;
unknown fact → generic sentence. **[GUESS whole shape]**.

### `GET StockConsole/Stores/{store}/Items/{item}` → `StockConsoleItem` — [943]

```ts
export interface StockConsoleAnsweredNow {
  quantity: number                         // NOT floored [SV078]
  rule: string                             // 'HeldServed' | 'LiveOrders' [SV078]
  liveOrders: number | null                // open orders subtracted, only under LiveOrders [SV078]
}
// [BO4161] "the item's figures with its names, and the sums ready to be written out, each as its operands and its result",
// in its order 1–4. Every sum name [GUESS].
export interface StockConsoleTillSideSum { sapStock: number; gap: number; result: number }   // sum 1: SAP − sold not in SAP = till-side
export interface StockConsoleFreeSum {                                                        // sum 2: till − held − reserved = free (never floored)
  tillStock: number; held: number; heldStanding: number; heldSold: number
  reserved: number | null; reservedState: string; reservedAt: string | null                   // SV reservedComputedAt → reservedAt [GUESS rename]
  reservedIncluded: boolean
  result: number                                                                              // free
}
export interface StockConsoleChangeFeedSum { tillStock: number; held: number; reserved: number | null; result: number } // sum 4: MAX(0, …)
export interface StockConsoleItemSums {
  tillSide: StockConsoleTillSideSum
  free: StockConsoleFreeSum
  answeredNow: StockConsoleAnsweredNow | null                                                 // sum 3; null = not carried → "No answer"
  changeFeed: StockConsoleChangeFeedSum
}
export interface StockConsoleItem extends StockConsoleOtherStock {
  plant: string; item: string; nameEn: string; nameAr: string    // [SV078; names BO4161]
  heldOnNoBatch: number                                           // [SV078] holds on blank/unknown batch
  lastUpdate: string | null
  sums: StockConsoleItemSums                                      // [BO4161]
}
```
**Decision (review fix C5, supersedes the 943 guess):** the item carries BO 4161's `sums`, each its operands and its
result; the web writes the lines from them in the ticket's order (sums 1–2 as the table, then 3 and 4) and redoes no
arithmetic (`item-sum.ts` `sumLines`, `answeredNowView`, `changeFeedView` floored for drawing). Reserved keeps its three
states from sum 2's `reserved`/`reservedState`/`reservedIncluded`. **Read tolerance, one place (`item-sum.ts`
`toItem`):** an answer with SV 078's operands flat (`sapStock`, `tillStock`, `gap`, `heldStanding`, `heldSold`, `held`,
`reserved`, `reservedState`, `reservedAt`, `reservedIncluded`, `free`, `answeredNow`, `changeFeed`) reads into the same
sums. An operand or result left out (or not a finite number) is derived by the store list's rules — gap = SAP − till,
held = standing + sold, free = till − held − reserved (reserved left out and "not included" when never computed), change
feed = that floored at 0 — never NaN. `NoRow` → item not at this store.

### Item tabs — [943]

| Route | Answer | Notes |
|---|---|---|
| `…/Items/{item}/Batches` | `StockConsolePage<StockConsoleBatchRow>` | "the store's Batches read for that item" `[BO4161]`; web asks `page=1&size=200` `[GUESS]`, shows "showing N of total" if more |
| `…/Items/{item}/Holds` | `StockConsolePage<StockConsoleHoldRow>` | open + released in last 7 days, one list `[BO4161]` |
| `…/Items/{item}/Takes` | `StockConsoleTakes` | today + 2 days before `[BO4161]`; no failed rows (item set) → `failedLeftOut` true |
| `GET StockConsole/Items/{item}/Stores?page=&size=` | `StockConsolePage<StockConsoleItemStoreRow>` | the item at every store, paged 25 `[BO4161, SV078]` |

```ts
export interface StockConsoleItemStoreRow {          // [SV078]
  plant: string; city: string; stage: string
  sapStock: number; tillStock: number; heldStanding: number; heldSold: number
  reserved: number | null; lastUpdate: string | null
  // [GUESS optional] SIS.Api may add gap/held/free/reservedState as on the store list — read with `?? derived`
  gap?: number; held?: number; free?: number; reservedState?: string; reservedIncluded?: boolean
}
```
`[GUESS]` the item tabs return the page shape (not a bare array). `api.ts` tolerates a bare array too:
`Array.isArray(d) ? { rows: d, total: d.length, page: 1, size: d.length } : …`.

### `GET StockConsole/Find?item=&batch=&page=&size=` → `StockConsoleFind` — [943]

```ts
export interface StockConsoleFindBatchRow {        // [SV078] one row per store, item and batch
  plant: string; city: string
  item: string; nameEn: string; nameAr: string
  batch: string; vendorBatch: string | null; expiry: string | null
  sapStock: number; tillStock: number; held: number
}
export interface StockConsoleFindItemRow {          // [BO4161] items from HQ's item master
  item: string; nameEn: string; nameAr: string
}
export type StockConsoleFind =
  | ({ kind: 'Batch'; stores: number | null } & StockConsolePage<StockConsoleFindBatchRow>)   // stores = distinct stores [SV078]; null = not sent (review fix C3: never counted from one page)
  | ({ kind: 'Item' } & StockConsolePage<StockConsoleFindItemRow>)
```
`kind` is **[GUESS]**. The web picks the answer by **what it sent** (`batch` box filled → batch answer) — `find.ts`'s
pure decision, ticket 943 proof — and uses `kind` only as a cross-check. Both boxes empty: the web asks nothing
(`NothingToFind` is the server's backstop). A prefix without item: let the server refuse (`PrefixNeedsItem`) or
pre-check in `find.ts` (optional).

### `GET StockConsole/Scan?code=` → `StockConsoleScan` — [944] (shape given verbatim in BO4162)

```ts
export type ScanKind = 'Gs1' | 'Barcode' | 'Unknown'
export interface StockConsoleScan {
  kind: string                    // ScanKind
  itemFound: boolean
  item: string | null; nameEn: string | null; nameAr: string | null
  gtin: string | null
  lot: string | null              // AI 10: the vendor batch to search
  expiry: string | null           // AI 17 as a day, or the month's first day when the day is 00
  expiryDayKnown: boolean         // false when the code's day is 00 → compare by month
  serial: string | null           // AI 21
}
```
Behaviour (web, `scan.ts`): `Gs1` + itemFound → item box = item, batch box = lot · `Gs1` + !itemFound → "item not
found" line, search lot alone as vendor batch (item box empty) · `Barcode` → item only, no batch · `Unknown` → "not a
code we know", search nothing.

### `GET StockConsole/Stores/{store}/SapMovements?from=&to=` → `StockConsoleSapMovements` — [945]

```ts
export interface StockConsoleSapDay {           // [SV080]
  day: string; movementType: string; documents: number; lines: number; quantityIn: number; quantityOut: number
}
export interface StockConsoleSapMovements {     // [SV080]
  readAt: string
  place: { sapPlace: string | null; lastAttempt: string | null }
  days: StockConsoleSapDay[]
}
```
`from`/`to` = SAP entry days, ≤ 5 days both included (`SAP_MOVEMENT_DAYS = 5`), default the last 2 days
(`from = addDays(today,-1), to = today`). `SapNotConfigured` / `SapUnreachable` → their own sentences.

### `GET StockConsole/Stores/{store}/SapMovements/Lines?day=&type=&page=&size=` → `StockConsolePage<StockConsoleSapLine>` — [945]

```ts
export const SAP_LINE_MARKS = ['Applied', 'ReceivedNotApplied', 'NotReceived'] as const   // [SV080]
export interface StockConsoleSapLine {          // [SV080; names BO4163]
  materialDocument: string; year: string | number; line: string | number   // [GUESS types] — draw as text
  item: string; nameEn: string; nameAr: string
  batch: string | null; quantity: number; unit: string | null
  postingDay: string | null; entryTime: string | null
  mark: string                                  // SapLineMark
}
```

### `GET StockConsole/Stores/{store}/Items/{item}/Movements?from=&to=&page=&size=` → `StockConsolePage<StockConsoleLedgerLine>` — [945]

```ts
export interface StockConsoleLedgerLine {       // [SV079] — every name [GUESS] from its prose
  id: string                                    // the ledger id (ULID)
  at: string                                    // the time in the id, local
  feed: string                                  // 'Sap' | 'Pos' (Pos = till) [SV079]
  movementType: string
  quantity: number                              // signed
  batch: string | null
  storageLocation: string | null
  /** SAP's material document, year and line — or null on a till line. */
  materialDocument: string | null; materialYear: string | number | null; materialLine: string | number | null
  /** The till's store, transaction and line — or null on a SAP line. */
  tillStore: string | null; tillTrx: string | null; tillLine: string | number | null
  postingDay: string | null
  applied: boolean | null                       // review fix A4: absent → null (not known); only false is badged "not applied"
  onSap: number                                 // effect on the SAP counter [SV079]
  onTill: number                                // effect on the till-side counter [SV079]
}
```
Window: local days, ≤ 7 both included (`ITEM_MOVEMENT_DAYS = 7`), default last 7 days (`from = addDays(today,-6)`).
Newest first. Effect cells: SAP sale → onSap only; till sale → onTill only; receipt → both `[SV079]` (the web just draws
the numbers the server sends; 0 → "—" or "0", pick one and test it).

---

## `api.ts` — functions per ticket

File `src/features/stock/stock-console/api.ts`. All through `api.get<T>(path, params)`; paths bare, no leading slash;
`encodeURIComponent` every path segment (`store`, `item`) as `store-stages/api.ts` does. Query params pass through
`buildQuery` (empty strings / null dropped — don't pre-filter). Normalise absent arrays/fields (stock-health /
held-stock-report pattern: `const d = await api.get<Partial<X> | null>(…); return { …defaults, … }`).

```ts
export const STOCK_CONSOLE_KEY = ['stock', 'stock-console'] as const   // every query key starts here
export const storeKey = (store: string) => [...STOCK_CONSOLE_KEY, 'store', store] as const
export const storeTabKey = (store: string, tab: StoreTab) => [...storeKey(store), tab] as const   // Refresh invalidates this
export const itemKey = (store: string, item: string) => [...storeKey(store), 'item', item] as const

export const stockConsoleApi = {
  // 940
  stores(): Promise<StockConsoleStores>                                   // GET StockConsole/Stores
  // 941
  store(store: string): Promise<StockConsoleStoreRow>                     // GET StockConsole/Stores/{store}
  items(store: string, q: { item?: string; batch?: string; filter?: string; sort?: string; page: number; size: number }): Promise<StockConsolePage<StockConsoleItemRow>>
                                                                          // GET StockConsole/Stores/{store}/Items
  batches(store: string, q: { item?: string; batch?: string; filter?: string; page: number; size: number }): Promise<StockConsolePage<StockConsoleBatchRow>>
                                                                          // GET StockConsole/Stores/{store}/Batches
  // 942
  holds(store, q: { item?; batch?; state?; page; size }): Promise<StockConsolePage<StockConsoleHoldRow>>     // …/Holds
  takes(store, q: { item?; batch?; day: string; outcome?; page; size }): Promise<StockConsoleTakes>          // …/Takes
  feeds(store): Promise<StockConsoleStoreFeeds>                                                              // …/Feeds
  stage(store): Promise<StockConsoleStoreStage>                                                              // …/Stage
  fleet(): Promise<StockConsoleFleet>                                     // GET StockConsole/Fleet
  // 943
  item(store, item): Promise<StockConsoleItem>                            // GET StockConsole/Stores/{store}/Items/{item}
  itemBatches(store, item, q: { page; size }): Promise<StockConsolePage<StockConsoleBatchRow>>   // …/Items/{item}/Batches
  itemHolds(store, item, q): Promise<StockConsolePage<StockConsoleHoldRow>>                     // …/Items/{item}/Holds
  itemTakes(store, item, q): Promise<StockConsoleTakes>                                         // …/Items/{item}/Takes
  itemStores(item, q: { page; size }): Promise<StockConsolePage<StockConsoleItemStoreRow>>      // GET StockConsole/Items/{item}/Stores
  find(q: { item?; batch?; page; size }): Promise<StockConsoleFind>                             // GET StockConsole/Find
  // 944
  scan(code: string): Promise<StockConsoleScan>                           // GET StockConsole/Scan?code=
  // 945
  sapMovements(store, q: { from: string; to: string }): Promise<StockConsoleSapMovements>        // …/SapMovements
  sapLines(store, q: { day: string; type: string; page; size }): Promise<StockConsolePage<StockConsoleSapLine>> // …/SapMovements/Lines
  itemMovements(store, item, q: { from; to; page; size }): Promise<StockConsolePage<StockConsoleLedgerLine>>    // …/Items/{item}/Movements
}
```

**Do NOT call `StockConsole/Access`.** The spec lists it, but oms 914 replaced every `*/Access` probe with the one
`Auth/Permissions` answer, and `src/app/no-access-probes.test.ts` fails the build on any `…/Access` literal. Gate with
`canOpenStockConsole = (p) => p.has('StockConsole:03')` (key added to `SCREEN_KEYS` in `src/core/permissions.ts`).

### Query options (suggested, in `api.ts`)

| Query | key | read when |
|---|---|---|
| stores | `[...KEY,'stores']` | page open; Refresh = `refetch()`; `staleTime` ~30 s (server copy is 60 s) |
| store header | `[...storeKey(s),'header']` | store page open; retry not on `NoStore` |
| list tab | `[...storeTabKey(s,tab), wireParams]` | `enabled: search.ran` — **never** before Search |
| feeds / stage | `storeTabKey(s,'feeds'|'stage')` | tab open (enabled when mounted) |
| fleet | `[...KEY,'fleet']` | Feeds and switches open |
| item | `[...itemKey(s,i),'header']`; tabs `[...itemKey(s,i), tab, params]` | item page / tab open |
| itemStores | `[...KEY,'item-stores', item, page]` | tab open |
| find | `[...KEY,'find', params]` | `enabled: ran && (item||batch)` |
| scan | `[...KEY,'scan', code]` | `enabled: ran && gs1 !== ''`; list query waits on it |
| sap | `[...storeTabKey(s,'sap'), from, to]` | `enabled: ran` (Read SAP) |
| sap lines | `[...storeTabKey(s,'sap'),'lines', day, type, page]` | a summary row opened |
| item movements | `[...itemKey(s,i),'movements', from, to, page]` | `enabled: ran` (Read) |

Use `placeholderData: keepPreviousData` on paged lists (FleetPage precedent) and `isPlaceholderData` to make the pager
busy; draw **no rows** when `isError` (sync console's 🚩: kept rows under a failed filter lie).

## Which ticket introduces which types (append order in `stock-console.ts`)

| Ticket | Adds |
|---|---|
| 940 | header comment, `ReservedState`, `StoreStatus`, `FlagLevel`, `STOCK_CONSOLE_FLAGS`, `StockConsoleFlag`, `StockConsoleStoreRow`, `StockConsoleStores` (with `fleet: StockConsoleFleetProblem[]` — declare `StockConsoleFleetProblem` here too so 940's type compiles; 942 fills its use), `StockConsolePage<T>` |
| 941 | `StockConsoleOtherStock`, `ITEM_FILTERS`, `ITEM_SORTS`, `StockConsoleItemRow`, `BATCH_FILTERS`, `StockConsoleBatchRow` |
| 942 | `HOLD_STATES`, `StockConsoleHoldRow`, `TAKE_OUTCOMES`, take row union + `StockConsoleTakes`, `StockConsoleStoreFeeds`, stage types, fleet types |
| 943 | `StockConsoleAnsweredNow`, `StockConsoleItem`, `StockConsoleItemStoreRow`, find types |
| 944 | `ScanKind`, `StockConsoleScan` |
| 945 | `StockConsoleSapDay`, `StockConsoleSapMovements`, `SAP_LINE_MARKS`, `StockConsoleSapLine`, `StockConsoleLedgerLine` |

942 ∥ 944 both append to `stock-console.ts`, `api.ts`, the two locale files and `i18n-keys.test.ts`: keep each ticket's
additions in its own contiguous block at the END (types, api methods, top-level JSON keys) so the merge is
append/append.

## Guesses to confirm with the server (summary)

1. `plant` kept (not renamed `store`) on every row. 2. Page shape `{ total, page, size, rows }`. 3. Flag codes
(PascalCase), units, `limit: null` for "any". 4. `reservedAt` name (time beside reserved). 5. Unreachable/timeout error
codes. 6. Whole Fleet + fleet-line shapes. 7. Take row field names (`at`, `namedBatch`, `batches[]`). 8. Ledger line
document fields. 9. Find `kind` discriminator. 10. Item tabs answer a page, not an array. 11. Hold `state` values
`Held/Sold/Released`. 12. Item sums as flat figures (web builds lines).

## 940 as built (oms worktree-agent-a24e448717bd14221, commits 42d6d00c + 968af5f4) — reuse, don't redeclare

Contract unchanged (the 940 types above are in `src/core/models/stock-console.ts` under `// ── 940 ──`). Exports later
tickets build on:
- `api.ts`: `STOCK_CONSOLE_KEY`, `stockConsoleApi.stores()`, `storesQuery()`, `retryUnlessAnswered(n, err)` (use it as
  every console query's `retry`). Append methods under a `// ── 94x ──` divider.
- `columns.ts`: `CONSOLE_COL_DEF` (spreads the grid base), `MONO`, `formatQuantity`, `formatTime`.
- `figures.ts`: `reservedView(row)`, `freeLabel(row)` (take any `{ reserved, reservedState, reservedIncluded, reservedAt? }`
  — item rows too), `statusPill(status)`, `flagLines(flags)`.
- `console-pages.ts`: `CONSOLE_PAGES: { to, key }[]` (NO `end` field) + `consolePageActive(page, pathname)`;
  `STOCK_CONSOLE_PATH`. 942/943 append `{ to: '/stock/console/fleet', key: 'fleet' }` / insert `find` before it, and add
  `nav.<key>` to both locales.
- `stores-columns.tsx`: `storeHref(plant)`. `StatusPill.tsx` (portalled popover) is reusable on the store header (941).
- `HowRead.tsx`: `<HowRead section="x" paragraphs={['p1','p2']} />` → keys `how.x.title`, `how.x.p1…`.
- `Loading.tsx`, `ConsoleNav.tsx`; `test-rows.ts` (test-only `storeRow()`, `flag()` builders).
- Locale key shapes: flag sentences are COUNTED by value: `flag.<Code>_one/_other` (ar: six forms), `flagName.<Code>`
  (no value), `flag.unknown`, `flag.limit` ("limit {{limit}}"), `flag.limitAny`; `stage.*`, `status.*`, `level.*`,
  `reserved.notComputed|stale|at`, `free.reservedNotIncluded`. Ar stage words copied from store-stages.
- Control baseline block `stock/stock-console 2` (StoreTiles tile + StatusPill trigger). Later tickets: core controls only.

## 941 as built (oms worktree-agent-a8a1dd88259ab35b2) — the search-first frame and the store page

Types: as specified above under `// ── 941 ──` in `stock-console.ts` (no change). Route `stock/console/store/:store` →
`StorePage.tsx`. No new hand-written control (baseline unchanged).

**The frame's pure state — `search.ts`** (tested in `search.test.ts`):
- `STOCK_CONSOLE_PAGE_SIZE = 25`.
- `ListSpec { filters: readonly string[]; sorts?: readonly string[]; extras?: readonly string[]; keep?: readonly string[] }`
  — first filter/sort = default (left out of the URL); no `sorts` = the list sends no sort; `extras` = the list's own
  string params (942 Takes: `extras: ['day']`); `keep` = page params carried untouched and kept by Clear (store page:
  `['tab']`; 943 Find: `['stores', 'storesPage']`). **Declare each spec as a module-level const.**
- `SearchBoxes { item, batch, gs1 }`, `emptyBoxes()`.
- `SearchState extends SearchBoxes { filter; sort ('' if no sorts); page; ran; extras: Record<string,string>; kept: Record<string,string> }`.
- `searchFromParams(params, spec)` / `searchToParams(state, spec)` — URL order: kept, `item`, `batch`, `gs1`, `filter`,
  `sort`, extras, `page` (>1), `ran=1`. Unknown filter/sort → default; bad page → 1; boxes trimmed.
- `listUrl(spec) → { fromParams, toParams }` (cached per spec object; feed it to `useUrlQuery`).
- `submitSearch(state, boxes, extras?)` → trimmed boxes, extras set ('' deletes), `page: 1`, `ran: true`.
- `choose(state, { filter?, sort? }, spec)` → page 1 (ignored if not in the spec). Filter/sort are NOT drafts.
- `goToPage(state, n)`, `clearSearch(state, spec)` (only `kept` survives), `shouldRead(state) = state.ran`,
  `sameSearch(shown, next, spec)` (same URL → the frame refetches instead: "busy, try again" retries).
- `frameView(state, { isPending, isError, data?: { total } }) → 'nothing' | 'loading' | 'refused' | 'empty' | 'rows'`
  (a refusal never shows kept rows).
- `wireParams(state) → WireSearch { item, batch, filter, sort?, ...extras, page, size: 25 }`. **gs1 is NOT sent**: 944
  scans first and passes `wireParams({ ...state, item: scan.item ?? '', batch: scan.lot ?? '' })` (or its own query
  over `listQuery`'s pattern). Defaults (`filter=all`, `sort=item`) ARE sent; empty boxes are dropped by `buildQuery`.

**The hook — `use-list-search.ts`**: `useListSearch(spec) → ListSearch { spec, state, boxes, setBox(box, v), extras,
setExtra(name, v), search(): boolean, clear(), choose(change), goToPage(n) }`. Boxes/extras are drafts; reset when the
URL changes from outside. `search()` returns false when it is the search already shown.

**The component — `SearchFrame.tsx`** props: `name` (data hook), `search: ListSearch`, `read: FrameQuery` (a
`useQuery` result: `isPending, isError, error, data?: { total }, isFetching, isPlaceholderData, refetch`),
`filterLabel(v)`, `sortLabel?(v)` (drawn only if the spec has sorts), `gs1?: boolean` (944: draws the GS1 box, `dir=ltr`
mono, value in `search.boxes.gs1`), `extraBoxes?: ReactNode` (942 Takes' day input, before Search), `aboveRows?:
ReactNode` (944 chips, shown once a search ran), `empty: string`, `children` (the grid, drawn only for `'rows'`). It
draws the boxes, filter, sort, Search/Clear (Enter in any box = Search), "Nothing is read yet", Loading, the refusal
(`RefusalBanner`), the empty sentence, the count (`search.count_*`) and `GridPager` when total > 25.
- `ListGrid.tsx`: `<ListGrid rows columns rowId name />` (autoHeight, `CONSOLE_COL_DEF`; `rowId` module-level).
- `RefusalBanner.tsx`: `<RefusalBanner error />` → `refusalOf(err)` sentence (+ server reason when it adds one).

**`refusals.ts`**: `refusalOf(err) → { code, key, reason }`; `REFUSAL_CODES`, `REFUSAL_KEYS`. Mapping: each code in the
table above → `refusal.<Code>`; `StockVisibilityUnreachable` + `StockVisibilityTimeout` + any codeless network/server
failure → `refusal.unreachable`; bare 403 → `refusal.denied`; unknown code → `refusal.failed` + server sentence as
`reason`; `SapUnreachable` carries the server sentence as `reason`. 945 can use it as is for SAP.

**`api.ts` (941 block)**: `stockConsoleApi.store/items/batches`; `toPage(d, asked)` (page normaliser — reuse it);
`storeKey(store)`, `storeTabKey(store, tab: StoreTab)`, `storeHeaderQuery(store)` (key `[...storeKey,'header']`, outside
every tab's key), `listQuery(store, tab, state, read)` (key `[...storeTabKey(store,tab), wireParams(state)]`, `enabled:
shouldRead`, `keepPreviousData`, `retryUnlessAnswered`), `itemsQuery`, `batchesQuery`. 942: `holdsQuery = (s, st) =>
listQuery(s, 'holds', st, stockConsoleApi.holds)`; Takes needs its own `queryOptions` (its answer extends the page).

**Other pieces**: `store-tabs.ts` (`STORE_TABS` = items, holds, batches, takes, sap, feeds, stage; `resolveStoreTab`,
`tabParams(tab)` = `tab` alone). `StoreTabs.tsx` mounts `ItemsTab`/`BatchesTab`; any other tab draws `tabs.notYet` —
942/945 replace that branch per tab and drop the key once all seven are built. `StoreHeader.tsx` (flag chips are
`<span>`s; 942 turns them into links). `figure-cells.tsx` (`ReservedCell`, `FreeCell` — moved out of `stores-columns`,
take any `ReservedFigures`). `items-columns.tsx`: `itemHref(store, item)` (943's page), `itemRowId`,
`buildItemsColumns(t, lang, store)`. `batches-columns.tsx`: `batchRowId`, `buildBatchesColumns(t, lang, store, today)`.
`batches.ts`: `expiryCell(expiry, today) → { day, mark: 'expired'|'within90'|'ok'|'none' }`, `batchMarks(row, today)`,
`EXPIRY_MARKS`, `EXPIRING_DAYS = 90` (944 adds its scan mark beside). `how-sections.ts`: `HOW_STORE/ITEMS/BATCHES`
(942+ append theirs). `StatusPill.tsx` now also exports `FlagSentence({ line })`.

**Locale (941)**: top-level `store`, `tabs`, `search` (incl. `search.gs1` for 944), `items`, `batches`, `refusal`;
plus `how.store|items|batches` INSIDE 940's `how` block (942 appending to `how` will touch the same closing lines —
resolve by keeping both). Column words for item/batch grids live under `items.column.*` / `batches.column.*`; the
figure columns reuse 940's `column.*`.

**Guesses made here** (no contract change): expired = expiry day < today; "within 90 days" = today … today+90
inclusive; the header is not re-read by a tab's Refresh; tabs stay usable when the header read is refused (not on
`NoStore`); defaults `filter=all`/`sort=item` are sent rather than omitted.

## 944 as built (oms worktree-agent-ae5a82f2398c1aa69, commit 9a2376fb) — the GS1 box

Types `ScanKind`, `StockConsoleScan` under `// ── 944 ──` (contract unchanged). **One deviation from the api table:**
the scan read is a standalone `readScan(code)` + `scanQuery(code)` in `api.ts`'s `// ── 944 ──` block, NOT
`stockConsoleApi.scan` (keeps 942's appends to the object conflict-free). Key `[...KEY,'scan',code]`, `enabled: code
!== ''`, staleTime 5 min, `retryUnlessAnswered`; absent `kind` → `'Unknown'`, absent `expiryDayKnown` → true.
- **`scan.ts`** (pure, `scan.test.ts`): `applyScan(scan) → { search, item, batch, note, chips }`; `scanExpiry(scan)` (day,
  or `yyyy-MM` when the day is 00); `expiryMark(rowExpiry, scan) → { mark: 'matches'|'differs'|'none', scan }`;
  `scanCode(state)` (= gs1 once `ran`); `scannedList(state, answer)` (gs1 empty → state; no answer / nothing to search →
  `ran:false`; else item+lot replace the boxes); `scanFrameRead(state, scanRead, listRead)` (scan pending → loading,
  refused → refusal with the scan's `refetch`, nothing to search → `stopped`). `SCAN_CHIPS`, `SCAN_NOTES`, `SCAN_MARKS`.
- **Adopting it in a list (942 Holds/Takes, 943 Find)** — three lines:
  `const scan = useScan(search)` (`use-scan.tsx`) → query with `scan.state` instead of `search.state` →
  `<SearchFrame … {...scan.frame(read)}>` (supplies `gs1`, `read`, `aboveRows` = `ScanChips`, `stopped`; drop the
  explicit `read=`). `scan.answer` is the answer for the address's code (Batches passes it to
  `buildBatchesColumns(t, lang, store, today, scan.answer)`, which inserts the "Against the scan" column after Expiry
  only when the scan has an expiry). Wired here: Items and Batches.
- **Frame change (additive):** `SearchFrame` prop `stopped?: boolean` — a search ran but nothing is read; draws
  `aboveRows` only (`data-search-view="stopped"`).
- **Locale:** top-level `gs1` block (`read`, `chip.*`, `note.*`, `column.mark`, `mark.matches`, `mark.differs` with
  `<d>{{expiry}}</d>`); the box placeholder stays 941's `search.gs1`. No `how.*` panel added (942 owns `how`).
- **Guesses:** unknown GTIN with no lot → nothing searched, its own line `gs1.note.itemNotFoundNoLot`; a `Barcode`
  answer with no item, or any kind not `Gs1`/`Barcode`, is "not a code we know"; a barcode never sends a batch even if
  the answer carries a lot; the boxes are filled from the scan as drafts (the address keeps what was searched + `gs1`),
  a code we do not know leaves them as typed.

## 942 as built (oms worktree-agent-a1e258b02dd28ae21, commits ab24c685 + merge bd0f0eb7 + 4f5f8378)

Types as specified above under `// ── 942 ──` (contract unchanged). Route `stock/console/fleet` → `FleetPage.tsx`;
`CONSOLE_PAGES` gains `{ to: FLEET_PATH, key: 'fleet' }` (`FLEET_PATH` exported from `console-pages.ts`; 943 inserts
`find` before it). No new hand-written control (baseline unchanged).
- **`api.ts` (942 block):** a separate `stockConsoleApi942` object (`holds`, `takes`, `feeds`, `stage`, `fleet`), NOT
  methods on `stockConsoleApi` (append-only merges; its type imports sit inside the block). The frame's `filter` goes
  out as `state` (Holds) / `outcome` (Takes) — renamed in `api.ts` only; the URL keeps `filter`. `holdsQuery(s, st)` =
  `listQuery`; `takesQuery(s, st, today)` own `queryOptions`, key `[...storeTabKey(s,'takes'), wire]` with `day` always
  sent (`takesDay(state, today)`: the address's day, else today). `feedsQuery`/`stageQuery` key = `storeTabKey(s, tab)`
  (Refresh re-reads); `fleetQuery` key `[...KEY,'fleet']`. Normalisers: Fleet's absent facts → null; Stage's moves/gates
  lists → []; granted take's `batches` → []; `failedLeftOut` → false.
- **Pure modules (tested):** `flags.ts` `flagLink(code)`/`flagHref(store, code)` (BelowZero → items/belowZero,
  OldHold → holds/standing, SalesNotApplied → holds/sold, PlaceholderStock → batches/placeholder, ComparisonDiffers and
  SapQuiet [guess] → feeds with no filter/ran; unknown → null = plain chip). `age.ts` `ageView(seconds)` →
  `age.justNow|minutes|hours|days` + values, `localMs(time)`. `holds.ts` `holdAge(row, now)` (released: to
  `releasedAt` [choice]), `holdStateCell` (Held go / Sold warn / Released mute / unknown raw warn), `holdDocument`
  (`formatPair`), `HOLD_COLUMNS`/`holdColumns(filter)` (released adds `releasedAt`, `releaseReason`). `takes.ts`
  `takeCells(row)`, `failedNotSearchable(state, data)` (ran + item/batch, or server `failedLeftOut`; never on the
  granted/refused filter [choice]), `takesDay`. `fleet.ts` `FLEET_FACTS`, `factView(fleet, fact)` → `noAnswer` (null,
  missing key, or empty feeds list) | `problem` (feed never passed, recompute never succeeded / failures > 0, reader
  never passed) | `answered`; `feedLabel`, `fleetLine(problems)`. `feeds.ts` `comparisonView` (notCounted | notYet |
  differs | matches).
- **UI:** `HoldsTab`/`holds-columns.tsx`, `TakesTab`/`takes-columns.tsx` (day `Input type="date"` via `extraBoxes`;
  the failed line joins 944's chips in `aboveRows`), both on 944's `useScan`. `FeedsTab`, `StageTab` (read-only; move
  log on `ListGrid`). `FleetPage` (five cards; no answer = red "No answer" badge + sentence). `FleetLine` above the
  stores list (attention band, hidden when `fleet` is empty). `StoreHeader` flag chips are `<Link>`s (`data-flag-link`).
  `StoreTabs` mounts all but `sap` (`tabs.notYet` stays for 945).
- **Locale:** `nav.fleet`; `how.holds|takes|feeds|stage|fleet` inside `how`; top-level `age`, `holds`, `takes`, `feeds`,
  `stageTab` (NOT `stage` — 940's `stage.*` are the stage names), `fleet`, `fleetLine`, `flagLink`. Ages are words
  around numbers → `<bdi>`, not `Ltr`.
- **Not done:** the ticket's "on dev, click items below zero" check (no server).

## 943 as built (oms worktree-agent-ab95e2daf9517b53c, commit 792aeeb7)

Types under `// ── 943 ──` as specified, with **one read tolerance**: `StockConsoleItem.answeredNow` is
`StockConsoleAnsweredNow | null` (absent → null → drawn "No answer", never 0). Routes `stock/console/store/:store/item/:item`
→ `ItemPage.tsx`, `stock/console/find` → `FindPage.tsx`; `CONSOLE_PAGES` = stores, find, fleet (`FIND_PATH`). No new
hand-written control (baseline unchanged).
- **Moved:** `storeHref` / `itemHref` now live in `console-pages.ts` (pure modules link with them);
  `stores-columns.tsx` / `items-columns.tsx` re-export them, so old imports still work.
- **`api.ts` (943 block):** separate `stockConsoleApi943` (`item`, `itemBatches`, `itemHolds`, `itemTakes`, `itemStores`,
  `find(sent, wire)`). Item tabs ask `page=1&size=200` (`ITEM_TAB_SIZE`), accept a page or a bare array, and say
  "showing N of total" when cut; item takes' absent `failedLeftOut` → true. Keys: `itemKey(s,i)`, header
  `[...itemKey,'header']`, `itemTabKey(s,i,tab)` = `[...itemKey, tab]` except `stores` = `[...KEY,'item-stores',item]`
  (shared with Find; Refresh invalidates that prefix); `itemStoresQuery(item, page)`; `findQuery(state)` (enabled only
  for `batch`/`item`).
- **Pure modules (tested):** `item-sum.ts` `sumLines` (six lines: start/less/equals; held carries parts + `onNoBatch`;
  reserved carries `reservedView`; free carries `freeLabel`), `answeredNowView` (rule key or raw; `liveOrders` only under
  `LiveOrders`), `changeFeedView` (floored), `otherStock` (non-zero, `OTHER_STOCK` order). `find.ts` `FIND_LIST`
  (`filters: []`, keep `stores`/`storesPage`), `findDecision` → nothing|fill|batch|item, `findWire` (no filter/sort),
  `findAnswer(sent, d)` (kind = what was sent; missing `stores` counted from the page), `answerShown` (a kept answer of
  the other kind is not drawn), `findRowHref`, `itemStoresOpen/Page/Params`. `item-stores.ts` `itemStoreHref`,
  `itemStoreFigures` (gap/held/free/reservedState derived when absent). `item-tabs.ts` `ITEM_TABS`, `resolveItemTab`,
  `itemTabParams`, `withoutItemColumns`.
- **945 hook:** append `'movements'` to `ITEM_TABS`, add `itemTabs.movements` (+ `itemTabs.empty.movements` if used) to
  both locales, and one entry in `ItemTabs.tsx`'s `PANELS` record (the type demands it). `itemTabKey(s,i,'movements')`
  already yields `[...itemKey,'movements']` — key the movements query under it so Refresh works.
- **Frame changes (additive):** `SearchFrame` draws no filter box when `spec.filters` is empty (`filterLabel` now
  optional) and takes `count?: ReactNode` (Find: "N rows at M stores"). Find's "fill a box" line rides `stopped` +
  `aboveRows`. `batches-columns.tsx` exports `ExpiryCell` and a generic `scanMarkColumn<T>` (Find's batch rows use both).
- **UI:** `ItemSum` (table of lines + "two other rules" card + other stock + `HowRead section="item"`), `ItemTabs`
  (Chip strip, `?tab=`, Other stores page in `?page=`), `ItemListTabs.tsx` (Batches/Holds/Takes on 941/942 builders
  minus item/name; Holds uses the `released` column set), `ItemTabList`, `ItemStoresList` (+ `item-stores-columns.tsx`),
  `find-columns.tsx`. `NoRow` → "no such item at this store" card with a Find link.
- **Locale:** `nav.find`; inside `how`: `item` (one paragraph per sum line + answeredNow, changeFeed, otherStock),
  `itemBatches|itemHolds|itemTakes|itemStores` (p1), `find` (p1–p3); top-level `item`, `sum`, `itemTabs`, `find`
  (`find.rows_*`, `find.atStores_*`, `sum.onNoBatch_*` counted; ar six forms).
- **Guesses:** the item's tabs ask 200 rows; the back link opens the store's Items tab; Find's opened item stays open
  across a new Search and Clear (it is a `keep` param) until closed; the Other stores view on Find shows no item name
  (the stores answer carries none).
- **Not done:** the "on dev" check (no server).

## 945 as built (oms worktree-agent-aa9c0660eeab83ed3, commit a594a5ab)

Types under `// ── 945 ──` as specified (`StockConsoleSapDay`, `StockConsoleSapMovements`, `SAP_LINE_MARKS` +
`SapLineMark`, `StockConsoleSapLine`, `StockConsoleLedgerLine`). No new hand-written control (baseline unchanged).
- **Read tolerance (reconcile in one place):** SIS.Stock 079 was built with `time` (not `at`), nested
  `sapDocument { materialDocument, year, item }` / `tillDocument { store, transaction, line }`, and a page whose rows
  are `lines`. `movements.ts` `toLedgerLine` reads both the contract's flat names and these; `api.ts` `pageOf` takes
  `rows ?? lines`. SV 079's `complementaryOnSap/OnTill` are NOT drawn (the contract has no such field). SV 079/080 also
  name `WindowRequired` / `WindowBackwards` refusals: the web never sends them (it stops the window first), so they fall to
  `refusal.failed` + the server sentence.
- **`api.ts` (945 block):** separate `stockConsoleApi945` (`sapMovements`, `sapLines`, `itemMovements`).
  `sapMovementsQuery(store, decision)` key `[...storeTabKey(s,'sap'), from, to]`; `sapLinesQuery(store, decision, state)`
  key `[...storeTabKey(s,'sap'),'lines', day, type, page]`; `itemMovementsQuery(store, item, decision, page)` key
  `[...itemTabKey(s,i,'movements'), from, to, page]`. Each `enabled: decision.kind === 'read'` (Refresh re-reads only
  once read). Paged lists keep the last page only within the same window/row (a new window shows its loading line).
- **Pure module `movements.ts` (tested, `movements.test.ts`):** `SAP_WINDOW` (max 5, default 2) / `LEDGER_WINDOW`
  (max 7, default 7); `MovementsState { from, to, ran, page, sapDay, sapType }` ('' = default day); `windowOf`,
  `windowRead(state, spec, today)` → nothing | stopped(problem) | read(from, to); `pressRead` (writes the boxes' window
  as asked, page 1, closes an opened row — an over-long window is written too, and `windowRead` stops it, so a pasted
  link is stopped the same way); `openLines`/`closeLines`/`goToMovementsPage`; `SAP_URL` / `LEDGER_URL` (address:
  `tab, from, to, ran=1`, SAP `sapDay, sapType, sapPage`, ledger `page`); `movementsView(decision, read)` (a refusal
  outranks a kept answer); `windowProblemKey` (`window.invalid|reversed|tooLong`); `markCell` (Applied ok /
  ReceivedNotApplied warn / NotReceived bad / unknown raw warn); `ledgerEffects` (0 → none, drawn
  `movements.noEffect` "—"; else signed `+1,200` / `-3`); `feedCell` (Sap/Pos, unknown raw); `ledgerDocument`
  (`formatParts` doc · year · line, or store · trx · line); column lists `SAP_DAY_COLUMNS`, `SAP_LINE_COLUMNS`,
  `LEDGER_COLUMNS`.
- **UI:** `use-movements.ts` (`useMovements(url, spec)`: drafts + `press()`), `WindowBar.tsx` (two labelled date
  `Input`s, Read button, the window read as one `formatRange` in `Ltr`, the stopped sentence), `SapTab.tsx` (place +
  last attempt + read-at above the summary; movement type cell is a `<Link>` that opens the row; `SapLines` section with
  Close `Button`), `MovementsTab.tsx`, `PagedList.tsx` (count + `ListGrid` + `GridPager`), `sap-columns.tsx`,
  `movements-columns.tsx` (a line not applied gets a "not applied" badge beside its document). `StoreTabs` mounts
  `SapTab`; `ITEM_TABS` gains `movements`, `PANELS.movements`.
- **Locale:** top-level `sap`, `movements`, `window`; `how.sap|movements` (p1–p3); `itemTabs.movements`,
  `itemTabs.empty.movements` (the ledger's empty sentence); `tabs.notYet` removed (all seven store tabs built).
- **Guesses:** the boxes don't stop a future day (`max=today` on the input only); a SAP `entryTime` with a `T` is
  formatted as a date-time, otherwise drawn as sent; quantity and unit drawn as one value; the opened SAP row and its
  page are in the address; the SAP lines read only while their window is read.
- **Not done:** the "on dev" check (no server).

## Review fixes as built (oms worktree-agent-a314d0c88302084b7, commits 298933c8, 601f35bb, 4580cb6d)

Contract changes are marked inline above (item `sums`, Fleet `problems` + `HeldServedFellBack`, ledger `applied: boolean |
null`, page `total ?? rows.length`, Find `stores: number | null`). Structure, superseding the "as built" notes above:
- **`api.ts`:** one `stockConsoleApi` grouped by resource (stores, store tabs, item, fleet, find, `scan(code)` — was
  `readScan` — movements); `stockConsoleApi942/943/945` are gone. One `toPage(d, asked, row?)` (rows | lines | bare
  array); `PageAsk = { page; size }`. `retryUnlessAnswered` retries only `network`/`server`. Kept pages: one
  `keepWhileSame(at, parts)` for the ledger window and the SAP lines' row.
- **Item:** `toItem` lives in `item-sum.ts` (pure, tested), not `api.ts`.
- **Stages:** `STAGES`, `StageName`, `isStageName` in `@/core/models/store-stage` (store-stages imports them); the
  console's `stageWord(stage)` (`figures.ts`) + `WordOrRaw` (a known value in our words, an unknown one isolated by kind:
  codes `Ltr`, free text `bdi`; `wordText` for string sinks).
- **Grids:** `figureColumn<T>` in `columns.ts`; row ids by `rowKey(...parts)` and `ListGrid`'s `gridRowIds` (a blank or
  repeated key falls back to the row's place, so AG Grid drops no row).
- **GS1:** `scan.frame()` also supplies `search` (callers no longer pass `search=`): Search reads again when
  `scanReadsSame` (the scan leaves the list's read unchanged although the address moved). The boxes are filled from the
  scan only when its answer changes.
- **SAP tab:** `sapPlaceShown(view, answer, header)` — the place from the store header (passed `StorePage → StoreTabs →
  SapTab`) under a refusal.
- **Files:** `ItemTabStrip.tsx` (was ItemTabs), `ItemTabPanels.tsx` (was ItemListTabs), `ItemTabListFrame.tsx` (was
  ItemTabList), `FailedLeftOut.tsx`, `WordOrRaw.tsx`, `row-ids.ts`. Locale: `stores.failed` retired (the Stores list uses
  `RefusalBanner`); `fleetLine.HeldServedFellBack` added (en, ar).
