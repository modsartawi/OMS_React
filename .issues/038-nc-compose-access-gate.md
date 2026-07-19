---
status: code-complete
spec: 031
blocked-by: 036
---

# 038 — theComposeScreenIsHiddenWithoutTheBroadcastGrant

> **Build note (client-complete; backend dep open):** client half code-complete, `npm run typecheck`
> + `npm run build` green. The graceful-degradation path is what's exercised: `GET Notifications/Access`
> does NOT exist in SIS.Api, so the probe maps a 404 to `allowed=true, probed=false` → nav shown, page
> shown, server-authoritative `NC_FORBIDDEN` is the backstop. A real granted/denied path can't be
> verified until the backend endpoint ships (HITL decision — see Open questions + morning report #1).

## What to build

The compose screen soft-gates on the `NotificationBroadcast` grant. A new **`GET Notifications/Access`**
probe reports whether the caller holds `BackOfficeScreen[CONTROLLER='NotificationBroadcast',
COMMAND='01']`. When denied: the "Send Broadcast" nav item is **hidden** (permission-aware nav, same
`accessProbe` pattern the rest of the portal uses) and a direct URL hit shows a soft **"You don't
have access"** gate naming the grant. When granted: the screen works as 036/037 built it. The server
`Create` stays authoritative — a lost grant still refuses on send with `NC_FORBIDDEN`.

**Graceful degradation:** until `GET Notifications/Access` exists server-side (see Open questions),
treat an absent/`404` probe as "unknown → show the screen and let the server decide" so the feature
isn't blocked on the backend — the `NC_FORBIDDEN` path from 036 is the backstop.

## Spine reach

api (`broadcastAccess()` probe over `core/api.ts`) · logic (menu `accessProbe`; screen gate state) ·
component (hidden nav + denied gate) · i18n (denied-gate copy) · test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `deniedHidesTheNavAndShowsTheGate` — component (probe stubbed denied): no nav item; route ⇒ gate · component
- [ ] `grantedShowsTheComposeScreen` — component (probe stubbed granted) · component
- [ ] `absentProbeFallsBackToServerAuthority` — component (probe 404 ⇒ screen shown) · component
- App-drive fallback: toggle the grant seed ⇒ nav appears/vanishes; direct URL when denied ⇒ gate.

## Boundaries

New API dependency `GET Notifications/Access` — **does not exist in SIS.Api yet** (backend/cross-repo
dependency; mirrors `Sessions/Access` / `Pricing/Access`). New i18n keys. Menu `accessProbe`. `—`
runner.

## Done when

Without the grant the nav item is hidden and the compose route shows the access gate; with it the
screen works; and an absent probe degrades to server authority — proven by the component tests green
(or the app-drive action) with typecheck clean.

## Blocked by

[036](036-nc-compose-send-store.md)

## Open questions

- **Backend dependency (HITL):** `GET Notifications/Access` must be added to SIS.Api before this
  ticket can be fully verified against a real grant. Decision for the human: build the endpoint in
  the backend repo (`C:\Work\DMSCO\BackOffice`, mirroring the `Sessions/Access` probe), or keep this
  ticket on the graceful-degradation path (server-authoritative only) until the endpoint is
  scheduled. The client half can be built and typecheck-verified now regardless.
