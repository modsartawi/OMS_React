---
status: open
spec: 267
blocked-by: 270, 272, 273
---

# 274 — The screen calls the real door

## What to build

The joining event. Everything in 268–273 is proven against fixtures and stubs; this ticket points the
screen at a **live SIS.Api** and posts a real entry against a real branch.

⚠ **Excluded from any AFK run.** It needs a live API, a seeded grant and a real database, and its
central assertions are manual by nature.

### Prerequisites

1. **BackOffice's settlement backend is built and deployed** — spec
   [1173](file:///C:/Work/DMSCO/BackOffice/.issues/1173-store-settlement-account-spec.md): migration
   **081** applied to **POS_Server**, the settlement service, and the six accountant doors plus the
   two bulk doors.
2. **The grant is seeded** — the fifth grant under the Collections access key. Without it the screen
   is correctly invisible, which is also 268's proof, so seed it deliberately and remove it again if
   the environment is shared.
3. **Map [1153](file:///C:/Work/DMSCO/BackOffice/.issues/1153-collection-assignment-map.md)'s
   assignment migration is on the sink** if the scoped door is to be judged. Without it every session
   opens unfiltered — which is the specified behaviour for an accountant with no staff row, so the
   screen still works; it just cannot prove its scoping.

### The work

Repoint the feature at the real routes and fix what only a live call reveals. **Expect to find
things: this is where the wire meets the model.**

- ⚠ **Settle the route names and casing against SIS.Api.** Spec 267 D8's table is the *shape*; the
  literal strings were never confirmed by a call.
- Confirm the **envelope** on every door. A body missing a field the type promises reaches
  `.toFixed` and throws into the router's error boundary — the type is a claim *about the server*,
  not a guarantee.
- Confirm a **refusal is a 200 with `accepted: false`** on cancel and on repair, and that the screen
  renders the recovery rather than an error. If the server returns an HTTP error instead, that is a
  **server finding to record**, not a client workaround.
- Confirm the **multipart** door round-trips a real `.xlsx`, and that commit's re-send + hash check
  behaves as specified.
- Confirm the **estate-wide carve-out** against real data: post an entry on an **unassigned** branch,
  scope to *mine*, and confirm it is invisible in ageing but visible in the lanes that matter.

### 🔑 The one thing only this ticket can settle

**Whether the fleet door's aggregate is fast enough at 1394 branches to render without a spinner
budget.** The design ruled against caching and against a denormalised per-store balance on the
grounds that the open-set aggregate is milliseconds — a claim made against a 1000-row fixture, never
against the estate. Measure it, write the number here either way. If it is slow, the answer is an
**index or a server-side shape change** recorded for BackOffice — **never** a client cache, which is
the read-modify-write trap the design refused twice.

## Spine reach

The feature's first real user: an accountant posts a figure a till can consume.

## Proof

- [ ] The grant proven in **both** directions — unseeded: no menu item, route refused; seeded: the
      screen works.
- [ ] A **real entry posted** against a real branch, visible on its account with a minted number.
- [ ] That entry **cancelled** live, and a second one **written off** after a consumption exists
      against it (a till close or a hand-inserted consumption row).
- [ ] A cancel that **loses the race** observed live if it can be arranged; otherwise the refusal
      path is exercised against a real `accepted: false`.
- [ ] A real **`.xlsx` uploaded**, previewed with resolved branch names, and committed — then the
      batch withdrawn as a unit.
- [ ] A **hash mismatch** refused for real (edit the sheet between preview and commit).
- [ ] The estate-wide carve-out confirmed on real data (above).
- [ ] 🔑 **The fleet aggregate's timing measured at estate scale and written into this ticket.**
- [ ] `typecheck` + `lint` green.

### Deliberately NOT part of this ticket's proof

⚠ **Do not repoint `tools/settlement-drive.mjs` at live.** Its assertions are about behaviour on
*specific responses* — a lost cancel race, a hash mismatch, a no-op repair — and the live estate does
not contain those on demand. A live drive would assert them **vacuously and go green proving
nothing**. Same ruling [259](259-the-screens-call-the-real-door.md) and
[266](266-the-screen-calls-the-real-door.md) both reached.

## Boundaries

- **No new features.** This ticket repoints and fixes.
- **A server-side finding is recorded, never worked around client-side.** If a field is missing,
  mis-scaled or misnamed on the wire, write it up for BackOffice and leave the client honest.
- **Do not leave a permanent grant holder** on a shared database without saying so here.
- You may **read** anything in `C:\Work\DMSCO\BackOffice`; you may not edit, stage or commit there —
  it has its own tracker.

## Done when

A real entry is posted, corrected and withdrawn against live SIS.Api; a real spreadsheet posts a
batch and the batch is withdrawn; the grant is proven both ways; and the fleet aggregate's real-scale
timing is written down.

## Blocked by

[270](270-the-door-searches-and-triages.md), [272](272-one-button-corrects-and-the-audit-reads-as-time.md),
[273](273-a-months-audit-uploads-and-commits.md).

Server side: BackOffice spec 1173's endpoints and migration 081 — **not yet built** at the time this
ticket was written.

## Open questions

The route literals (D8) and the fleet timing, both settled by this ticket rather than before it.
