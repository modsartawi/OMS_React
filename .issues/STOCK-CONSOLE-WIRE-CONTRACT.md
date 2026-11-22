# Stock console — the wire contract (spec 4157, oms 940–945)

Not an issue. The contract between oms-react's stock console and SIS.Api's `StockConsole/*` routes, **reconciled against
the built server: BackOffice branch `pricing2` at `9970de845`** (`Services/SIS.Api/Endpoints/Stock/StockConsoleWebEndpoints.cs`,
`Sartawi.Retail.Data/Modules/Stock_v2/StockConsole/*.cs`, tickets 4158–4163). The server is the source of truth; the
web's types are `src/core/models/stock-console.ts` (each names its C# class) and the calls `src/features/stock/stock-console/api.ts`,
which returns every answer as sent: no normaliser, no second shape.

## Ground rules

- **Serialiser:** minimal-API `Results.Ok` → System.Text.Json web defaults (no `ConfigureHttpJsonOptions` in SIS.Api).
  camelCase; **nulls are sent as `null`, never left out**; every enum is a C# `string`; quantities are `decimal` → number.
- **Times:** `StockHealthTime.Local` → `"yyyy-MM-ddTHH:mm:ss"`, no offset, no fraction. A day is a midnight `DateTime`,
  `"yyyy-MM-ddT00:00:00"`: read its first ten characters (`formatDay`, `sapDayOf`). Exceptions: see *Server issues*.
- **Envelope:** `HttpGeneralResponse<T>`, `data` unwrapped by `core/api.ts`.
- **Grant:** every route `BackOfficeScreen[StockConsole, 03]`. `GET StockConsole/Access` exists but the web never calls it
  (oms 914: `Auth/Permissions` only).
- **Item numbers** are strings; names `nameEn`/`nameAr` from HQ's item master, `''` when unknown.

## Refusals

`DomainException` → **HTTP 400**, `{ success:false, message, errors:[{ errorCode, internalErrorCode, errorMessage }] }`;
`apiErrorCode(err)` reads `errors[0].errorCode`. One table, `refusals.ts`:

| Code | Raised by | Web |
|---|---|---|
| `StockVisibilityNoAnswer` | SIS.Api: SV not reached / over the client's limit / a non-envelope status | `refusal.unreachable` |
| `ConsoleBusy`, `ConsoleTimeout`, `NoStore`, `NoRow`, `BatchTooShort` | SV, passed by name | own sentence |
| `NarrowTheName` | SIS.Api: a name > 200 items, or too long a list for the query | own sentence |
| `NothingToFind`, `PrefixNeedsItem`, `PickOneItem` | SIS.Api, Find (before SV is asked) | own sentence |
| `WindowTooLong` | SIS.Api, both windows | own sentence |
| `SapNotConfigured`; `SapUnreachable` (+ reason) | SV 080 by name | own sentence |
| `WindowRequired`, `WindowBackwards`, `DayAndTypeRequired`, `BatchNeeded` | SIS.Api / SV — the web never sends these | `refusal.failed` + server sentence |
| bare 403 / codeless network·server | | `refusal.denied` / `refusal.unreachable` |

## Routes

All `GET`. Paged answers are `{ total, page, size, rows }` (`StockConsolePage<T>`, size default 25, max 200) unless named.

| Route | Query | Answer (TS) |
|---|---|---|
| `StockConsole/Stores` | — | `StockConsoleStores` `{ readAt, reservedRun{lastSuccessAt,lastNetting}, stores[], fleet[] }` |
| `…/Stores/{store}` | — | `StockConsoleStoreAnswer` `{ readAt, reservedRun, store: row \| null }` — the row is **under `store`** |
| `…/Stores/{store}/Items` | `item, batch, filter, sort, page, size` | page of `StockConsoleItemRow` |
| `…/Stores/{store}/Batches` | `item, batch, filter, page, size` | page of `StockConsoleBatchRow` |
| `…/Stores/{store}/Holds` | `item, batch, state, page, size` | page of `StockConsoleHoldRow` |
| `…/Stores/{store}/Takes` | `item, batch, day, outcome, page, size` | `StockConsoleTakes` = page + `failedLeftOut` |
| `…/Stores/{store}/Feeds` | — | `StockConsoleStoreFeeds` `{ readAt, store, sapPlace, sapLastAttempt, tillPlace, tillLastAttempt, counted, driftBatches, driftRanAt }` |
| `…/Stores/{store}/Stage` | — | `StockConsoleStoreStage` `{ store, stage: {store,stage,updatedAt,lastMove} \| null, moves[], seed, gates \| null, gatesAnswered, gatesNoAnswer }` |
| `StockConsole/Fleet` | — | `StockConsoleFleet` `{ readAt, feeds, reserved, heldServed, reader, takes, problems[] }` |
| `…/Stores/{store}/Items/{item}` | — | `StockConsoleItem` (flat: `tillSide`, `free`, `answeredNow`, `changeFeed` sums at the top level) |
| `…/Items/{item}/Batches` | `filter, page, size` (web: `page=1&size=200`) | page of `StockConsoleBatchRow` |
| `…/Items/{item}/Holds` | — (not paged) | `StockConsoleItemHolds` `{ open, released, total, allShown, rows }` |
| `…/Items/{item}/Takes` | `outcome, page, size` (web: `page=1&size=200`) | `StockConsoleTakes` (3 days) |
| `StockConsole/Items/{item}/Stores` | `page, size` | `StockConsoleItemStores` = page + `item, nameEn, nameAr` |
| `StockConsole/Find` | `item, batch, page, size` | `StockConsoleFind` `{ kind: 'batches'\|'items', total, page, size, stores, more, batches[], items[] }` |
| `StockConsole/Scan` | `code` | `StockConsoleScan` (BO 4162's shape verbatim) |
| `…/Stores/{store}/SapMovements` | `from, to` (`yyyy-MM-dd`, ≤ 5) | `StockConsoleSapMovements` `{ readAt, place{sapPlace,lastAttempt}, days[] }` |
| `…/SapMovements/Lines` | `day, type, page, size` | `StockConsoleSapLines` `{ readAt, day, movementType, page, size, total, lines[] }` |
| `…/Items/{item}/Movements` | `from, to` (`yyyy-MM-dd`, ≤ 7), `page, size` | `StockConsoleLedger` `{ store, item, from, to, page, size, total, lines[] }` |

Enum spellings: Items `filter` all·withStock·belowZero·held·differ, `sort` item·held·till·gap; Batches `filter`
all·withStock·belowZero·held·placeholder·expired·expiring; Holds `state` open·standing·sold·released; Takes/Item takes
`outcome` all·granted·refused·failed (the web's frame `filter` is renamed in `api.ts`). Take `kind` granted·refused·failed;
hold `state` Held·Sold·Released, `source` Door·Ledger·Check; reserved state Computed·Stale·NeverComputed; status Ok·Watch·Problem;
flag codes SapQuiet·BelowZero·OldHold·SalesNotApplied·ComparisonDiffers·PlaceholderStock; fleet problem codes
FeedLate·ReservedNeverRun·ReservedStale·ReaderBehind·NoAnswer; fleet feeds SapFeed·PosFeed·HoldLedgerReader·SapCount;
ledger `feed` Sap·Pos; SAP mark Applied·ReceivedNotApplied·NotReceived; seed state None·Running·Seeded·Refused·Failed.

### Shapes worth knowing

- **Flag** `{ code, level, value: number|null, limit: number }`: limit is never null; 0 = "any" (drawn `flag.limitAny`).
- **Take row** is one flat shape; the kind fills its fields, the rest are null. Refused: `batch` (refused) and
  `batchWithStock` (the batch the door named instead — drawn), `shadow: boolean|null`. Granted: `batches[{batch,quantity,state}] | null`.
- **Fleet facts** each carry `answered`/`noAnswer`; an unanswered fact's other fields are defaults, so the web checks
  `answered` first. The server judges `feeds.rows[].late`, `reserved.state`, `reader.behind`; ages and limits are **minutes**.
  `problems` = the stores list's `fleet` line.
- **Item sums:** `tillSide{sapStock, soldNotInSap, tillStock}`, `free{tillStock, heldStanding, heldSold, held, reserved, reservedState, reservedAt, reservedIncluded, free}`,
  `answeredNow{rule, tillStock, liveOrders, held, reserved, quantity}` (`rule ''` = not carried → "no answer"),
  `changeFeed{tillStock, held, reserved, unfloored, quantity}`.
- **Gates** `from`/`to` are the measured **days** (14 whole days before today), not stages.
- **Ledger line** `{ id, time, feed, movementType, quantity, batch, storageLocation, sapDocument{materialDocument, year, item}|null, tillDocument{store, transaction, line}|null, postingDay, applied: boolean, onSap, onTill, complementaryOnSap, complementaryOnTill }` — `sapDocument.item` is SAP's line.
- **SAP line** `year`/`line` are strings; `entryTime` is `"HH:mm:ss"`; `unit`, `batch`, `storageLocation` are `''` when blank.

### Sent but not drawn

`Stores.reservedRun`, `StoreAnswer.readAt/reservedRun`, `Item.readAt/reservedComputedAt`, `answeredNow.held/reserved`
(HeldServed operands), `changeFeed.unfloored`, `ledger.complementaryOnSap/OnTill`, `ItemStores.nameEn/nameAr` (Find's
Other stores title still shows the number only), the fleet's `withinLimit`, `shareWithinLimit`, `failedPerThousand`,
`limitMilliseconds`, `outages`, reader `rowsApplied`/`unmatchedRows`, reserved `lastComputedAt`/`lastDuration…`, held-served
`lastNetting`, `StageNow.lastMove`, seed `ask`/`countDay`/`who`. None is asked for by tickets 4158–4163 beyond what is drawn.

## Server issues (BackOffice, not changed here)

1. `StockConsoleFleet.cs:331` — `takes.day = day.Date` from `DateTime.Now` (Kind Local) is not passed through
   `StockHealthTime.Local`, so it goes out as `"…T00:00:00+03:00"`, against BO 4158 "times on the wire: local wall clock,
   to the second, no offset". The web reads its first ten characters.
2. `StockConsoleStageService.cs:472-481` — the Stage answer's times (`stage.updatedAt`, `moves[].movedAt`, `seed.askedAt/endedAt`,
   `gates.from/to`) are passed raw from the stage client, not through `StockHealthTime.Local`: SV's `datetime2` fractions
   can reach the wire (same 4158 rule). The web formats them, so it draws correctly.
3. `StockConsoleStoreService.cs:168` — `counted = driftBatches != null`, not the store's stage: a Seeded/Blocking store
   whose nightly comparison has not run yet reads "not a counted store" (spec 4157 story 51 / L302 speak of counted
   stores by stage). The web draws `counted` as sent.
