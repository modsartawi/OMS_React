# Research — Web app identity & session fit for the Notification Center

Ticket [025](025-web-identity-session-fit.md) · map [023 — Web Back-Office Notification Center](023-web-notification-center.md) · client-side reconnaissance. Pair with [024 — backend contract](024-nc-backend-contract-for-web.md).

## TL;DR — the headline finding

The ticket hypothesized a **header gap**: that the web client must start attaching `x-api-key` /
`staffid` / `storecode` headers to poll the NC, the way a POS till would. **That gap does not
exist.** `Notifications/Poll` does **not** read those headers for identity — it reads
`HttpContext.GetUserAction()`, which resolves from **claims on the authenticated principal**. For a
web caller those claims are minted server-side from the `sis_session` cookie by the same
`ApiKeyEndpointFilter` that already guards every other web call. **The web client can poll, claim,
read, and create against `Notifications/*` today with exactly the request shape it already sends —
the `sis_session` cookie plus the `X-Web-Client` header.** No new identity headers are required.

The real gaps are smaller and client-side: a **per-request header passthrough** (`api.get` can't
attach `x-presence`), a **read-state model decision**, and **watermark persistence**.

---

## 1. What `src/core/api.ts` sends today, vs. what the server reads

**Client** (`src/core/api.ts` `request()`):

- **Auth is a cookie, not a header.** Every call sends `credentials: 'same-origin'`, carrying the
  **HttpOnly `sis_session` cookie**. The token never reaches JS (login lands it only in the cookie —
  `src/features/auth/api.ts`).
- **Only custom header on every request: `X-Web-Client: '1'`.** Plus `Content-Type: application/json`
  when there's a body. That is the entire custom-header surface.
- **No `x-api-key`, no `staffid`, no `storecode`, no `registerid`, no `x-presence`** are sent —
  anywhere in `src/`. (Confirmed by grep across the tree; the hits for those tokens are unrelated
  session-monitor / document models.)

**Server** (`SIS.Api/Endpoints/Notifications/NotificationEndpoints.cs`):

- `GetCallerIdentity(httpContext)` builds identity from **`httpContext.GetUserAction()`**
  (`HttpContextMapping.cs`), which reads **claims** — `UserIdClaim`, `StaffIdClaim`,
  `StoreCodeClaim` — off `context.User`. The **only** header it reads directly is `registerid`
  (line 323), used solely to decide POS-vs-BO mode.
- Those claims are minted by **`ApiKeyEndpointFilter`'s cookie branch** (attached to all five
  `Notifications/*` routes — `Poll`/`Claim`/`Read`/`Presence`/`Create`, each `.AddEndpointFilter<ApiKeyEndpointFilter>()`).
  When `CookieAuth:Enabled` (on for the web-facing IIS instance), the filter:
  1. reads the `sis_session` cookie, validates it (cached UA-session validator),
  2. **requires the `X-Web-Client` header as CSRF defence** — this is exactly why `api.ts` sends it,
  3. mints `UserIdClaim = session.UserId`, **`StaffIdClaim = session.UserId`**,
     `StoreCodeClaim = session.CurrentStoreCode` (when present).
  - Browser-supplied `staffid`/`storecode` headers are **explicitly ignored** on the cookie branch
    (identity comes strictly from the session row — D10).

**Resulting identity for a web caller** (`GetCallerIdentity`): no `registerid` ⇒ `storeMode = false`
⇒ **`AppKind = "BO"`, audience = `User+All`, `UserId = StaffId = session.UserId`,
`DeviceKey = StaffId`, `StoreCode = null`.** This is precisely the caller the map's Destination
describes.

> **Gap list for §1: essentially empty.** The web client needs to add **nothing** to its identity
> to poll as a BO user. The prerequisite is an ops/config fact, not a code change:
> `CookieAuth:Enabled = true` on the SIS.Api instance the portal talks to — already true, since it
> is how the whole portal authenticates today.

## 2. Session shape (`src/core/session.ts`)

`useSession` (zustand) holds only display state — the cookie is the truth:

| field | present? | note |
|---|---|---|
| `userId` | ✅ | from `Auth/UaLogin` / `Auth/Me`. **This equals the server's `StaffId` and the NC `DeviceKey`.** |
| `displayName` | ✅ | falls back to `userId` (`Auth/Me` carries none) |
| `currentStoreCode` | ✅ | from `Auth/Me` / `Auth/SwitchStore` |
| `staffid` | ❌ | **not stored — and not needed.** For a UA/BO user, `StaffId == UserId` (server sets `StaffIdClaim = session.UserId`). The client already knows its device key: it is `userId`. |

So although the session has no field literally named `staffid`, the value the NC needs client-side
(the caller's own device key, e.g. to reason about "my receipts") is already available as `userId`.
**No session-store change is required** for identity; a `staffid` alias would be cosmetic.

## 3. Browser "device" semantics & the read-receipt model

For a BO caller **`DeviceKey = StaffId = userId`**. Therefore **every browser tab and every machine
the same person is logged into shares one device identity.** Consequences:

- **`Notifications/{id}/Read`** refuses an empty `DeviceKey` (`NC_NO_DEVICE`). A web caller's device
  key is always `userId` (non-empty), so **the web client never trips that guard** — reads always work.
- **Read receipts are per-device = per-user.** Marking an item read in one tab/machine marks it read
  for **all** of that user's tabs and machines (the server `IsRead` join keys on `DeviceKey`). For a
  back-office **person** (not a shared till) this is arguably the *right* semantics: "I've seen this"
  should follow me across my devices.
- **Contrast with the POS.** The POS kept a **local `_ncReadIds` set + a server receipt** because a
  till is a *shared* device — many cashiers on one `registerid`, so the local set gave per-operator
  "read" within a shared device. **On web the device already IS the person, so the server receipt is
  already per-user** — the primary reason for a local set disappears.
- **Store-scoped items don't reach a BO web user.** Because `StoreCode = null` for a BO caller,
  `AudienceKind=Store` notifications never validate/deliver to the web portal — only `User`-targeted
  and `All` broadcasts do. (Consistent with the map; flag for **receive scope** [026](026-receive-side-parity-scope.md).)

> **Decision for [026], not a blocker here:** does the web client still want a small **local read
> set**? Not for correctness — the server receipt is already per-user. But a local set is still
> useful as (a) an **optimistic-UI shim** (grey the badge instantly before the `Read` round-trip
> lands) and (b) a hedge if a receipt POST fails. Recommendation: **rely on the server receipt as the
> source of truth for read/unread; keep only a thin optimistic overlay**, not the POS's full local
> read-tracking apparatus.

## 4. Poll cadence & lifecycle in the SPA

The portal already runs this exact pattern for Active Sessions (`ActiveSessionsPage.tsx`: TanStack
`useQuery` + auto-refresh), so the plumbing is proven. NC specifics:

- **`refetchInterval`** on a `useQuery(['nc','poll', watermark])` drives the ~8s poll. TanStack's
  `refetchIntervalInBackground` defaults to **false**, so polling **auto-pauses when the tab is
  hidden/blurred** — the desired lifecycle for free. (Explicit `document.hidden` handling optional.)
- **Presence throttle** — the server honours **`x-presence: skip`** to skip the presence write on
  most polls (~1 stamp/min) and spare the shared OMS DB. **This is a real client gap:** `api.get`'s
  signature is `get(path, params)` — **it cannot attach a per-request header.** `X-Web-Client` is
  added globally inside `request()`, but there is no passthrough for `x-presence` per call. **Small
  `api.ts` extension needed:** let `api.get` accept an optional `headers`/`init` (the underlying
  `request(path, init)` already merges `init.headers`). This is the one concrete production-code
  change §4 forces.
- **Watermark persistence.** `Poll?watermark=` needs the client to carry the high-watermark forward
  between polls. **In-memory** (a zustand field or query state) is enough for correctness: on reload
  it resets to `0`, which the server treats as a **cold start = full active set** (idempotent, cheap).
  Surviving refresh (localStorage) is an optimisation, not a requirement. **Decision for [026].**

---

## Gap list — what the web client actually lacks (crisp)

1. **Identity headers — NO GAP.** Cookie + `X-Web-Client` already yields a full `BO` / `User+All`
   caller (`StaffId = StoreCode-less UserId`, `DeviceKey = UserId`). Do **not** add
   `x-api-key`/`staffid`/`storecode` headers — the cookie branch ignores them by design, and putting
   `x-api-key` in the browser would break the "token never reaches JS" security model. **Prereq is
   config, not code:** `CookieAuth:Enabled` on the portal's SIS.Api (already on).
2. **Session store — NO GAP.** `staffid` isn't stored but isn't needed; it equals `userId`. Optional
   cosmetic `staffid` alias only.
3. **Per-request header passthrough — REAL, SMALL.** Extend `api.get` to accept optional
   `headers`/`init` so the poll can send `x-presence: skip`. One-line-ish change to `src/core/api.ts`.
4. **Read-state model — DECISION (→ 026).** Server receipt is already per-user; drop the POS's local
   `_ncReadIds` apparatus, keep at most a thin optimistic overlay. `Read` never hits `NC_NO_DEVICE`.
5. **Watermark persistence — DECISION (→ 026).** In-memory is correct (reload ⇒ cold-start
   watermark 0 ⇒ full set). localStorage is an optional nicety.
6. **Receive scope boundary — HANDOFF (→ 026).** A BO web caller has `StoreCode = null`, so
   `AudienceKind=Store` items don't reach it; only `User` + `All`. Confirm this is the intended
   receive scope.
