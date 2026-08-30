---
status: done
spec: 301
blocked-by: 306
---

# 307 — removingAMobileNeedsTheLoyaltyIdRetypedAndBlocksTheMember

## What to build

The command this whole wave was requested for, and the only one behind the third tier of authority:
a customer asks to be made unreachable, and their **mobile** is removed.

**What it does.** Clears the mobile and its country code, clears both verified marks, optionally
clears the email in the same command, and **blocks** the member under a **system reason** — a reason
an analyst can never pick by hand (303 proved it unofferable). The block is what makes *"this person
asked to be removed"* a recorded state rather than an emergent side effect of an empty column: the
member cannot sign in today because sign-in resolves by mobile, but that is a consequence of a
lookup, not a stated intention.

**Why the ceremony is heavier than 306's.** There is no self-service undo. Once the mobile is gone
the member cannot sign in, and the loyalty id is the **only** remaining handle — the portal's own
search will not find them. So:

- 🚩 **The analyst retypes the loyalty id**, matched exactly, before Remove goes live. The realistic
  failure here is not a mis-click but the **wrong member** — two members open in two tabs. A
  confirmation dialog does not prevent that; people click through dialogs. A retyped id does,
  because the wrong id is on screen and will not match.
- **A case reference is required too**, exactly as in 306.

**The confirmation says three things, and the third is not optional:**

1. The member will not be able to sign in.
2. The member will not be findable by mobile.
3. 🚩 **This is not account deletion.** The name, national id, birth date, points balance and entire
   purchase history remain and stay readable by anyone holding the read grant. This sentence exists
   so an analyst does not promise a customer something we have not done. `CONTEXT.md` lists
   *erasure*, *account deletion* and *anonymisation* against **contact removal** for this reason.

**Two smaller rules:**

- **An already-blocked member's reason is overwritten** with the removal's system reason. The
  module's existing blank-the-mobile path preserves instead; 301 deliberately departs, because
  inactivity and collision markers can be re-derived and "this person asked to be removed" cannot.
- 🚩 **The member's chip is dropped from recent searches on success.** Those chips are the *typed
  key* — a mobile number — held in `sessionStorage`. Left alone, the number the analyst was just
  asked to remove sits in their session as a chip that no longer resolves.

**Recovery is deliberately not here** (ADR 0002). The old values survive only in the preceding
**member update snapshot**, exposed on no portal read, so reversal is a support task — and is not a
simple restore anyway, since reattaching a mobile must re-run the collision check because someone
else may hold that number by now.

**Hidden entirely without the grant.** An analyst holding *may edit* but not *may remove a mobile*
sees no control — not a disabled one. 302 established the visibility rule; this ticket makes the
control real.

## Spine reach

model/api (the removal call) · store/logic (the mobile-path precondition: reference **and** matched
id; the recent-searches drop) · component (the confirmation) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `aMobileRemovalNeedsBothAReferenceAndTheExactLoyaltyId` — a wrong id, a whitespace-padded id,
      a case-differing id and a blank reference each leave the command unconstructable; only the
      exact pair passes · pure
- [x] `aMobileRemovalNamesTheMobileAndBlocksWhileAnEmailRemovalDoesNeither` — the two removal paths
      produce different requests from one module, and neither carries an old value · pure
- [x] `removingAMobileDropsThatMembersChipFromRecentSearches` — the chip list after a removal,
      including the case where the member was found by loyalty id and has no mobile chip · pure
- [x] `theRemoverSeesTheControlAndTheEditorDoesNot` — drive both sessions; then drive a full removal
      and assert the three-part warning, the block on the header, the Actions row showing the
      reference and **not** the number · flow

## Boundaries

- **Endpoint dependency:** a **new** removal route, the only one gated on **may remove a mobile**
  (ADR 0001). 🚩 Unbuilt — stub the envelopes. **Nothing here meets a live SIS.Api, and this is the
  command that destroys a customer's login.** A ticket's *done* here cannot mean *driven against a
  server*; say so when closing it.
- **Envelope `success:false` codes to handle by name:** member does not exist. Plus the grant
  refusal, which for this command must read as *you do not hold this authority* and offer no retry.
- **i18n:** new `loy` keys for the three-part warning and the retyped-id field. Forbidden words:
  *erasure*, *delete*, *anonymise*.
- Touches `recent-searches` — an existing pure module with its own suite. Extend it, don't fork it.
- Grows `tools/loy-member-admin-drive.mjs`. Copies 306's removal ceremony rather than a second one.

## Done when

A remover can take a customer's mobile only after naming a case reference *and* retyping the loyalty
id; the member is blocked under the system reason; the Actions tab shows the reference and never the
number; the chip is gone; and an editor without the grant sees no control at all. `typecheck`,
`lint`, vitest green.

## Blocked by

[306](306-removing-an-email-requires-a-case-reference.md) — shares the removal module, the
confirmation shape and the case reference. Building this first would mean writing that ceremony
twice.

## Open questions

**Raised during the build. The first is the only one that needs an owner.**

1. 🚩 **The optional email-in-the-same-command was not built, and nobody has signed off the
   consequence.** *"optionally clears the email in the same command"* appears in What to build and
   in spec 301's table (*mobile(-and-optionally-email)*), but no Proof bullet, Spine-reach item or
   Done-when clause covers it, so no control was drawn and the client never sends the flag. The
   consequence: a customer asking to be fully unreachable costs **two commands, two case
   references and two trail rows**. Whether the door takes the flag at all is map 1396's to say —
   but whether the screen should offer it is this wave's, and it is unanswered.
2. ⚠️ **The third confirmation sentence is said by naming what remains, never by negation.** What to
   build quotes *"This is not account deletion"*; the Boundaries of this same ticket forbid the word
   *delete*, and `CONTEXT.md` agrees with the Boundaries. Resolved as 306 resolved it — the
   confirmation names the name, the national ID, the birth date, the points and the whole purchase
   history, and the drive asserts the forbidden words are absent. If an owner wants the literal
   negation it is one key.
3. ⚠️ **The chip drop matches what the browser can see is the same number, and no more.** A chip
   typed `0555000111` against a stored `966555000111` is the same customer and the client cannot
   tell: normalisation is the door's (`LoyMobileNumbers.NormaliseTyped`) and a second spelling of it
   here is how the two start to disagree (decision 225 ruling 4). Pinned as a test so the gap is a
   stated fact rather than an assumption; closing it means the door returning what it normalised.

## Decisions taken here, not asked for

- **The 306 case-reference keys moved to a shared `profile.caseReference.*`**, and
  `RemoveEmailCommand` moved with them. The i18n boundary named only new keys for the warning and
  the retyped id; the reference is the same promise on both removals (ADR 0002), so one set of words
  was worth the undeclared edit. The shared field became `CaseReferenceField`.
- **A member with no number gets a dead control that says so** — the same call 306 made, for the
  same reason, plus one this command has of its own: a removal of nothing would still block them.
