---
type: wayfinder-ticket
wayfinder: research
map: 023
status: done
blocked-by: —
---

# 025 — Web app identity & session fit for the NC

## Question

Does the oms-react client already carry the identity the NC contract needs, and does the BO poll
identity behave correctly in a browser? Produce a research note covering:

- **What `src/core/api.ts` sends today** — the universal envelope, base/proxy, and which headers
  are attached (x-api-key? storecode? staffid?). Compare against the headers `Notifications/Poll`
  reads (`GetCallerIdentity`: x-api-key, staffid, storecode, optional registerid, x-presence). List
  the gap: what must be added for the web client to poll as a BO user.
- **Session shape** — what `src/core/session.ts` / `useSession` holds (userId, storeCode,
  displayName, staffid?) and whether staffid (the NC device key for BO) is available client-side.
- **Browser "device" semantics** — for a BO caller the device key = staffid, so **every tab and
  every machine the same user is logged into shares one device identity**. Assess the consequences
  for the read-receipt model (`Notifications/{id}/Read` refuses an empty device; a receipt is
  per-device) and the unread badge: is a single per-user read state acceptable, or does the web
  client need its own local read tracking (the POS kept a local `_ncReadIds` set + server receipt)?
- **Poll cadence & lifecycle in a SPA** — TanStack Query `refetchInterval`, pausing on tab hidden,
  the presence-throttle header (`x-presence: skip` most polls), and watermark persistence across
  route changes / reloads (in-memory vs. survives refresh).

This is client-side reconnaissance; pair its findings with the server contract (024). Output: a
Markdown note linked from this ticket, ending in a crisp "gap list" of what the web client lacks.

## Answer

Full note: [025-web-identity-session-fit.RESEARCH.md](025-web-identity-session-fit.RESEARCH.md).

**Headline: the hypothesized identity-header gap does not exist.** `Notifications/Poll` derives
identity from `HttpContext.GetUserAction()` (claims), **not** from `x-api-key`/`staffid`/`storecode`
headers (only `registerid` is read directly, to pick POS-vs-BO mode). For a web caller those claims
are minted server-side from the `sis_session` cookie by `ApiKeyEndpointFilter`'s cookie branch — the
same filter already attached to all five `Notifications/*` routes. It sets `StaffId = session.UserId`,
`StoreCode = session.CurrentStoreCode`, and requires the `X-Web-Client` header (CSRF) that `api.ts`
already sends. So **the web client can poll/claim/read/create today with just its existing cookie +
`X-Web-Client` header** — no new identity headers, and it must NOT add `x-api-key` (that would break
the token-never-in-JS model). Result: `AppKind=BO`, audience `User+All`, `DeviceKey = StaffId = userId`.

Real gaps are small and client-side:
- **`api.get` header passthrough (REAL, small):** it can't attach a per-request header, so the poll
  can't send `x-presence: skip` — extend `api.get` to accept optional `headers`/`init`.
- **Session store:** no `staffid` field, but none needed — for a UA/BO user `StaffId == userId`.
- **Read-state (→ 026):** `DeviceKey = userId` ⇒ receipts are per-user across all tabs/machines;
  `Read` never trips `NC_NO_DEVICE`. Drop the POS's local `_ncReadIds` apparatus (its reason —
  shared-till device — is gone on web); keep at most a thin optimistic overlay.
- **Watermark (→ 026):** in-memory is correct (reload ⇒ watermark 0 ⇒ cold-start full set);
  localStorage optional.
- **Receive scope (→ 026):** BO caller has `StoreCode = null`, so `AudienceKind=Store` items never
  reach the web portal — only `User` + `All`. Confirm that's the intended scope.

Config prereq (not code): `CookieAuth:Enabled = true` on the portal's SIS.Api instance — already on.
