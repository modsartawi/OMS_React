---
status: open
spec: 301
blocked-by: 302
---

# 303 — blockingAMemberNamesAReasonAndUnblockingClearsIt

## What to build

The first **member command** that actually writes — and with it, the write idiom every later ticket
in this wave copies.

One Status control that offers whichever applies to the member in front of the analyst: **Block**
for an unblocked member, **Unblock** for a blocked one. Never two buttons, one of which is always
wrong.

- **Block** asks for a reason, chosen from the server's list of the reasons a person may pick.
- 🚩 **The list excludes every system reason.** This is the first-ever reader of a flag that has sat
  in the table unread; the removal reason `CR` exists as a *state* and must be **unofferable** here.
  If an analyst can mark a member "removed at customer request" without removing anything, the trail
  lies in the direction that matters most (301 → Implementation Decisions; ADR 0002's neighbourhood).
- **Unblock** clears the reason with no further input.

On success the header's blocked state and the Actions tab both reflect it without a reload.

**Three things land here as the wave's idiom**, and 304–307 copy rather than reinvent them:

1. **Business refusals are surfaced from the envelope**, never flattened to a bare string — the
   server's own sentence plus the screen's wording for codes it recognises (here: member does not
   exist, invalid blocked reason). Per `.claude/rules/api-envelope.md`. A refusal is a designed
   outcome, not a crash.
2. 🚩 **The control disables itself while in flight.** There is **no server-side idempotency** — the
   correlation id is pass-through only and no dedup check exists anywhere in the module — so a
   double-click writes two **member update snapshots** and two trail rows. The client is the only
   guard.
3. **Every command invalidates the member's cache entry and every page of the Actions cache.** The
   Actions tab is where a command becomes visible; a write that doesn't refresh it looks like it
   didn't happen.

A grant refusal (403) says the session no longer holds the authority and offers **no retry** — it is
not an outage. 401 stays untouched; `core/api.ts` owns it.

## Spine reach

model/api (two write calls + the selectable-reasons read) · store/logic (which command applies;
the selectable-reason projection) · component (Status control + reason dialog) · i18n · test
(pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `aSystemReasonCannotReachTheSelectableList` — the projection drops system reasons; an empty
      list renders as an empty list, never as a failure · pure
- [ ] `theStatusControlOffersTheCommandThatAppliesToThisMember` — blocked ⇒ unblock only, unblocked
      ⇒ block only, against a blank / whitespace / present reason code · pure
- [ ] `blockingRefreshesTheHeaderAndTheActionsTabWithoutAReload` — drive a block and an unblock
      against stubbed envelopes; assert the header state, the new Actions row, one in-flight
      disable, and a business refusal keeping the analyst in the dialog with a named reason · flow

## Boundaries

- **Endpoint dependency:** two write routes (block, unblock), both gated on *may edit*, plus a
  selectable-reasons read. 🚩 **All unbuilt** — the backend half of 301 is unwritten and unnumbered.
  Stub every envelope; **nothing here meets a live SIS.Api.**
- **Envelope `success:false` codes to handle by name:** member does not exist · invalid blocked
  reason. Plus the grant refusal.
- **i18n:** new `loy` keys. No new namespace.
- Grows `tools/loy-member-admin-drive.mjs`.

## Done when

Driving the app blocks and unblocks a member against stubbed envelopes, the header and the Actions
tab both update with no reload, a refusal is explained rather than thrown, and the system reason is
provably absent from the picker. `typecheck`, `lint`, vitest green.

## Blocked by

[302](302-the-profile-tab-says-what-this-session-may-do.md) — the tab and the *may edit* flag must
exist before a command can hang off them.

## Open questions

None.
