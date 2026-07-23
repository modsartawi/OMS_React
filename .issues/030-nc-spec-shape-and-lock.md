---
type: wayfinder-ticket
wayfinder: grilling
map: 023
status: done
blocked-by: 026, 027, 028, 029
---

# 030 — Lock the NC spec shape & hand off to /to-spec

## Question

The last decision before the map's destination. Every substantive NC decision is now locked —
backend contract (024), identity fit (025), receive scope (026), broadcast channel model (027),
access gating (028), and the bell/panel/compose UX (029). Decide the **shape of the spec artifact(s)**
and drive the handoff:

- **One combined NC spec vs. two (receive + send)?** They share the contract, identity, and
  enablement facts but are otherwise independent surfaces (cross-cutting bell/panel chrome in
  `layout/` vs. an admin compose screen in `features/admin/`), gated differently (bell ungated vs.
  compose on `NotificationBroadcast[01]`). Weigh a single coherent spec against two independently
  buildable ones. Recommendation to react to: **one combined spec** with clearly separated
  Receive / Send sections, since they share so much contract surface and ship as one feature effort.
- **Client-side prerequisites to fold in** — the small gaps 025 surfaced that the spec must call
  out: `api.get` per-request header passthrough (for `x-presence: skip`), the new
  `GET Notifications/Access` probe (028) the compose soft-gate needs, and treating a poll 404 as
  "feature off" (hide the bell).
- **Explicit non-goals to record** so `/to-tickets` doesn't slice them in: SLA/claim/order-alerts
  (deferred effort), deep-link routing (parked), SignalR real-time wake (deferred enhancement),
  presence ops view (out of scope).

On resolution: run `/to-spec` to synthesize the spec from the map's Decisions-so-far + the four
linked assets (024/025 research, 029 prototype), set it `ready`, then the map is done → `/to-tickets`
for the build. HITL.

## Answer

**Decision: one combined spec** (user's call), with clearly separated Receive and Send sections so
`/to-tickets` still slices independent build tickets. Rationale: the two halves share the entire
backend contract, identity fit, and enablement facts and ship as one feature effort — splitting
would duplicate the preamble and risk drift; separate release timelines (the only reason to split)
aren't wanted here.

Spec synthesised and published **`ready`**:
[031 — Web Back-Office Notification Center (spec)](031-web-notification-center-spec.md). It folds in
the client prerequisites (the `api.get` per-request header passthrough; the new
`GET Notifications/Access` probe as an explicit **backend dependency**; poll-404 ⇒ feature-off) and
records the explicit non-goals (SLA/claim/order-alerts deferred, deep-link parked, SignalR wake
deferred, presence view out of scope) so `/to-tickets` won't slice them in.

**Map 023's destination (a ready spec) is reached** — all decisions locked, spec `ready`. Handoff:
`/to-tickets` on spec 031 for the build. The deferred items (SignalR real-time wake; back-office
order alerts) live on as **future efforts** recorded in the spec's Out of Scope, not open frontier.
