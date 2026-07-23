---
status: code-complete
spec: 031
blocked-by: —
---

# 036 — composingABroadcastSendsItToAStore

> **Build note (runtime-blocked):** code-complete, `npm run typecheck` green. Runtime app-drive
> deferred (SIS.Api :5111 down — POST Notifications not exercised). Pure `validateCompose` +
> `toCreateRequest` isolated for the runner. New `features/admin/broadcast/` feature registered
> (route + Admin menu item + `broadcast` i18n namespace). Store picker reuses `lookupQueries.storeDetails`.

## What to build

The **tracer bullet** for Send. A "Send Broadcast" screen under `features/admin/` (nav group Admin,
route registered) with the compose form: **Title** (≤200, live counter) + **Message** (≤1000, live
counter) both required; a **Send to** segmented control **Whole fleet** / **One store**; when "One
store" is chosen, the existing open-stores picker selects one storecode; an optional **Expires**
date. **Send** is disabled until valid (with an inline validity hint). Submitting a **One store**
broadcast posts `POST Notifications` with `TypeCode='BROADCAST'`, `AudienceKind='Store'`,
`AudienceKey=<storecode>`, title/body, optional future `ExpiresAt` (blank ⇒ omitted ⇒ server 30-day
default). On success: a confirmation toast ("Broadcast sent — Delivered to <store>") and the form
resets. A server refusal surfaces its envelope message.

Retires the unknown: **does `POST Notifications` accept a broadcast from the web client?** (All-fleet
confirmation is 037; the access gate is 038 — this slice ships the nav visible to everyone in the
interim.)

## Spine reach

model/api (`CreateNotificationRequest` shape + `createBroadcast()` over `core/api.ts`) · logic (pure
`validateCompose(form)` → valid + hint) · component/route (compose screen + `router.tsx` +
`menu-model.ts`) · i18n (`broadcast` namespace) · test/drive.

## Proof (→ `tdd` red-green cycles)

- [ ] `validateComposeEnforcesTitleAndBodyLimits` — pure · pure
- [ ] `aStoreBroadcastPostsTheRightAudience` — component (RTL, `create` stubbed): submit ⇒ one POST with `AudienceKind=Store` + storecode · component
- [ ] `sendIsDisabledUntilValid` — component · component
- App-drive fallback: fill the form, pick a store, Send ⇒ success toast + reset; typecheck clean.

## Boundaries

New API dependency `POST Notifications` — handle `success:false` codes `NC_BAD_REQUEST`,
`NC_BAD_EXPIRY`, `NC_BAD_AUDIENCE`, `NC_FORBIDDEN` (surface the message). New i18n namespace
`broadcast` (register). New Admin route + menu item (visible to all until 038 gates it). `—` runner.

## Done when

An operations administrator can compose and send a single-store broadcast and see it confirmed —
proven by `aStoreBroadcastPostsTheRightAudience` green (or the app-drive action) with typecheck
clean.

## Blocked by

None — can start immediately (independent of the Receive chain).
