# Notification Center — morning report

_Things that need **you** (HITL), and what got done overnight. Read this first. Plan:
[NC-AFK-HANDOFF.md](NC-AFK-HANDOFF.md)._

_Last updated: overnight build session (post `/to-tickets`)._

---

## ✅ Tree committed clean — build can start

The working tree is **now clean**, committed on your instruction at **`23e3400`**
(`feature/active-sessions-pos-chip`), in two commits:
- `4038cd5` — **tracker docs**: the whole NC map (023 → spec 031 → tickets 032-038) + handoff/report,
  plus the cache-reset planning docs. Docs only.
- `23e3400` — **wip snapshot**: the in-flight al-dawaa rebrand + pricing-simulation/coupons work that
  was sitting uncommitted (typecheck clean at commit time; not authored this session).

The earlier dirty-tree blocker is resolved. **The NC build branches off this HEAD** (not `main` — the
tickets live on this branch); see [NC-AFK-HANDOFF.md](NC-AFK-HANDOFF.md) → Branch. The remaining
blockers below are about the backend/runner, not the tree.

## ⚠️ Decisions / blockers waiting on you

### 1. Backend endpoint `GET Notifications/Access` does not exist (blocks 038's verification)
The compose access soft-gate (ticket [038](038-nc-compose-access-gate.md)) needs a new SIS.Api
endpoint reporting the `NotificationBroadcast[01]` grant, mirroring the existing `Sessions/Access` /
`Pricing/Access` probes. It lives in the **other repo** (`C:\Work\DMSCO\BackOffice`) — I did not
build cross-repo backend contracts unilaterally.
- **Your call:** (a) I build the endpoint in the backend repo next session, or (b) 038 stays on the
  graceful-degradation path (server-authoritative `NC_FORBIDDEN` only, nav shown to all) until you
  schedule the backend work.
- The **client half** of 038 is built to tolerate the endpoint's absence (probe 404 ⇒ show screen,
  let the server decide), so nothing else is blocked.

### 2. Test runner not installed — verify by typecheck + drive?
vitest/RTL aren't installed (CLAUDE.md: deferred to the hardening ticket). I did **not** bootstrap
them as a side-effect of this feature — that's a repo-wide decision.
- **Your call:** should the NC feature be the one that finally bootstraps vitest + RTL (the spec
  flags it as a candidate), or stay on typecheck + app-drive until the hardening ticket? I defaulted
  to **typecheck + drive** (least surprise). Pure functions are kept isolated so tests drop on later.

### 3. Live runtime verification needs a running SIS.Api with NC enabled
The receive chain can't be *runtime*-verified without a SIS.Api on :5111 with
`NotificationCenter:Enabled=true` and seeded notifications. If that backend wasn't up overnight,
those tickets are **code-complete + typecheck-green but not runtime-proven** (see status below) — I
did not mark them `done` on typecheck alone.

### 4. Spec seam choices (FYI — proposed, not blocking)
`/to-spec` normally checks test seams with you. Proposed: pure in-memory for the four derive/validate
functions; component (RTL) for the screens with the network stubbed at `api.ts`; no Playwright for
v1. Flag if you'd seam it differently.

---

## ✅ What got done overnight

**Planning + slicing, complete** — the whole map-to-tickets chain landed. **Implementation
intentionally not started** (see 🛑 above — dirty tree). All 7 build tickets are written and ready;
none coded yet.

| Ticket | Status | Note |
|--------|--------|------|
| 032 bell+poll+badge | ticket ready, **not coded** | tracer; blocked on clean tree |
| 033 panel+list | ticket ready, **not coded** | |
| 034 read state | ticket ready, **not coded** | |
| 035 arrivals | ticket ready, **not coded** | |
| 036 compose+store send | ticket ready, **not coded** | tracer |
| 037 fleet confirm | ticket ready, **not coded** | |
| 038 access gate | ticket ready, **not coded** | also backend-blocked (item 1) |

Branch `feature/notification-center` **not yet created** — create it off `23e3400` at the start of
the build session (see handoff → Branch).

---

## Planning phase — completed this session (for context)

- Map [023](023-web-notification-center.md) **done** — all decisions locked.
- Resolved ticket 026 (receive scope), 029 (UX prototype), 030 (spec shape).
- Spec [031](031-web-notification-center-spec.md) synthesised and `ready`.
- `/to-tickets` sliced 7 build tickets (032–038).
