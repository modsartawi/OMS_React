---
type: wayfinder-ticket
wayfinder: grilling
map: 023
status: done
blocked-by: 024, 025
---

# 026 — Receive-side parity scope for the back-office

## Question

Which POS NC receive-side behaviours port literally to the web back-office v1, which adapt, and
which are cut? The POS is a shopfloor till; the back-office is a browser user — so parity is not
automatic. Decide, per behaviour:

- **SLA countdowns** — do back-office notifications carry live deadlines worth a ticking "time
  left" column, or is created-time ordering (newest-on-top) enough for v1? (POS floated
  soonest-deadline SLA orders to the top.)
- **Claim** — confirmed in scope (future inbound-orders agent pool claims an order to complete
  missing customer data + contact the customer). Decide the v1 surface: is claim wired now against
  the existing server endpoint, or is the UI built but the agent-pool workflow deferred? What does
  a claimed row look like to other back-office users (greying / "Claimed by X")?
- **In-app banner/toast** — POS popped a single sticky card with slot policy + freshness window.
  Web has `sonner`. Decide: reuse `sonner` toasts, a bespoke banner, or badge-only for v1? Which
  DisplayStyles surface (Toast/Banner) vs. stay silent (Badge)?
- **Read / traffic-light model** — mark-all-read-on-open, the red/amber/green fill, the
  "red = new since you last looked" snapshot. What survives into the web list?
- **Expiry/purge** — the POS swept expired items client-side (no rowversion announces expiry).
  Does the web client need the same sweep, or does the poll filter suffice?

Zoom 024 (poll-item fields available) and 025 (browser read-state constraints) before deciding —
several of these hinge on what the contract actually exposes and what a browser device identity can
support. HITL grilling. On resolution, graduate the deep-link route map and the UX prototype from
the map's fog.

## Answer

**Root frame — (A) "Broadcasts-and-jobs" v1.** A BO caller receives only `All`+`User` audience
rows, never `Store` (024). The SLA/order types (`NEW_ORDER`/`SLA_ORDER`) are Store-audience,
producer-minted, so **they never reach the web portal today**. v1 receive surface is therefore
**`BROADCAST`** (Banner, gated) + **`JOB_DONE`** (Toast) + **`NC_TEST`** (smoke). Order alerts,
SLA, and the order-claim workflow are **out of v1**, carved out as a later effort gated on a
backend producer/audience change (see new fog item).

Per-behaviour parity decisions:

- **SLA countdowns — CUT.** No `DeadlineAt`-carrying type reaches BO in v1. List order is
  `CreatedAt` desc (newest-on-top); the soonest-deadline sort and SLA banner-slot preemption are
  removed. Returns with order alerts.
- **Claim — CUT.** The only `ReadScope=Claim` type a BO caller sees is `NC_TEST`; the real
  order-claim workflow (agent pool completes customer data) has no subject under (A). v1
  announcements are **read-only**. `Status`/`ClaimedBy*` stay understood in the model but drive no
  UI. The claimed-row design (greying, "Claimed by X", first-wins/loser-learns-winner) is deferred
  to the order-alerts effort where it has a real subject.
- **Arrival banner/toast — `sonner` for both styles.** `DisplayStyle=Toast` (`JOB_DONE`,
  `NC_TEST`) → default auto-dismiss `sonner` toast (~8s). `DisplayStyle=Banner` (`BROADCAST`) →
  a persistent `sonner` toast (`duration: Infinity`) + dismiss action. **15-min `CreatedAt`
  freshness gate** so a cold-start backlog doesn't re-pop. No sound (no v1 type sets `PlaySound`).
  No bespoke banner chrome in v1 (a possible later polish, not needed now). `Badge`-only styling is
  moot — no v1 type is `Badge`.
- **Read model — binary unread/read; traffic-light CUT.** Both v1 real types are **Device-scope**,
  so `IsRead` receipts server-side per-user (device = staffid, 025) and rehydrates on reload. v1:
  **read-on-click** (one per-id `POST Notifications/{id}/Read`) + an explicit **"Mark all as read"**
  that loops per-id (no bulk endpoint exists). **No** mark-all-read-on-open (opening the panel does
  not silently zero the badge). Drop the POS local `_ncReadIds` set (025); keep only a thin
  optimistic overlay, with `IsRead` from poll as source of truth. Badge count computed client-side:
  `Status==Active` ∧ `ExpiresAt > now` ∧ `!IsRead`. No red/amber/green fill; unread = visual
  emphasis, read = muted.
- **Expiry/purge — client-side `ExpiresAt` filter.** The poll is a rowversion delta and expiry
  does not bump the rowversion, so an already-delivered item is never *announced* as expired. Apply
  the `not-expired` predicate (already in the badge formula) when rendering the list, and drop
  expired items from the in-memory store so it doesn't grow. No forced cold-start re-baseline
  (reload re-baselines at watermark 0). v1 expiries are long (30-day broadcasts, 7-day jobs) so
  staleness is nearly a non-issue; the filter keeps the model correct regardless.

**Grounding:** contract facts from [024 research note](024-nc-backend-contract-for-web.RESEARCH.md)
(type registry: `BROADCAST`=Banner/Device/30d, `JOB_DONE`=Toast/Device/7d, `NC_TEST`=Toast/Claim/7d;
BO audience = User+All only); browser identity facts from [025](025-web-identity-session-fit.md)
(device=staffid per-user, `api.get` header passthrough gap, drop `_ncReadIds`).

**Fog effects:** the **deep-link route map** fog stays **parked** — nothing routable
(`NavRoute=OmsDocument` + `EntityId`) reaches a BO caller in v1, so there is no route map to spec
yet; it graduates only with the order-alerts effort. The **bell/panel/compose UX prototype** fog is
now specifiable on the receive side (bell + unread badge + panel list + `sonner` arrivals +
read-on-click). A **new fog item** is added to the map: back-office order alerts (producer/audience
change + SLA rendering + claim UX) — the deferred effort (A) carved out.
