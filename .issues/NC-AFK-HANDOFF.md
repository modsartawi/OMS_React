# Notification Center — AFK build handoff

_Working plan for building the Web Back-Office Notification Center (spec [031](031-web-notification-center-spec.md))
autonomously. Companion file: [NC-MORNING-REPORT.md](NC-MORNING-REPORT.md) — everything that needs a
human decision._

## Map status

Wayfinder map [023](023-web-notification-center.md) is **done** — every decision locked, spec 031
`ready`. This is the build phase.

## Precondition — clean tree ✅ RESOLVED

The tree is now **clean**, committed at **`23e3400`** on `feature/active-sessions-pos-chip`
(two commits: `4038cd5` tracker docs incl. all NC tickets/spec; `23e3400` the in-flight
rebrand + pricing WIP snapshot). The earlier blocker (uncommitted WIP on `router.tsx`/`i18n.ts`)
is gone. Build can start.

## Branch

The NC tickets + spec live on `feature/active-sessions-pos-chip` (commit `23e3400`), **not on
`main`** — so branch the build off **that HEAD**, not main, or the tickets won't be present:

```
git switch feature/active-sessions-pos-chip   # (or checkout 23e3400)
git switch -c feature/notification-center
```

One commit per ticket, message = the ticket's test-name title. Do not push or open a PR without the
human (per repo conventions). Note: this branches atop the rebrand + pricing WIP; rebase/retarget the
base at PR time once that WIP merges.

## Build order (two independent chains — the frontier is anything unblocked)

```
Receive (layout/ chrome):   032 ─→ 033 ─→ 034
                                      └──→ 035
Send (features/admin):      036 ─→ 037
                                └──→ 038  (backend-blocked verification)
```

Work top-down within each chain; the two chains can interleave. Recommended sequence for one agent:
**032 → 033 → 034 → 035 → 036 → 037 → 038**.

| # | Ticket | Delivers | Notes |
|---|--------|----------|-------|
| 032 | theBellPollsAndShowsAnUnreadBadge | bell + poll + client-derived badge; 404⇒hide | includes `api.get` header passthrough prefactor; **tracer** |
| 033 | theBellOpensAPanelListingAnnouncementsNewestFirst | dropdown panel, newest-first, read/unread styling | |
| 034 | readingAnItemDropsTheUnreadCount | read-on-click + mark-all (per-id loop) | |
| 035 | aFreshArrivalRaisesAToastAndBumpsTheBadge | `sonner` toast/banner, 15-min freshness gate | |
| 036 | composingABroadcastSendsItToAStore | compose screen + single-store send | **tracer**; nav visible to all until 038 |
| 037 | sendingToTheWholeFleetAsksForConfirmation | all-fleet confirm dialog + inline warning | |
| 038 | theComposeScreenIsHiddenWithoutTheBroadcastGrant | access soft-gate | **backend-blocked** — see morning report |

## How to work each ticket

Follow the repo's `/implement` + `/tdd` discipline: vertical tracer, red→green, one ticket per fresh
context. `/implement` owns closing a ticket (status → `done`, Proof boxes ticked, INDEX line) when
its Done-when holds.

### Verification (runner is NOT installed)

vitest/RTL are not installed in this repo (deferred to the hardening ticket). **Do not bootstrap the
runner as a side-effect of this feature** — that's a human decision (morning report). Until it lands,
verify each ticket by:

1. `npm run typecheck` — the fast loop; must stay green ticket-to-ticket.
2. **Drive the app** (`npm run dev`, proxies `/api` → SIS.Api :5111) for the app-drive action named
   in each ticket's Proof. **Requires a running SIS.Api with `NotificationCenter:Enabled`** and
   seeded notifications — if that backend isn't up, runtime verification is **blocked** (log it in
   the morning report; do not mark the ticket `done` on typecheck alone).
3. Keep every pure function (`unreadCount`, `visibleItems`, `arrivalsToToast`, `validateCompose`)
   isolated and export-only so tests drop on cleanly once the runner lands.

## Standing rules (bind every ticket)

- **api-envelope:** all server calls through `src/core/api.ts`; surface `success:false` via
  `apiErrorMessage`/`apiErrorCode`; never catch-redirect on 401.
- **i18n-zero-literal:** no user-visible literal; namespaces `notifications` (receive) + `broadcast`
  (send), registered in `src/core/i18n.ts`.
- **logical-tailwind:** `ms/me/ps/pe/start/end`, never `ml/pr/left`.
- **feature-structure:** receive bell/panel = `src/layout/` chrome (rides AppShell); compose =
  `src/features/admin/broadcast/`; register route + menu + i18n per the add-a-feature checklist.

## Reference assets

- UX fidelity: [029 prototype](029-nc-bell-panel-compose-ux.PROTOTYPE.html) — user signed off "do it
  as in the artifact".
- Contract: [024 research](024-nc-backend-contract-for-web.RESEARCH.md).
- Identity/session: [025 research](025-web-identity-session-fit.RESEARCH.md).
- Closest sibling in-repo: the Active Sessions screen (map 001) — a polling admin screen with
  client-derived counts; follow its shape.
