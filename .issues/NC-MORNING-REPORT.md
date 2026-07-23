# Notification Center — morning report

_Things that need **you** (HITL), and what got done overnight. Read this first. Plan:
[NC-AFK-HANDOFF.md](NC-AFK-HANDOFF.md)._

_Last updated: build session — all 7 tickets (032–038) coded._

---

## ✅ Build done — all 7 tickets code-complete (typecheck + build green)

The full Receive + Send build is on branch **`feature/notification-center`** (off `fb5f99f`), one
commit per ticket (`5f5e509`..`db2ced4`), message = each ticket's test-name title. `npm run typecheck`
and `npm run build` are green at HEAD.

**⚠️ Not runtime-proven.** SIS.Api :5111 was **down** this session, so no ticket was app-driven — each
is marked **code-complete**, not `done` (per the "don't mark done on typecheck alone" rule). Pure
functions (`unreadCount`, `visibleItems`, `arrivalsToToast`, `validateCompose`) are isolated and
export-only so tests + a real app-drive drop on cleanly. **To close to `done`:** bring up a
NC-enabled SIS.Api on :5111 and drive each ticket's Proof app-drive action.

What was built:
- **Receive** (`src/layout/notifications/`): bell + 30s poll + client-derived badge (404 hides it);
  dropdown panel (newest-first, type tags, read/unread, empty state); read-on-click + mark-all
  (optimistic); sonner arrivals (Toast auto-dismiss / Banner persistent + View) behind a 15-min
  freshness gate, badge pop in lock-step.
- **Send** (`src/features/admin/broadcast/`): compose screen (counters, segmented channel, open-stores
  picker, expiry, validity-gated Send); all-fleet confirm dialog + inline warning; access soft-gate on
  the graceful-degradation path.

---

## ✅ Tree committed clean — build can start (historical)

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

### 1. ✅ RESOLVED — `GET Notifications/Access` now exists
The compose access soft-gate (ticket [038](038-nc-compose-access-gate.md)) needed a SIS.Api endpoint
reporting the `NotificationBroadcast[01]` grant, mirroring `Sessions/Access` / `Pricing/Access`.
**Built** in the backend repo (`C:\Work\DMSCO\BackOffice`, branch `pricing2`, commit `dc73ba1f`):
`NotificationEndpoints.Access` → `{ canBroadcast }`, cookie/api-key-gated (not grant-gated), reusing
the same `INcBroadcastPermissionService.IsAllowedAsync` the `Create` door enforces. SIS.Api builds
clean (0 errors). The grant seed (`002_seed_broadcast_permission.sql`) already existed.
- **Still pending:** a **deploy + runtime drive** to verify the real granted/denied path (SIS.Api was
  down this session). The client's 404-graceful fallback remains as a safety net for older environments.
- **Note:** committed onto `pricing2` (its unrelated WIP untouched) — move/cherry-pick if you want it
  on its own branch at PR time.

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

## ✅ What got done

**Planning + slicing** (earlier session) and **the full build** (this session) are complete.

| Ticket | Status | Commit | Note |
|--------|--------|--------|------|
| 032 bell+poll+badge | **code-complete** | `5f5e509` | tracer; + api.get header prefactor |
| 033 panel+list | **code-complete** | `e75dd3d` | |
| 034 read state | **code-complete** | `0c3072d` | optimistic overlay + mark-all loop |
| 035 arrivals | **code-complete** | `11f97f4` | 15-min freshness gate; Toast/Banner |
| 036 compose+store send | **code-complete** | `bc4c28e` | tracer; new features/admin/broadcast |
| 037 fleet confirm | **code-complete** | `061ebab` | reuses confirmAction service |
| 038 access gate | **code-complete** (client) | `db2ced4` | graceful-degradation path only (item 1) |

All typecheck + build green. None runtime-proven (SIS.Api :5111 down, item 3). Branch
`feature/notification-center` created off `fb5f99f`. **Not pushed / no PR** (per repo conventions —
awaiting your go). Rebase/retarget onto the rebrand+pricing WIP at PR time.

---

## Planning phase — completed this session (for context)

- Map [023](023-web-notification-center.md) **done** — all decisions locked.
- Resolved ticket 026 (receive scope), 029 (UX prototype), 030 (spec shape).
- Spec [031](031-web-notification-center-spec.md) synthesised and `ready`.
- `/to-tickets` sliced 7 build tickets (032–038).
