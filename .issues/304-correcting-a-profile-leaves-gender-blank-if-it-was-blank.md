---
status: open
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

- [ ] `aBlankGenderAndLanguageSurviveASave` — a member with neither set validates and produces a
      request body carrying neither, and a member with both set keeps them · pure
- [ ] `onlyChangedFieldsCountAsDirtyAndAnUnchangedFormCannotSave` — including whitespace-only edits,
      a field returned to its original value, and a blank field left blank · pure
- [ ] `aStaleFormIsRefusedRatherThanClobbering` — the last-update echo round-trips, and a mismatch
      is surfaced as *the member changed*, not as a crash · pure
- [ ] `aRefusedSaveKeepsEveryEdit` — drive a validation refusal and a stale refusal; assert the
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
