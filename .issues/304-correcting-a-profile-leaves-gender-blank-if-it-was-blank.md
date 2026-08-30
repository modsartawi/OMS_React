---
status: done
spec: 301
blocked-by: 303
---

# 304 — correctingAProfileLeavesGenderBlankIfItWasBlank

## What to build

The profile form itself — the **member command** an analyst runs twenty times a day.

Nine editable fields (full name · email · birth date · gender · nationality · national id · city ·
preferred language · insurance company), a Save, and a Discard that returns the member to as stored.

🚩 **The ruling this ticket exists to protect: gender and preferred language may be left blank.**
The till's existing validator makes both **mandatory** — its e-commerce sibling explicitly permits
blank and this one deliberately does not — and it constructs itself inside the handler, so it cannot
be swapped from outside. Members are frequently sparse. An analyst opening a member with no recorded
gender to fix a misspelt name **must not be forced to invent a fact about the customer**. This is why
301 ruled a **new admin-side server handler** rather than delegation, and it is the single most
valuable pure test in the wave: a regression here is invisible to the type system, invisible at
build, and surfaces only as an analyst who cannot fix a name.

The rest of the form's behaviour:

- **Save is disabled until something has actually changed** — a command that records no change must
  not be writable.
- **The changed fields are visible before saving**, so a stray keystroke in a field the analyst
  didn't mean to touch is seen rather than silently written.
- **A validation failure is named against the field that caused it**, not against the form.
- 🚩 **A refused save keeps every edit on the form.** Same rule ticket 220 established elsewhere in
  the portal: a server refusal costs a retry, never the analyst's typing.
- **Changing the email clears that address's verified mark** — server-side, but the screen must not
  contradict it. The existing till handler changes the address and leaves the mark set, making the
  record assert we verified an address the customer never confirmed.

**The stale-write guard.** The form echoes back the member's last-update stamp — already carried on
the member payload — and the server refuses if the member has moved on. This command writes nine
fields at once, so two analysts with the screen open would otherwise silently clobber each other.
The refusal is not an error: it says the member changed underneath you and offers a reload. The
narrow commands (mobile, block, unblock, removals) carry no such token — they write one dimension
and the server reads the member fresh.

## Spine reach

model/api (the update call + the last-update echo) · store/logic (**new** profile-form module:
dirty set, validation verdict, request body, stale comparison) · component (the form) · i18n · test
(pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `aBlankGenderAndLanguageSurviveASave` — a member with neither set validates and produces a
      request body carrying neither, and a member with both set keeps them · pure
- [x] `onlyChangedFieldsCountAsDirtyAndAnUnchangedFormCannotSave` — including whitespace-only edits,
      a field returned to its original value, and a blank field left blank · pure
- [x] `aStaleFormIsRefusedRatherThanClobbering` — the last-update echo round-trips, and a mismatch
      is surfaced as *the member changed*, not as a crash · pure
- [x] `aRefusedSaveKeepsEveryEdit` — drive a validation refusal and a stale refusal; assert the
      typed values are still on the form and the failing field is named · flow

## Boundaries

- **Endpoint dependency:** the **new** admin-side profile route, gated on *may edit*. 🚩 Unbuilt —
  stub the envelopes. **Nothing here meets a live SIS.Api.**
- **Envelope `success:false` codes to handle by name:** member does not exist · invalid nationality ·
  invalid city · member changed since you loaded it. Plus the grant refusal.
- ⚠️ **The empty-string email question is live.** 301 → Further Notes: the shared validator's
  behaviour on `""` is unconfirmed (null passes; empty probably does not). The client must handle a
  blank email explicitly rather than reasoning about it — and this is the ticket that finds out what
  the wire actually does.
- **i18n:** new `loy` keys, one per field label and per named refusal.
- Grows `tools/loy-member-admin-drive.mjs`. Copies 303's refusal, in-flight-disable and
  cache-invalidation idiom rather than inventing a second one.

## Done when

An analyst can correct a member with no recorded gender without setting one; Save stays dead until
something changes; a refusal leaves the form intact with the offending field named. `typecheck`,
`lint`, vitest green.

## Notes from 302

- The Profile tab's draft is **seeded once at mount and never re-synced** — the tab shell is keyed
  on the LoyId, so a background re-read of the *same* member leaves the controls holding what they
  were opened with while the read-only facts beside them move. That is right for an analyst
  mid-edit, and it means this ticket's **stale-write guard must cover a draft that went stale on
  its own**, not only two analysts racing.
- 🚩 The birth-date control carries `yyyy-MM-dd` (the wire form), not the display date the
  read-only rendering shows. The request body takes it as-is; the two renderings deliberately say
  the same fact differently.
- The ticket-302 table's **referral code does not exist on the wire** — `LoyMemberModel` carries
  none, so nothing draws one and nothing may edit one.

## Blocked by

[303](303-blocking-a-member-names-a-reason-and-unblocking-clears-it.md) — for the write idiom
(refusal surfacing, in-flight disable, cache invalidation), not because blocking gates a profile
edit.

## Open questions

None.

---

## As built (2026-08-30)

`profile-form.ts` (pure, **new**) + `profile-form.test.ts` · `ProfileForm.tsx` (**new**) ·
`loyCommandApi.updateProfile` on `api.ts` · three refusal codes on `member-commands.ts`, which also
grew `commandRefusalText` — the wave's ONE refusal reader, extracted from 303's copy in
`StatusCommand` rather than spelled a second time · `ProfileTab.tsx` now draws its two renderings
from **one field list** · new `loy` keys under `profile.*` and `command.refusal.*`.

**The wire, as designed** (unbuilt — the backend half of 301 is still unwritten and unnumbered, so
🚩 **nothing here met a live SIS.Api**): `POST LoyWeb/Member/{loyId}/Profile`, taking the nine
fields plus a `lastUpdate` echo. `LOY-00106` (invalid nationality) · `LOY-00107` (invalid city) ·
`LOY-00108` (member changed) are **invented and say so**, on 303's terms: an unrecognised code still
surfaces the server's own sentence, so a wrong number costs the screen's extra wording and which
control gets marked — never whether the analyst is told what happened. `REFUSED_FIELDS` and
`REFUSAL_KEYS` are the two lines to reconcile when the door lands.

🚩 **The ruling, and how it is pinned.** A member with no gender and no preferred language saves,
and the body carries `null` for both. The whole rule lives in `profileProblems` — which demands a
value on **none** of the nine, in either direction: blanking a *recorded* gender is as legal as
leaving an absent one absent, because the ticket's failure mode is an analyst forced to make a fact
about a customer up. Driven end-to-end against a stubbed door, and asserted on the body the browser
**actually sent** rather than on the form.

🚩 **A blank is `null` on the wire, never `""`.** This is the ticket's explicit handling of the live
empty-string question (301 → Further Notes #2). ⚠️ **The question is NOT answered** — it cannot be
without a live SIS.Api, which the same Boundaries forbid. The client sidesteps it instead: it states
*not recorded* in the one spelling the column and the validator already agree about. **The
confirmation is still owed**, and belongs to whichever ticket first meets the real door.

**Only SHAPE is checked, never a value.** Two client-side checks, both guarded on a non-blank value:
an email that is not `a@b.c`, and a birth date that would not be **sent as the day it was typed**
(`new Date` rolls `2026-02-31` forward to March rather than refusing). Deliberately no length caps,
no code value sets, and — after review — **no "not in the future" rule**: those are judgements about
the customer, and spec 301 puts value rules on the door where a refusal can be **named**. An invalid
nationality or city is marked against its own control by `profileRefusedField`, from the door's code.

**The stale-write guard, in two halves.** The request echoes the stamp the form was **opened on**,
and the door refuses with `LOY-00108` — said as *the member changed*, with a **Reload** and no retry,
because pressing Save again would either be refused identically or succeed against a member the
analyst has not seen. `profileFormIsStale` says the same thing **earlier**, with no round trip, for
the case 302's note names: the draft is seeded once at mount and never re-synced, so a background
re-read of the *same* member moves the facts beside the controls while the controls hold what they
were opened with. 🚩 A blank stamp on either side is **not** a clash — the screen never invents the
warning — and the client-side news never disarms Save: a door that reformatted its stamp must not be
able to strand an analyst's edits.

⚠️ **The one race the guard could have lost to itself** (found by the Spec review): the write's
invalidation is deliberately not awaited, so for a moment after a successful save the member payload
still carries the stamp that save superseded. A second save in that window would echo it and be
refused as stale — the guard firing on a race with *itself*, told to the analyst as a colleague's
edit. `awaitingStamp` holds Save dead until the read the write kicked off lands. Briefly dead is far
cheaper than a refusal that reads as someone else's.

**Everything else follows 303's idiom rather than a second one**: the in-flight disable read from
the mutation cache (`useIsMutating` on `memberCommandKey`) so it outlives a tab switch; the
invalidation of both the member prefix and the Actions prefix inside `mutationFn`; a 403 taking the
command away rather than merely apologising. A refusal — shape, business, stale or grant — **clears
nothing on the form**, which is ticket 220's standing rule and this ticket's flow Proof.

**Discard and the stale reload are one mechanism**: `onReseed` remounts the form, which re-seeds
from the member as stored. The reload **awaits** its refetch first (unlike the write's), because
re-seeding before it landed would put the analyst back on the very copy they asked to leave.

⚠️ **Two things the diff deliberately does not touch.** The email-**verified** mark is cleared
server-side by the new handler when and only when the address changes; the screen cannot contradict
it because `LoyMemberModel` carries **no verified field at all**, and `profile-form.ts` says so where
a later ticket that wants to draw one will read it. And `profile.inertNote` now names the *removals*
only — 304's controls are live, and a note that says more than is true is how an editor stops
reading it.

**Reviews.** `/standards-review` found **no hard rule violation on either axis**. Acted on: the
duplicated `refusal()` reader extracted to `member-commands.ts` as `commandRefusalText`; the
invented future-date rule dropped; the toast reworded to name the **member command** rather than
"save" (`CONTEXT.md` lists *save* and unqualified *update* against that entry); and the Spec axis's
post-save echo race closed. Left as noted: the nine fields are spelled out in `ProfileDraft`,
`profileDraftOf` and `profileUpdateRequest` as well as in `PROFILE_FIELDS` — three genuinely
different shapes (control strings, label list, nullable wire body), each typechecked, and folding
them together would trade that for a cast.

`/code-review high` then found **six defects in this ticket's code, all fixed**, and the first is
the one worth remembering:

1. 🚩 **The stale guard only protected a session's FIRST save.** `seed.lastUpdate` was set to
   `null` on success and never set back, so from the second save on the form simply followed the
   live member: a colleague's edit landing afterwards raised no warning, the echo matched whatever
   the door now held, and the nine-field snapshot — seeded before their change — overwrote it
   silently. Exactly the clobber the echo exists to prevent, on a screen where an analyst opens the
   tab to make more than one correction. The stamp is now **adopted when the re-read lands**, in the
   render pass rather than from an effect. Driven: a colleague's edit after a first save raises the
   banner, and the second save's echo is the stamp the first one earned.
2. **`t('profile.saveFailed')` survived the rename** in the per-field refusal path — a coded
   `LOY-00106`/`LOY-00107` carrying no server sentence would have rendered the raw key under the
   control. The exact failure the i18n rule names.
3. ⚠️ **`awaitingStamp` could have deadlocked.** Waiting for the stamp to *change* strands the form
   for the whole session on three ordinary paths — a door that does not bump `lastUpdate`, a
   minute-granular stamp with two saves inside one minute, or a refetch that failed — with Save dead
   and nothing saying why. It now waits for the **read to end** (`useIsFetching`), not for the stamp
   to move; if what comes back is genuinely stale, the door's own refusal still says so.
4. 🚩 **A failed reload threw the edits away.** `refetchQueries` resolves rather than rejects, so a
   door that was down had "Reload the member" discard the typing, re-seed from the same stale cached
   member and leave the banner up. It now re-seeds only on a read that worked — tested on
   `state.error`, not `state.status`, because a query that already holds data stays `success` when a
   refetch fails.
5. **One mutation key per command, not per member.** `StatusCommand` and `ProfileForm` shared
   `memberCommandKey(loyId)`, so a profile save spun the Block button and a block disabled all nine
   profile controls. The key now carries the command.

⚠️ **One finding is recorded and NOT fixed** — `MemberTabs` mounts only the open tab, so clicking
Activities mid-edit unmounts the form and discards unsaved typing with no prompt. Harmless while
302 wrote nothing; real now. Fixing it properly means somewhere for a draft to outlive its tab, and
305–307 each add more form state to that same question — so it belongs to a slice that can answer it
once, not to this one inventing a second answer. **It is the first thing to settle in 305.**

**Proof:** 2143 vitest (20 new, in three named suites) · admin drive **80/80** (four of them
the code review's own regressions) ·
`loy-member-drive` 184/184 · typecheck, lint and build green · every envelope stubbed.
