---
status: code-complete
blocked-by: 124
---

# 125 — OMS goes behind an access probe, and its write doors stop being open

## What to build

The gate the OMS area never had: repoint `features/oms/*` at the new cookie-only
`SdDocumentWeb/*` door, add the `access()` call, hang an `accessProbe` on the OMS menu leaf, and give
**both** OMS pages the in-page denied backstop every other gated screen already has.

Backend contract:
[BackOffice 750](C:\Work\DMSCO\BackOffice\.issues\750-sddocument-web-door.md), grants seeded by
[BackOffice 749](C:\Work\DMSCO\BackOffice\.issues\749-oms-web-screen-grant-seed.md).

### What is actually open right now

`menu-model.ts:23-29` names deliveries as *the* example of "ABSENT = always visible", and it is the only
nav group with no probe. That is not just a visible menu item — every OMS endpoint on the server carries
`ApiKeyEndpointFilter` and no grant filter, including `UpdateDocument`, `UpdateDelivery`,
`RescheduleDocument` and `RescheduleDelivery`. So **any** authenticated session — including a store
employee who has just activated and holds no role at all — can list delivery documents, deep-link into
`/oms/document/:no`, and reschedule or update one, and the server will accept it. 750 closes the server
half; this ticket is the client half and the reason the server half is reachable.

### Path swap

`features/oms/deliveries/api.ts` — one line — and `features/oms/document/api.ts` — eight — move from
`SdDocument/…` to `SdDocumentWeb/…`. Payload shapes are identical by 750's Boundaries, so the models in
`core/models/` do not move. `Slots/AvailableSlots/{storeCode}` **stays put** (750 OQ2).

`deliveries/api.ts` currently exports a bare `searchDeliveries` function rather than the `<x>Api` object
every gated feature uses. Fold it into a `deliveriesApi` object alongside the new `access()` so the probe
and the query read the same way here as everywhere else.

### The probe

One shared cache entry, the house rule: the menu's `accessProbe.key` **must equal** the page guard's
`useQuery` key so a gated screen costs one network call, not two.

```
key:     ['oms', 'access']
run:     () => deliveriesApi.access()          // GET SdDocumentWeb/Access
visible: (r) => r.canOpenList === true          // the LEAF's visibility
```

`SdDocumentWeb/Access` returns `{ canOpenList, canOpenDetail }` (750). New
`OmsAccessResult` in `core/models/`, carrying the `BackOfficeScreen[DocumentList,03]` /
`BackOfficeScreen[DocumentDetails,03]` grant names in its doc comment — the convention every other access
model follows, and the only place those strings appear client-side.

**This probe fails closed.** No 404-tolerant catch, unlike `Notifications/Access` and `Bby/Access`, which
degrade to allowed because their endpoints did not exist server-side yet. Here the endpoint ships with
750 and the thing behind it is a write door, so an unreachable probe must hide the screen, not reveal it.
That means **125 cannot merge before 750 is deployed** — it would hide OMS from the OMS team.

### Both pages get a guard, not just the list

`DeliveriesPage` guards on `canOpenList`; `DocumentDetailsPage` guards on **`canOpenDetail`**. The second
is the one that is easy to skip and the one that matters: `/oms/document/:no` is a deep-linkable route
with no guard of its own today, and `router.tsx` has no per-route permission metadata — every child just
hangs off `ProtectedLayout`, which checks authentication and never inspects grants. A guard only on the
list would leave the write screen reachable by anyone who knows a document number.

Both follow `UaAdminUsersPage.tsx:39,74-89`: pending → checking state, `!== true` → denied card with
`role="alert"`, and every dependent query `enabled: access.data?.canOpenX === true` so a denied user
fires no follow-up requests.

### The group vanishes — which is the point

`useVisibleMenu` drops a group whose children all hid, so a denied user loses the whole OMS section from
the sidebar *and* from the home page's section cards. For a user with no other grants that leaves the
menu completely empty — which is precisely the state
[124](124-no-visible-menu-empty-state.md) built the `noAccess` card for. 124 first, then this.

## Spine reach

api (path swap + `access()`) · model · menu · component (two page guards) · i18n · test (drive)

## Proof (→ `tdd` red-green cycles)

- [x] An entitled session sees the OMS group, opens the list, and opens a document — unchanged behaviour
      end to end against the new paths · **flow (Playwright, new `tools/oms-access-drive.mjs`)**
- [x] `canOpenList: false` → the OMS group is absent from the sidebar **and** from the home page cards ·
      **flow (same drive)**
- [x] `canOpenList: false` + deep link to `/oms/deliveries` → the denied card, and **no**
      `DeliveryDocumentList` request is fired · **flow (same drive)**
- [x] `canOpenList: true, canOpenDetail: false` → the list opens, the deep link to `/oms/document/:no`
      shows the denied card · **flow (same drive)** — the split the single-grant shortcut would lose
- [x] A failed/unreachable probe hides the screen rather than revealing it · **flow (same drive)**
- [x] The menu probe and the page guard share one cache entry — exactly one `SdDocumentWeb/Access`
      request per page life · **flow (same drive)**

## Boundaries

No change to what the OMS screens *do* — no column, dialog, filter or payload moves. The client never
sends or compares a grant string; the wire contract is booleans on an `Access` result, as everywhere
else. `ProtectedLayout` and `router.tsx` are **not** touched: route-level permission metadata would be a
new concept in this app, and the two in-page guards cover the same ground with the pattern already in
use.

**i18n:** `access.checking` / `access.deniedTitle` / `access.deniedHint` into `deliveries.json` and
`document.json`, matching the families the other gated namespaces carry.

**Concurrency:** owns `tools/oms-access-drive.mjs` and **drive port 5206**. Work in a git worktree.

## Done when

Driving the app: an entitled user works the OMS screens exactly as before on the new paths; a denied user
sees no OMS group, gets the denied card on both deep links, and fires no data request; the probe is one
call shared by menu and page. `npm run typecheck` and `npm run lint` green. And the check that closes the
original hole: **a reschedule attempted by a session without `canOpenDetail` is refused by the server**,
not merely hidden by the client.

## Blocked by

- [124](124-no-visible-menu-empty-state.md) — gating OMS makes the empty menu common; the `noAccess` card
  and its settled flag must exist first or every user gets a flash of blank home page.
- [BackOffice 750](C:\Work\DMSCO\BackOffice\.issues\750-sddocument-web-door.md) — the door and the probe
  this calls. **Deployed**, not merely merged: the probe fails closed, so shipping this against an API
  without `SdDocumentWeb/Access` hides OMS from everyone.

## Open questions

1. **Do OMS agents already hold the role on day one?** The grant is only resolvable for a principal with
   a `UaUser` row, and that row is minted by **first role assignment in Authz Admin** — creating an
   employee in UA Admin does not make one. Before this merges, someone must confirm the current OMS team
   is bound, or the gate locks out the people it is meant to admit. This is an operator action, not a
   code change, and it is the single most likely way this ticket goes wrong.
2. **Does the deliveries list need its own grant separate from the document detail?** Assumed yes (two
   grants, per 749). If 749 lands one combined grant, `OmsAccessResult` collapses to one bool and Proof
   box 4 goes away.

## Comments

**2026-07-26 — built, `code-complete` not `done`.** `tools/oms-access-drive.mjs` (port 5206, wire
fully stubbed) is **28/28**; `typecheck`, `lint`, `build` and `npm test` (261) green. Every Proof box
is ticked against that drive. What is NOT proven, and why this is not `done`: SIS.Api was not
running, so nothing here has met a real `SdDocumentWeb/*` door. The Done-when clause that closes the
original hole — **a reschedule attempted without `canOpenDetail` is refused by the server** — and the
entitled-user pass against live 750 both still need a run once 750 is deployed. Open question 1
(is the OMS team bound to the role?) is likewise still an operator action, unanswered.

**Deviation from the written design — the probe lives in `@/core/oms/api`, not on `deliveriesApi`.**
The ticket spelled `run: () => deliveriesApi.access()`. Both OMS pages guard on this call, and a
feature may never import another feature (`.claude/rules/feature-structure.md`), so putting it on
`deliveriesApi` would have forced either a boundary violation or a second copy of `access()` in
`document/api.ts` with the cache key re-spelled at three sites. Instead `@/core/oms/api.ts` exports
`OMS_ACCESS_KEY` + `omsAccessApi.access()` — exactly the move ticket 118 made for the bonus-buy probe,
for the same reason. `searchDeliveries` still folded into `deliveriesApi.search` as asked.

**Two things the reviews found and this change fixes beyond the letter of the ticket:**

1. *`staleTime` had to match, not just `retry`.* `useVisibleMenu` probes with
   `staleTime: Infinity, retry: false`. A page guard registering the same key with the global
   default (`staleTime: 0`) marks the shared entry stale and **refetches on mount** — one call
   became two on an in-app navigation, and a second answer that failed would have emptied the OMS
   group from the sidebar while the operator stood on a working list. Both guards now carry the
   menu's options verbatim. New drive box: *navigating INTO the screen in-app re-asks nothing*.
2. *A failed probe is a server fault, not a missing grant.* Fail-closed is right, but the denied
   copy told a fully entitled operator to go ask for a permission they already hold — which is
   exactly the state a not-yet-deployed 750 produces. `access.isError` now renders
   `access.unavailableTitle` / `unavailableHint` (two keys per namespace beyond the three the ticket
   listed) with the envelope message via `apiErrorMessage`. The screen stays closed either way.

**Blast radius the ticket did not mention: eight sibling drives.** `document-{detail,actions,band,
cards,items,rail,rtl}-drive.mjs` and `grid-theme-drive.mjs` all stub `SdDocument/Document|Delivery|
Update*` and fell through to a catch-all `envelope({})` for the new probe — post-swap every one of
them met the denied card. All eight repointed and answer `SdDocumentWeb/Access`; re-run green
(39/38/36/34/45/23/25/33).

**Deliberately NOT swapped, and now commented at the code:** the five session-stable lookups in
`core/services/lookups.ts` (`DocumentTypes`, `DocumentSources`, `DeliveryDocumentTypes`,
`StoreDetails`, `Districts`) stay on the ungated `SdDocument/*` door — `storeDetails` feeds the store
switcher on **every** screen, so moving them behind the OMS grant would break the shell for an
admin-only user. Plus `Slots/AvailableSlots/{storeCode}` (750 OQ2).

**Follow-up worth a ticket (not taken here):** the spinner + denied card block is now pasted in ten
pages, byte-identical but for the namespace. A `core/ui/AccessGate` taking `{ query, allow, ns }`
would collapse all ten; touching the other eight screens is outside this ticket's Boundaries.

**Concurrency note:** built on `main` in the main working tree, not a worktree — 124 was already
merged and no parallel session was running. Port 5206 was occupied by a stray dev server, so the
drive ran against 5208 via `DRIVE_PORT`; the tool still defaults to 5206.
