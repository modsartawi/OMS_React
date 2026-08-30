---
status: done
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

- [x] `aSystemReasonCannotReachTheSelectableList` — the projection drops system reasons; an empty
      list renders as an empty list, never as a failure · pure
- [x] `theStatusControlOffersTheCommandThatAppliesToThisMember` — blocked ⇒ unblock only, unblocked
      ⇒ block only, against a blank / whitespace / present reason code · pure
- [x] `blockingRefreshesTheHeaderAndTheActionsTabWithoutAReload` — drive a block and an unblock
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

---

## As built (2026-08-30)

`member-commands.ts` (pure) · `loyCommandApi` + three cache keys on `api.ts` ·
`StatusCommand.tsx` · `profile-controls.ts` · `LoyBlockedReasonPayload` on
`core/models/loy.ts` · new `loy` keys under `profile.status.*` and `command.refusal.*`.

**The wire, as designed** (all three routes unbuilt — the backend half of 301 is still unwritten
and unnumbered, so **nothing here met a live SIS.Api**): `GET LoyWeb/BlockedReasons`,
`POST LoyWeb/Member/{loyId}/Block` `{ blockedReason }`, `POST LoyWeb/Member/{loyId}/Unblock`.
🚩 **No correlation id is sent** — spec 301 records it as pass-through with no dedup anywhere and
the trail service minting its own, so a client-minted one would buy no idempotency, only a field on
a contract nobody has written. `LOY-00105` (invalid blocked reason) is **invented and says so**;
`LOY-00100` is observed. The guess is cheap by construction: an unrecognised code still surfaces the
server's own sentence, so a wrong number costs the screen's extra wording and nothing else.

🚩 **The system-reason looseness is INVERTED from 302's, and that is the ticket's real content.**
302 required `=== true` and nothing looser because being wrong failed *open* on a PII surface. Here
the safe error is dropping too much — a reason wrongly withheld is a visibly short picker, a system
reason wrongly offered is a false audit trail — so **anything truthy is a system reason** (`1`,
`'Y'`, even the string `'false'`). An **absent** flag keeps the row, because the door filters
server-side too and a door that filtered without projecting the flag would otherwise leave an
analyst with an empty picker and no way to block anyone. The projection is the second line, not the
first.

**The three idiom pieces 304–307 copy:**

1. A refusal is **named AND said** — `t('command.refusal.pair', { named, said })`, joined through a
   key rather than concatenated, so the screen's wording and the server's sentence are both there
   and neither is flattened into the other.
2. 🚩 The in-flight guard is **`useIsMutating` on a `memberCommandKey`, not `run.isPending`**. The
   tab shell mounts only the open tab, so a control trusting its own pending flag comes back armed
   after an analyst clicks Actions and returns mid-write — and with no server-side idempotency that
   second press is a second **member update snapshot** and a second trail row. Driven.
3. 🚩 The invalidation lives **inside `mutationFn`**, for the same reason: `onSuccess` is this
   control's observer's and does not fire if the tab unmounted. It is **not awaited** — `core/api.ts`
   puts no timeout on `fetch`, and awaiting would hold a modal that cannot be dismissed while busy
   open on a hung *read* long after the *write* had committed.

⚠️ **The member cache is invalidated by PREFIX** (`MEMBER_SCOPE_KEY`), not by `memberKey(loyId)`:
the route reads under the key it took from the **URL** and a command holds only the **payload's**
id. They agree on every ordinary path, but a hand-typed link differing by case or padding would have
the command invalidate an entry nobody is reading and the header would silently not move.

⚠️ **A grant refusal takes the command away, not just the words.** Saying "retrying will not help"
beside an armed button is the loop the rule names, so a 403 disarms the control; it clears on a
remount (Cancel, a tab switch, a reload), never by pressing again. A **coded** 403 keeps the
server's sentence — on this door a 403 is a guard denial whatever rides with it.

⚠️ **An empty reason list is never cached** (`staleTime` is a function of the answer). "No blocked
reason is available" tells an analyst to have one configured; holding it for the session would make
reopening the dialog show the same dead end after the administrator had done exactly that.

⚠️ **One shipped behaviour corrected next door**: `memberChips` read `blockedReasonCode` by bare
truthiness while `statusCommand` trims, so a padded `'  '` would have chipped the header red above a
tab saying the member is not blocked. `member-header.ts` now trims, with a test.

Also graduated out of `ProfileTab` under review: `codeWords` → `codes.ts` (a third spelling of the
degrade rule was being written), and the two button class strings → `profile-controls.ts`.

**Proof:** 2123 vitest (14 in `member-commands.test.ts`, +1 in `member-header.test.ts`) ·
`loy-member-admin-drive` **54/54** · `loy-member-drive` **184/184** · `typecheck`, `lint`, `build`
green · every envelope stubbed.

**Reviews:** `/code-review high` raised six on this ticket's code, **all fixed** (the grant-refusal
disarm surviving only via the block dialog, the in-flight guard lost across a tab unmount, an
unclosable modal awaiting invalidation refetches, the chip/`statusCommand` blank-guard disagreement,
the cached empty reason list, and `Object.prototype` reachable through the refusal map).
`/standards-review`: **Standards** — one hard i18n breach (sentence concatenation) fixed with the
`pair` key, plus three duplication/naming smells fixed (`codeWords`, the button classes, the
`StatusCommand` type renamed `MemberStatusCommand`, the refusal map made private). **Spec** — two
findings, both fixed (the grant refusal offering a retry as an affordance; the 403 arm dropping the
server's sentence); no scope creep found.

⚠️ **Not this ticket's, reported not fixed** — `/code-review` also raised four on the already-shipped
IDoc Inspector wave (296–300): `DownloadStrip` keyed on `dataUpdatedAt` so a background refetch
remounts it mid-download and strands the outcome; the re-ask path having no busy state; FI rows
keyed without `profitCenter`; and `document-graph.ts` dereferencing `fiItems`/`lines`/`payments`
with no null guard under a route with no `errorElement`.
