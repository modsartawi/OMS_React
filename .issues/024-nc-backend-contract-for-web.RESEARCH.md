> Research asset for wayfinder ticket 024 (map 023 — Web Back-Office Notification Center).

# SIS.Api Notification Center — backend HTTP contract for a web back-office client

Local-source dig against `C:\Work\DMSCO\BackOffice\`. Every claim below is traced to the file that
owns it. The reference client behaviour is the WPF POS (`Sartawi.POS\Notifications\` +
`Sartawi.Retail.Data\...\NotificationCenter\Client\`); the web BO client re-implements that same
poll/claim/read/create surface over `src/core/api.ts`.

---

## Summary

- **Five HTTP endpoints** live under the `Notifications/` tag, all guarded by `ApiKeyEndpointFilter`
  and all wrapped in the house universal envelope (`HttpGeneralResponse<T>` — `{ statusCode, success,
  data, message, errors[] }`). Source: `Services\SIS.Api\Endpoints\Notifications\NotificationEndpoints.cs`
  lines 84–109.
  - `GET Notifications/Poll?watermark=` → `NotificationPollResult`
  - `POST Notifications/{id}/Claim` → `NcClaimResult`
  - `POST Notifications/{id}/Read` → `{ ok = true }`
  - `POST Notifications` → `{ notificationId }`
  - `GET Notifications/Presence` → `List<NcPresenceRow>` (ops fleet view)
  - `MapHub /hubs/notifications` (SignalR wake nudge — later enhancement, not on the poll rail)
- **Identity is header-derived, server-side.** `x-api-key` + `storecode` + `staffid` (+ optional
  `registerid`). **A caller that sends NO `registerid` is a BackOffice user**: audience = **User+All**,
  device key = **staffid**, AppKind = **"BO"**. A `registerid` (plus a non-empty storecode) marks a POS
  till: Store+All, device = the register, AppKind = "POS". Source: `GetCallerIdentity`, lines 320–337.
- **The BO no-registerid caller fully works for Poll, Claim, and Read** as long as it sends a non-empty
  `staffid` (that value becomes both the User audience key and the device key). The only endpoint that
  refuses an empty device is Read (`NC_NO_DEVICE`), and Claim/Read additionally validate the caller is
  in the item's audience. Broadcast/All-audience creates are permission-gated on staffid.
- **Broadcast is gated** by a server-side new-auth check: the caller's `staffid` must hold
  `BackOfficeScreen[CONTROLLER='NotificationBroadcast', COMMAND='01']` on the OMS DB. Fail-safe DENY.
  Enforced inside the `Create` endpoint for **`TypeCode == BROADCAST` OR any `AudienceKind == All`**.
  Source: `NotificationEndpoints.Create` lines 240–247 + `NcBroadcastPermissionService.cs`.
- **Everything is gated by `NotificationCenter:Enabled`.** When OFF the routes are never mapped →
  clients get **404** (a definite "feature off" signal, not flakiness). Source: `DefineEndpoints`
  lines 80–82; flag reader `NotificationCenterFeature.cs`.

### Envelope & error mechanics (applies to every endpoint)

`EndpointHelpers.ExecuteAsync` (`Endpoints\Helpers\EndpointHelpers.cs`) wraps every handler:

- **Success** → `Results.Ok(new HttpGeneralResponse<T>{ Data = ..., Success = true })`.
- **`DomainException`** → `Results.BadRequest` (HTTP 400) with `HttpGeneralResponse{ StatusCode = 400,
  Success = false, Message = e.Message, Errors = [ { ErrorMessage, ErrorCode, InternalErrorCode } ] }`.
  The machine code (`NC_NOT_CLAIMABLE`, `NC_FORBIDDEN`, …) is the **first ctor arg of
  `DomainException`** and lands in `Errors[0].ErrorCode`; the human text is `Message`.
  (Confirmed: `DomainException(string errorCode, string message)`, `Sartawi.Core.Data\Exceptions\DomainException.cs`.)
- Any **non-DomainException** rethrows → generic 500. So every "business refusal" below is a **400 with
  `success:false` + a code**, exactly the shape `.claude/rules/api-envelope.md` calls a business outcome.

Header constant names (`Sartawi.Retail.Data\Modules\Auth\AuthConstants.cs`): `ApiKeyHeaderName = "x-api-key"`,
`StaffIdClaimName = "staffid"`, `StoreCodeClaimName = "storecode"`. The `registerid` and `x-presence`
header names are string literals local to `NotificationEndpoints` (lines 25–27).

---

## 1. Poll — `GET Notifications/Poll?watermark=`

Handler: `NotificationEndpoints.Poll` lines 114–146. Repository: `NotificationCenterRepository.PollAsync`
lines 16–87. Response model: `Services\Models\NotificationPollModels.cs`.

### Request

- **Query:** `watermark` (long, default `0`). `0` = cold start = full active audience set (PRD D6).
- **Headers:**
  - `x-api-key` — required (enforced by `ApiKeyEndpointFilter`; a bad/missing key → 401/403).
  - `storecode` — the acting store. For a BO caller it may be empty; audience derivation only puts it
    to work in POS (store) mode.
  - `staffid` — the logged-in user. **For BO this is the whole identity**: it becomes both the User
    audience key AND the device key.
  - `registerid` — **the BO web client sends NONE.** Absence is what selects BO/User mode.
  - `x-presence: skip` — cooperative throttle. When present the server SKIPS the `NcPresence` heartbeat
    write for that poll; absent = stamp every poll (older clients keep working). The POS client stamps
    on the first poll and then ~once/min, sending `skip` in between (`NotificationClient.ShouldSkipPresence`,
    `PresenceInterval`). Presence is **visibility-only and never fails the poll** — the upsert is
    try/caught (lines 128–141). The web client can simply always send `x-presence: skip` (or omit it) —
    presence is an ops-grid nicety, nothing branches on it.

### BO no-registerid implication (confirmed)

`GetCallerIdentity` (lines 320–337):

```
var registerId = headers["registerid"] ?? "";
var storeMode  = registerId != "" && !string.IsNullOrEmpty(userAction.StoreCode);
// storeMode == false for BO ⇒
StoreCode = null;        // not used in the audience match
UserId    = staffId;     // User-audience key
DeviceKey = staffId;     // read receipts + claim device
AppKind   = "BO";        // presence row label only
```

So a BO poll returns rows where `AudienceKind = 'All'` **OR** (`AudienceKind = 'User'` AND
`AudienceKey = @UserId(=staffid)`). It can **never** receive Store-audience rows (POS order queues) —
by construction, not by filter. The SQL audience predicate is `PollAsync` lines 54–56.

### Watermark / delta semantics

- The watermark is a **SQL `ROWVERSION` read as `BIGINT`** (`CAST(n.RowVer AS BIGINT) AS Watermark`),
  NOT a timestamp or an id. Repo header comment lines 11–13 + line 44.
- Every **UPDATE bumps the rowversion**, so a claim/resolve/dedup-rearm re-delivers the row to every
  device with zero app code. Poll predicate: `WHERE n.RowVer > CAST(@Watermark AS BINARY(8))` (line 52),
  plus `ExpiresAt > @Now` (expiry is a filter, never announced).
- The response `Watermark` is `Min(max item rowversion returned, @Safe)` where
  `@Safe = MIN_ACTIVE_ROWVERSION()-1` (lines 39, 81–84). An empty poll keeps the caller's watermark;
  the `@Safe` cap both defers rows still inside an open producer transaction and *heals* a client whose
  watermark got ahead of the DB (post-restore rewind). **The client adopts the returned watermark
  verbatim, even if lower** (`NotificationClient.Dispatch` lines 436–444). `0` on the next poll is NOT
  needed — the client rides the server value.
- Arrival vs. change is a **client-side** distinction: the client keeps `NotificationId → last rowversion`
  and raises *ItemsArrived* for unknown ids, *ItemsChanged* when the rowversion moved (`Dispatch`
  lines 446–470). The server does not label them.

### Poll-item response shape — every field (`NotificationPollItem`, lines 14–48)

| Field | Type | Notes / source |
|---|---|---|
| `NotificationId` | string | ULID PK. Dedup/routing key client-side. |
| `TypeCode` | string | e.g. `NEW_ORDER`, `BROADCAST` (see Constants). |
| `AudienceKind` | string | `All` / `Store` / `User`. |
| `AudienceKey` | string | store code or user id (empty for All). |
| `Title` | string | display headline. |
| `Body` | string | display body. |
| `EntityKind` | string | goTo target kind (`Order` / `Delivery`). |
| `EntityId` | string | **deep-link key** — the DocumentNo for OMS routes. |
| `ParamsJson` | string | free JSON passed to the nav handler. |
| `DedupKey` | string | producer dedup tag (DocumentNo for orders). |
| `DeadlineAt` | DateTime | SLA countdown target; `0001-01-01` (default) = none. |
| `ExpiresAt` | DateTime | poll filter boundary; item vanishes after it. |
| `Status` | string | `Active` / `Claimed` / `Resolved` / `Cancelled`. |
| `ClaimedByStaffId` | string | who claimed (staffid). |
| `ClaimedByDevice` | string | claiming device key (registerid on POS, staffid on BO). |
| `ClaimedAt` | DateTime | claim instant. |
| `ResolutionText` | string | outcome text shown on grayed resolved/cancelled rows. |
| `CreatedAt` | DateTime | **freshness/ordering key**; re-stamped on dedup re-arm. |
| `Watermark` | long | this item's rowversion (per-item delta key). |
| `DisplayStyle` | string | denormalized from type: `Badge` / `Toast` / `Banner`. |
| `PlaySound` | bool | denormalized from type. |
| `ReadScope` | string | denormalized from type: `Claim` / `Device`. |
| `NavRoute` | string | denormalized route KEY (`OmsDocument` or `""`). |
| `IsRealtime` | bool | denormalized; drives server wake, informational to client. |
| `IsRead` | bool | **this device** has a receipt (LEFT JOIN on `DeviceKey`). Only Device-scope types ever receipt → always `false` for Claim-scope items. |

Type-registry fields are **denormalized into every item** (PRD D5) — the client never syncs a registry,
and an unknown `NavRoute` degrades to text-only.

### Which fields drive which UI behaviour (from the POS reference client)

- **Unread BADGE:** `NotificationPresenter.UnreadCount` (`Client\NotificationPresenter.cs` lines 103–122)
  counts items where `Status == Active` AND not expired (`ExpiresAt > now`) AND not in the local read
  set (which is seeded from `IsRead`). So the badge is driven by **`Status` + `ExpiresAt` + `IsRead`**
  (Claim-scope items leave the count when `Status` flips to Claimed/Resolved; Device-scope items leave
  when read).
- **List ORDERING:** newest-first by **`CreatedAt`** — `OpenNotificationCenter` does
  `.OrderByDescending(i => i.CreatedAt)` (`POSController.Notifications.cs` line 249). SLA urgency is a
  *banner slot* decision (soonest `DeadlineAt`), not the list sort.
- **Arrival BANNER:** `MaybeShowBanner` (lines 505–553) pops only for a genuinely-new arrival
  (`ItemsArrived` or a dedup re-arm) whose `Status == Active`, not already read, with
  `DisplayStyle == Toast` (auto-dismiss ~8s) or `Banner` (sticky SLA); `Badge` style stays silent.
  Freshness gate: `RealNow - CreatedAt <= 15 min` so a cold-start backlog doesn't re-toast. `PlaySound`
  → a sound. Slot policy: a live-countdown card owns the slot; a sooner `DeadlineAt` preempts.
  → driven by **`DisplayStyle` + `CreatedAt` + `Status` + `IsRead` + `PlaySound` + `DeadlineAt`**.
- **Deep-link ROUTING:** `NavRoute` selects a per-app handler (`NotificationNavRoutingTable`); the OMS
  handler opens the document list filtered by **`EntityId`** (the DocumentNo). Unknown/empty `NavRoute`
  ⇒ no goTo affordance (text-only). `POSController.Notifications.cs` lines 276–355 +
  `Client\NotificationNavRoutingTable.cs`.

---

## 2. Claim — `POST Notifications/{id}/Claim`

Handler: `NotificationEndpoints.Claim` lines 157–190. Repo: `ClaimAsync` lines 92–134.
Result model: `Services\Models\NcClaimResult.cs`.

### Response shape — `NcClaimResult`

```
bool     Won               // this device holds the claim (won now, or idempotent re-win)
string   Status            // resulting NcNotificationStatus (Claimed / still Active on a null row-less race)
string   ClaimedByStaffId  // winner's staffid
string   ClaimedByDevice   // winner's device key
DateTime ClaimedAt         // claim instant
```

- **First-wins** via a conditional `UPDATE ... WHERE Status='Active' AND ExpiresAt > @Now` guarded by the
  row lock; exactly one racing device sees `@@ROWCOUNT = 1` (`ClaimAsync` lines 96–116). The endpoint
  then re-reads `Status/ClaimedBy*/ClaimedAt` so the **loser learns who beat it**.
- **Idempotent for the winner:** `Won = won || (Status==Claimed && ClaimedByDevice == deviceKey)`,
  case-insensitive (lines 130–132). A BO caller's `deviceKey` is its staffid.
- On a WON claim of a **realtime** type the endpoint fires a SignalR wake to the audience group
  (lines 182–187) — pure latency bonus; ignorable by a poll-only web client.

### Errors (all → 400 `success:false` + `Errors[0].ErrorCode`)

| Code | When | Source |
|---|---|---|
| `NC_NOT_FOUND` | unknown id (audience lookup returns null, or claim re-read returns null) | lines 177, 344 |
| `NC_NOT_AUDIENCE` | caller not in the item's audience (checked before claim) | `ValidateCallerInAudienceAsync` line 360 |
| `NC_NOT_CLAIMABLE` | the item's `ReadScope != Claim` (i.e. a Device-scope BROADCAST/JOB_DONE) | line 171–173 |

### Which TypeCodes are Claim-scope

From the seeder (`NotificationCenterSeeder.cs`): **`NC_TEST`, `NEW_ORDER`, `SLA_ORDER`** are
`ReadScope = Claim` (claimable). **`BROADCAST`, `JOB_DONE`** are `ReadScope = Device` (NOT claimable →
`NC_NOT_CLAIMABLE`). The Claim endpoint reads `ReadScope` off the audience row (`GetAudienceAsync` joins
the type) rather than the item, so it is authoritative.

### BO no-registerid claim — confirmed working

The endpoint uses `identity.StaffId` as the claim device (`repository.ClaimAsync(id, identity.StaffId,
identity.DeviceKey)`, line 175; for BO `DeviceKey == StaffId`). Audience validation passes for `All` and
`User`-audience(key==staffid) items — exactly what a BO poll surfaces. **Caveat:** a BO caller can only
usefully claim `All`-audience Claim-scope items (`NC_TEST`), because the OMS order types (`NEW_ORDER`/
`SLA_ORDER`) are minted with **Store** audience by the in-process producer and thus never appear in a
BO poll nor pass BO audience validation. See Open Questions.

---

## 3. Read — `POST Notifications/{id}/Read`

Handler: `NotificationEndpoints.Read` lines 192–212. Repo: `MarkReadAsync` lines 277–304.
Returns `{ ok = true }`.

- **Device requirement:** an empty `DeviceKey` is refused with **`NC_NO_DEVICE`** ("A device identity
  (registerid or staffid) is required to mark read.", lines 204–206). For a BO caller the device is the
  **staffid** — so a BO client MUST send a non-empty `staffid` or Read 400s. A receipt row under
  `DeviceKey=''` would be shared by every headerless poller, so the guard protects the poll's `IsRead`
  join.
- **Audience** is validated first (`ValidateCallerInAudienceAsync`) → `NC_NOT_FOUND` / `NC_NOT_AUDIENCE`
  as in Claim.
- The receipt is written per `(NotificationId, DeviceKey)`; retry/double-tap collapses to idempotent
  success (2627/2601 swallowed).

### Which ReadScope types actually receipt server-side

- **Device-scope types** (`BROADCAST`, `JOB_DONE`) are the ones that receipt: the client posts Read for
  them, the poll's `IsRead` join reads it back so an already-read broadcast stays green after a restart.
  POS: `MarkNotificationRead` posts a receipt **only** `if item.ReadScope == NcReadScopes.Device`
  (`POSController.Notifications.cs` lines 649–656).
- **Claim-scope types** (`NC_TEST`, `NEW_ORDER`, `SLA_ORDER`) are **read-by-claim** — their read signal is
  the claim (`Status`), they never receipt, and `IsRead` stays false for them. The server would still
  *accept* a Read for them (nothing rejects on scope), but the client never sends one.

---

## 4. Create / broadcast — `POST Notifications`

Handler: `NotificationEndpoints.Create` lines 214–266. Service: `NotificationCenterService.CreateAsync`.
Request model: `Services\Models\CreateNotificationRequest.cs`. Returns `{ notificationId }`.

### `CreateNotificationRequest` fields

```
string    TypeCode      // required
string    AudienceKind  // All / Store / User
string    AudienceKey   // required unless AudienceKind == All; max 30
string    Title         // max 200
string    Body          // max 1000
string    EntityKind    // max 30
string    EntityId      // max 50
string    ParamsJson    // free JSON
string    DedupKey      // max 60 (producer dedup / "replace by tag")
DateTime? DeadlineAt    // optional SLA target
DateTime? ExpiresAt     // optional; must be in the FUTURE
string    CreatedBy     // IGNORED from caller — server stamps it from staffid (line 250)
```

### The `HttpCreatableTypes` allow-list

Only **`BROADCAST`, `JOB_DONE`, `NC_TEST`** are creatable over HTTP (lines 31–36). Anything else (notably
`NEW_ORDER`/`SLA_ORDER`) → **`NC_TYPE_NOT_CREATABLE`** (lines 231–233): order types are minted in-process
by the Sd producer inside the order's own transaction and must not be forgeable over HTTP. Empty TypeCode
→ **`NC_BAD_REQUEST`** ("TypeCode is required.", line 222–223).

### Validation (`ValidateCreateRequest` lines 272–298)

- Length caps as above → `NC_BAD_REQUEST` ("<field> exceeds the maximum length of N characters.").
- `ExpiresAt` in the past (`<= DateTime.Now`) → **`NC_BAD_EXPIRY`** ("ExpiresAt must be in the future.").
  Local wall clock on purpose. A past expiry would mint an item born invisible.
- `AudienceKind` must be `All` / `Store` / `User` → else **`NC_BAD_AUDIENCE`**.
- `AudienceKey` required when `AudienceKind != All` → else **`NC_BAD_AUDIENCE`** ("AudienceKey is
  required for Store/User audiences.").
- If the type is unknown/disabled in the registry, `CreateAsync` returns null → the endpoint rolls back
  and throws **`NC_TYPE_DISABLED`** ("Unknown or disabled notification type.", lines 258–261).

### AudienceKind / AudienceKey rules

`All` → key empty (paged to the whole fleet). `Store` → key = store code. `User` → key = user id
(`NcAudienceKinds`, `NcConstants.cs` lines 27–32). The poll match and the wake-group derivation
(`NcNudgeGroups.ForAudience`) both key off these.

### The `NotificationBroadcast` permission gate (where/how enforced)

`Create` lines 240–247:

```
var staffId = httpContext.GetUserAction().StaffId ?? "";
if (request.TypeCode == NcTypeCodes.Broadcast || request.AudienceKind == NcAudienceKinds.All)
    if (!await broadcastPermission.IsAllowedAsync(staffId))
        throw new DomainException("NC_FORBIDDEN", "Staff is not authorized to post broadcasts.");
```

- Trigger: **`TypeCode == BROADCAST` OR `AudienceKind == All`** (any type that pages the whole fleet).
  Store/User-scoped `JOB_DONE` / `NC_TEST` stay **ungated** in v1.
- Enforcer: `INcBroadcastPermissionService` → `NcBroadcastPermissionService.IsAllowedAsync`
  (`Services\NcBroadcastPermissionService.cs`). It calls the SIS.Authorization engine:
  `Check(staffId, AuthorizationObjectName /* BackOfficeScreen */, { CONTROLLER='NotificationBroadcast',
  COMMAND='01'(Activity.Create) })` and requires `AuthCheckResult.Allowed`.
- **Fail-safe DENY**: empty staffid, missing Ua tables, or ANY engine exception → `false` (denied).
  Seed template: `Modules\NotificationCenter\Sql\002_seed_broadcast_permission.sql`.
- On denial the client sees a **400 `success:false` code `NC_FORBIDDEN`** with the message. The POS
  compose client surfaces the envelope Message verbatim ("Staff is not authorized...").
- The create runs in an explicit transaction so a realtime type's post-commit wake can fire
  (lines 255–263); irrelevant to a poll-only web client.

**Web-client implication:** the BO compose screen needs the `NotificationBroadcast` grant on the acting
staffid. There is also a matching **client-side** `Permissions.Check` in the WPF compose screen (same
CONTROLLER name) — the web client should gate the compose affordance the same way (soft gate) but the
server is the authority.

---

## 5. Wake hub — `MapHub /hubs/notifications` (later enhancement, do NOT build now)

- Route + message contract: `NcHubContract.cs` — `Path = "/hubs/notifications"`, single client method
  `WakeMethod = "Wake"` (an **empty** nudge — "signal, don't transport").
- Server hub: `Services\SIS.Api\Hubs\NotificationHub.cs`. Auth is **mirrored inside `OnConnectedAsync`**
  (endpoint filters don't run on hubs): validates `x-api-key`, then joins the connection to group `all`
  plus its identity group — **`store:{code}` when a `registerid` is present, else `user:{staffid}`**
  (same derivation as the poll). A bad key → `Context.Abort()`.
- Dispatcher: `Services\SIS.Api\Hubs\SignalRNcNudgeDispatcher.cs` (server side); groups named by
  `NcNudgeGroups` (`all` / `store:` / `user:`).
- Client half: `Client\NcHubWakeConnector.cs` — **NOT compiled yet** (owner-gated; needs the
  `Microsoft.AspNetCore.SignalR.Client` package). On "Wake" or reconnect it just calls
  `client.WakeNow()` which ends the current poll-wait early. **Poll is the source of truth; the hub only
  buys latency.** A web client can ship poll-only and add SignalR later with zero contract change.
- Prod prerequisite noted in source: the IIS "WebSocket Protocol" feature on the SIS.Api host.

---

## 6. Enablement flag — `NotificationCenter:Enabled`

`NotificationCenterFeature.IsEnabled` (`NotificationCenterFeature.cs`): true when the config value is
`"X"` or case-insensitive `"true"`.

- When **disabled**, `DefineEndpoints` returns before mapping any route (lines 80–82) → **all
  `Notifications/*` routes 404**, and the hub is not mapped either. The POS client treats a 404 as "the
  feature is off" — a definite answer, parks on a slow-retry lane, no error spam
  (`NotificationClient.PollOnceAsync` lines 203–210).
- A second flag `NotificationCenter:RetentionWorker` (default OFF) gates the retention sweep worker only;
  irrelevant to the client contract.

**Web-client implication:** treat a 404 from `Notifications/Poll` as "NC disabled" and hide the bell
(don't surface it as an error).

---

## Constants reference (`NcConstants.cs` + seeded type registry)

Persisted string enums — never rename (`NcConstants.cs`).

### TypeCodes (`NcTypeCodes`) and their seeded registry defaults

Seeder: `Services\NotificationCenterSeeder.cs`. Registry row shape: `Data\NcNotificationType.cs`
(`DisplayStyle`, `PlaySound`, `ReadScope`, `IsRealtime`, `NavRoute`, `ExpiryDays`, `IsEnabled`).

| TypeCode | DisplayStyle | ReadScope | IsRealtime | PlaySound | NavRoute | ExpiryDays | HTTP-creatable? | Notes |
|---|---|---|---|---|---|---|---|---|
| `NC_TEST` | Toast | Claim | true | false | "" | 7 | yes | tracer/proof type |
| `BROADCAST` | Banner | Device | false | false | "" | 30 | yes (gated) | manual announcements |
| `NEW_ORDER` | Toast | Claim | true | false | `OmsDocument` | 3 | **no** | store order queue; producer-minted, Store audience |
| `SLA_ORDER` | Toast | Claim | true | **true** | `OmsDocument` | 1 | **no** | deadline-carrying; producer predicate stubbed — nothing emits it yet |
| `JOB_DONE` | Toast | Device | true | false | "" | 7 | yes | generic job→requester |

### Statuses (`NcNotificationStatuses`)

`Active`, `Claimed`, `Resolved`, `Cancelled`. Active is the only "needs attention" state; Claimed keeps a
live item for the winner and grays it for siblings; Resolved/Cancelled gray with `ResolutionText`.

### Read scopes (`NcReadScopes`)

`Claim` (read signal is the claim — never receipts, `IsRead` stays false) · `Device` (per-device receipt
via the Read endpoint; rehydrated through `IsRead`).

### Display styles (`NcDisplayStyles`)

`Badge` (silent — badge/list only) · `Toast` (auto-dismiss banner) · `Banner` (sticky, used for SLA).

### Nav routes (`NcNavRoutes`) & entity kinds (`NcEntityKinds`)

`NavRoutes`: `OmsDocument` (the only v1 route). `EntityKinds`: `Order`, `Delivery`. An unknown/empty
`NavRoute` degrades to text-only.

### Audience kinds (`NcAudienceKinds`)

`Store`, `User`, `All`.

### Wake groups (`NcNudgeGroups`)

`all` · `store:{code}` · `user:{id}`.

---

## Open questions / gaps for the web client

1. **What does a BO poll actually surface today?** Only `All`-audience items and `User`-audience items
   keyed to the caller's staffid. The two routable OMS order types (`NEW_ORDER`, `SLA_ORDER`) are minted
   **Store**-audience by the in-process Sd producer, so **a BO user never sees them** unless a producer
   also mints a User/All copy. If the web NC is meant to show order alerts to a back-office user, the
   producer's audience model (or a new BO-targeted producer) is an open design item — **source does not
   settle who mints User-audience notifications for BO.** (Check `Producers\SdOrderNotificationProducer.cs`
   before speccing BO order alerts.) Practically, the only things a BO caller can create/claim/read today
   are `BROADCAST` (gated), `JOB_DONE`, and `NC_TEST`.

2. **Presence AppKind "BO" — is there a web/BO distinction needed?** The presence row stamps AppKind
   `"BO"` for a no-registerid caller. Web and WPF back-office would both be "BO" and share a device key
   (staffid) — two browsers logged in as the same staffid collapse to one presence row and one receipt
   scope. If per-browser read state matters, staffid-as-device is too coarse; source has no per-session
   device concept for BO.

3. **No unread-count or list endpoint** — the badge and list are 100% client-derived from the polled
   active set (`UnreadCount` logic in `NotificationPresenter`). The web client must replicate that logic
   (Active + not-expired + not-locally-read) rather than expecting a server count.

4. **No "mark all read" / bulk endpoint** — Read is per-id. The POS "open the list marks everything read"
   loops per Device-scope item. A web client wanting a "clear all" must loop the same way.

5. **`GetUserAction()` provenance for a web caller.** `staffid`/`storecode` reach the handler as claims
   populated by the auth filter chain (`UaSessionEndpointFilter` / `SecretKeyEndpointFilter` add them
   from the session or headers). The web BO client authenticates through the same `x-api-key` + session
   headers as the rest of `src/core/api.ts`; confirm the acting `staffid`/`storecode` the SPA already
   sends line up with what NC expects as the device/audience key (they should — same header names).

6. **SignalR client is not yet compiled** (owner-gated NuGet). Poll-only is the fully-supported v1; the
   hub is a latency enhancement with a stable, tiny contract (`/hubs/notifications`, one empty `Wake`).
   Safe to defer for the web client.

7. **`x-presence` throttle is cooperative only** — the server also self-throttles (writes only when the
   row is >30s stale or the staff changed, `UpsertPresenceAsync`). The web client can send `x-presence:
   skip` on every poll with no downside, since presence is ops-visibility only and nothing branches on it.
