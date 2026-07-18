---
type: wayfinder-ticket
wayfinder: grilling
map: 023
status: done
blocked-by: 024
---

# 027 — Broadcast channel/audience model

## Question

The owner wants a compose surface that sends a general notification to a chosen **channel:
all / stores / back-office only**. The server's `AudienceKind` is **All / Store / User** — there
is **no distinct "back-office only" audience** (a BO user's poll matches `User` for their own
staffid, plus `All`). Reconcile the two and decide the v1 channel model for the compose screen:

- **"All"** → `AudienceKind=All` (reaches every POS till + BO user). Straightforward.
- **"Stores"** → target one store (`AudienceKind=Store`, `AudienceKey=storecode`), or all stores?
  All-stores-but-not-BO is not directly expressible — decide whether that's needed.
- **"Back-office only"** → the gap. Options to grill: (a) accept the limitation and offer only
  All + Store in v1; (b) approximate with per-user `User` sends (needs a user picker + is not a
  true broadcast); (c) request a new server-side audience kind (e.g. `BackOffice`) as a dependency
  — a backend change outside this repo; (d) defer BO-only to a later slice.
- **Channel → request mapping** — the exact `CreateNotificationRequest` each channel produces
  (TypeCode=Broadcast, AudienceKind, AudienceKey, Title/Body limits, optional ExpiresAt).
- **Permission** — the `NotificationBroadcast` grant gates any All/Broadcast send; note how that
  interacts with the screen's own access gate (decided in 028).

Zoom 024 for the confirmed audience kinds + broadcast permission behaviour. If option (c) is
chosen, flag the server dependency clearly (it changes the destination's reach). HITL grilling.

## Answer

Decided 2026-07-19 by the owner via `/grilling`. **No server dependency** — v1 lives entirely within
the existing `AudienceKind = All / Store / User` contract (option (a) for the BO-only gap: accept the
limitation, do not request a new `BackOffice` audience kind).

### v1 channel model — two channels

| Compose channel | `CreateNotificationRequest` mapping | Reaches | Grant |
|---|---|---|---|
| **All (fleet)** | `TypeCode=BROADCAST, AudienceKind=All, AudienceKey=""` | every POS till **+** every BO user | `NotificationBroadcast[01]` |
| **Store** | `TypeCode=BROADCAST, AudienceKind=Store, AudienceKey=<one storecode>` | till / store-mode callers at that store | `NotificationBroadcast[01]` |

- **Store targeting = a single store per send** (reuse the existing open-stores picker fed by
  `GET SdDocument/StoreDetails` via `lookupQueries`). Multi-select and "all stores" are **out of v1**
  (multi-select is a trivial follow-on loop of N Creates; "all stores but not BO" is not expressible —
  point users at All).
- **"Back-office only" is out of v1.** The server has no BO-group audience (a BO poll only matches
  `All` + `User`=own staffid), and a per-user `User` send isn't a true broadcast. Ruled out rather
  than taking a cross-repo server change. Revisit only if a `BackOffice` audience kind is ever added.

### Every send is `TypeCode=Broadcast`

Locks the seeded registry defaults (024 RESEARCH §Constants): **DisplayStyle=`Banner`**,
**ReadScope=`Device`** (per-device read receipt, **not claimable** — an announcement isn't a work
item), **NavRoute=`""`** (text-only, **no deep-link**), `PlaySound=false`, `IsRealtime=false`,
30-day default lifetime. Consequence: **one grant governs the whole screen** — both channels are
`TypeCode=Broadcast`, so both are grant-gated; there is no ungated send path.

### Compose form

`Title` (required, ≤200) · `Body` (required, ≤1000) · channel selector (All / Store+picker) ·
**optional** `ExpiresAt` date-time — blank ⇒ 30-day type default; when set, the client validates it
is in the **future** to preempt the server's `NC_BAD_EXPIRY`. No `DeadlineAt` (SLA is for order
types), no `EntityId`/`DedupKey`/deep-link fields in v1.

### Permission

The whole compose screen soft-gates on the single **`NotificationBroadcast[01]`** grant. Mechanism
is [028](028-access-gating-and-grants.md)'s decision: menu `accessProbe` + in-page guard both call the
**new** `GET Notifications/Access → { canOpen }` endpoint (cookie-gated backend dependency), sharing
one react-query key. The server `Create` gate stays authoritative and surfaces `NC_FORBIDDEN`
verbatim as the backstop; the probe is show/hide hygiene only.

### Handoff notes for `/to-spec`
- **Backend dependency (from 028):** `GET Notifications/Access` does not exist yet — flag it.
- Client `api.post` already carries a body; no api-envelope change needed for Create (unlike the poll
  side's `x-presence` header gap in 025).
