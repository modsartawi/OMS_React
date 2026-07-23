---
type: wayfinder-ticket
wayfinder: grilling
map: 023
status: done
blocked-by: 024
---

# 028 — Access gating & grants (bell + compose screen)

## Question

How is each surface access-gated, mirroring the Active Sessions pattern (ticket 003 — a screen
gates on its own grant, hidden from the menu when the user lacks it)?

- **The bell + notification panel** — is it always on for any authenticated back-office user (the
  poll's `User+All` audience is inherently per-user, so there's nothing to over-expose), or does it
  sit behind a grant? Default expectation: always on, no gate. Confirm.
- **The compose/broadcast admin screen** — which grant gates the *screen* in the web menu, and how
  does it relate to the server-side `NotificationBroadcast` permission that gates the actual `POST`?
  Options: reuse `NotificationBroadcast` as the menu `accessProbe`; a distinct screen grant; or an
  existing admin grant. Decide the `accessProbe` call and menu placement (`features/admin/…`).
- **Claim authorization** — is claim available to every BO user who can see the item, or gated to
  the future inbound-orders role? (Server allows any in-audience Claim-scope caller today.) Decide
  v1 vs. later, cross-referencing the claim scope decision in 026.

Zoom 024 for the `NotificationBroadcast` permission contract and 003
(`.issues/003-active-sessions-access-grant.md`) for the established gating pattern. HITL grilling.

## Answer

Decided 2026-07-19 by the owner via `/grilling`. Three gates, resolved independently.

### 1. Bell + notification panel — **always on, no grant**

The bell and its panel render for **every authenticated back-office user** — no `accessProbe`,
mirroring the un-gated `deliveries` menu item, NOT the Active Sessions pattern.

Rationale: the receive rail is inherently per-user. A BO caller sends no `registerid`, so the poll
matches only `AudienceKind=All` OR `AudienceKind=User` keyed to the caller's own `staffid`
(024 RESEARCH §1). The server *constructs* the audience from the caller's identity — there is no
shared feed to over-expose, so a grant would gate nothing but a person's view of their own items.

The only thing that hides the bell is the **feature flag**: a `404` from `Notifications/Poll` means
`NotificationCenter:Enabled` is off → treat as "feature off, hide the bell" (a definite signal, not
an error to surface) (024 RESEARCH §6). That flag gate comes for free, independent of any grant.

### 2. Compose / broadcast admin screen — **reuse `NotificationBroadcast[01]` as the screen `accessProbe`** (option a)

The screen-you-can-see == the screen-you-can-use. The menu leaf and the in-page route-guard both
probe the **same** grant the server already enforces on the send:
`BackOfficeScreen[CONTROLLER='NotificationBroadcast', COMMAND='01']`, fail-safe DENY, checked inside
`Create` for `TypeCode==BROADCAST` OR `AudienceKind==All` (024 RESEARCH §4). Zero grant divergence —
rejected (b) a distinct screen grant (would show the screen to someone who then eats `NC_FORBIDDEN`
on submit) and (c) reusing an existing admin grant (over-broad, couples broadcast to identity admin).

**Menu placement:** `features/admin/…`, URL `/admin/*`, sibling of Active Sessions (Admin nav group).

**⚠ BACKEND DEPENDENCY (must not be forgotten):** the probe needs a **new standalone endpoint**
`GET Notifications/Access → { canOpen }` that checks `NotificationBroadcast[COMMAND='01']` for the
acting staffid — **cookie-gated, NOT grant-gated** (like every other screen's `Access` route, e.g.
`UaAdminWeb/Sessions/Access`). This endpoint **does not exist today**: 024's research documents the
grant only as enforcement *inside* `Create`, never as a queryable probe. The web menu `accessProbe`
and the compose page's own guard share one react-query key (e.g. `['notification-compose','access']`,
`visible: (r) => r.canOpen === true`) so it dedupes to one call. The server `Create` gate stays
authoritative; this probe is show/hide hygiene only.

### 3. Claim authorization — **deferred from v1** (option b)

Claim is **not wired** in the v1 receive-side. No claim button, no inbound-orders grant now.

Rationale: there is nothing meaningful for a BO user to claim yet. The routable OMS order types
(`NEW_ORDER`/`SLA_ORDER`) are minted **Store**-audience by an in-process producer, so a BO poll never
surfaces them (024 RESEARCH open-Q1); the only BO-claimable item today is an `All`-audience `NC_TEST`.
And the consumer — the future inbound-orders agent pool that would claim an order to complete missing
customer data + contact the customer (026) — does not exist. A claim affordance now would be dead UI.

When the inbound-orders workflow lands, **it** decides whether claim is open-to-all-in-audience
(the server's current in-audience rule, 024 RESEARCH §2) or gated to a dedicated role — that role
question belongs with that workflow, not guessed here. Cross-ref 026's claim-scope decision.

**028 ships exactly two gates:** bell = ungated (feature-flag only); compose = `NotificationBroadcast`
via a new `Notifications/Access` probe. Feeds the map's spec.
