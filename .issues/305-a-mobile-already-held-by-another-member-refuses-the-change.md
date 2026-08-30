---
status: done
spec: 301
blocked-by: 303
---

# 305 — aMobileAlreadyHeldByAnotherMemberRefusesTheChange

## What to build

Changing a **loyalty member**'s mobile number — its own control, its own confirmation, and its own
vocabulary of refusals.

🚩 **This is deliberately not a field on the profile form.** The mobile is the programme's login
credential and one of only **two** ways a member can be found at all (the other is the loyalty id —
email and national id are fields *on* a member, never ways *to* one). It must never change as a side
effect of fixing a name, which is why 301 ruled the commands act-shaped.

The control takes the new number, confirms, and writes. Three refusals, each named as itself so the
analyst knows which problem they have:

- **The number is already held by another member.** A collision, not a format problem. 🚩 The
  server-side handler this delegates to **refuses** rather than taking the number from its current
  holder — the wipe-the-other-member path exists only on the customer-driven OTP flow, not here.
  A refusal changes **nothing**: the member is never left half-edited.
- **The number is the one the member already has.** Refused as such, so no **member update
  snapshot** records a change that did not happen.
- **The number is not a valid mobile.** Refused before anything is written — a typo must not become
  a member's credential.

On success the header and the Actions tab both reflect the new number with no reload.

⚠️ **A caveat to carry, not to fix here:** this path marks the new number **verified, with no OTP at
all** — the analyst asserts verification on the customer's behalf. That is existing server
behaviour, deliberately unchanged by 301, and flagged for an owner ruling. Do not quietly "improve"
it in this ticket; if the screen says anything about verification, it must say what is true.

## Spine reach

model/api (the change call) · store/logic (which refusals are named; the confirm precondition) ·
component (the control + confirmation) · i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `eachRefusalIsNamedAsItselfRatherThanAsAFailure` — collision, same-number and invalid-number
      map to three distinct named outcomes; an unrecognised code falls back to the server's own
      sentence rather than to a generic one · pure
- [x] `aRefusedMobileChangeLeavesTheMemberUntouched` — drive a collision refusal; assert the member
      on screen still carries the old number, the Actions tab gained no row, and the analyst is
      still in the confirmation with the number they typed · flow

## Boundaries

- **Endpoint dependency:** the existing no-OTP mobile-change handler, newly exposed on the web door
  and gated on *may edit*. 🚩 The route is unbuilt — stub the envelopes. **Nothing here meets a live
  SIS.Api.**
- **Envelope `success:false` codes to handle by name:** mobile already used · same mobile as now ·
  invalid mobile · member does not exist. Plus the grant refusal.
- **i18n:** new `loy` keys, one per named refusal.
- Grows `tools/loy-member-admin-drive.mjs`. Copies 303's idiom.
- **Not** contact removal. Removing a mobile is 307 and is gated differently.

## Done when

Driving a collision, a same-number and an invalid-number attempt each produces its own sentence and
leaves the member unchanged; a successful change updates the header and the Actions tab with no
reload. `typecheck`, `lint`, vitest green.

## Blocked by

[303](303-blocking-a-member-names-a-reason-and-unblocking-clears-it.md) — for the write idiom.

## Open questions

- ⚠️ **Owner ruling pending** (301 → Further Notes): the admin path marks a number verified with no
  OTP. Not this ticket's to change, but if the ruling lands mid-build it changes what the
  confirmation may claim.

## As built (2026-08-30)

**Files.** `mobile-command.ts` (pure — the verdict and its wording) + `mobile-command.test.ts`
(10 cases) + `MobileCommand.tsx` + `loyCommandApi.changeMobile` + `memberCommandKey`'s third
command + 16 `loy` keys. The Fact pair the confirmation draws graduated out of `ProfileTab` into
`MemberFact.tsx` on review, so the two cannot drift.

**The wire, designed not shipped:** `POST LoyWeb/Member/{loyId}/Mobile` with a bare `{ mobile }`.
`LOY-00109` (already used) / `LOY-00110` (same as now) / `LOY-00111` (invalid) are **invented and
say so**, on 303's and 304's terms — a wrong guess costs the screen's own wording only, because an
unrecognised code still surfaces the server's sentence. `LOY-00100` is the observed one, inherited
from the shared map and driven on this command too.

🔑 **Three refusals, three keys, never one shared "it failed."** A collision is not a format
problem and a no-op is not a collision; an analyst who cannot tell them apart cannot act on any of
them. The map is `member-commands.ts`'s ONE reader — no second refusal path was added.

🚩 **The verdict IS the request.** `mobileChangeVerdict` returns the exact string that goes on the
wire, so the confirm cannot be armed off one value and send another. **Compaction is not
normalisation** (`compact` is reused from `resolve-member`, not re-spelled): the door owns
`LoyMobileNumbers.NormaliseTyped`. **Shape, never value** — digits only, no length rule and no
country rule, because the column width and the number ranges live in the database and a cap
invented here would refuse a change the door would have accepted.

🚩 **The unchanged check is a COURTESY, never the authority.** The stored number is normalised
server-side and the typed one is not, so `0555000111` may well be this member's number and the
screen cannot tell — which is why *same mobile as now* also exists as a named refusal. Driven both
ways: the screen catches what it can see (no call made), the door catches what it cannot.

⚠️ **The confirmation says what is TRUE about verification**: the number is marked verified with no
code sent to the member, so the record carries the analyst's word and not the customer's. The owner
ruling (301 → Further Notes #1) did not land during the build; nothing here quietly improves the
behaviour, and the copy is what has to change if it does.

**Everything else copies 303:** `useIsMutating` on a per-command mutation key (so the guard outlives
a tab switch), the invalidation inside `mutationFn` and deliberately unawaited, both cache prefixes,
and a 403 taking the command away rather than merely apologising.

### Reviews

`/standards-review` — **no hard violation on either axis.** Standards: three findings acted on (the
duplicated Fact/Pair extracted to `MemberFact.tsx`; `refusalText` respelled as `StatusCommand`'s
`refusal` and moved above the return; the drive header enumerating 22–26 when it adds 22–29). One
recorded and not acted on: the confirm-dialog shell (`busy`/`grantRefused`/`cannotConfirm`/footer)
is now a **second verbatim copy** of `StatusCommand`'s — defensible at two, and it becomes Shotgun
Surgery at **306/307**, where a change to the grant-refusal affordance would land in four files.
🚩 **That extraction is the first thing to weigh in 306.**

Spec: two findings acted on (the fourth named refusal `LOY-00100` now driven on this command; the
dialog note softened — it asserted sign-in and findability semantics of an unbuilt door). Two
recorded:

1. ⚠️ **A mobile change can strand an in-progress profile edit.** The write invalidates
   `MEMBER_SCOPE_KEY`, but `ProfileForm` holds the stamp it opened on, so an analyst who edits the
   profile, changes the mobile and then presses Save meets `LOY-00108` — *"this member changed since
   you opened the form"* — caused by **their own command**, worded as a colleague's edit, on the tab
   where story 22 promised the two are separate. Reloading recovers, at the cost of the edits.
   The stale guard is **304's**, and the honest fix is there (or in the door: whether a narrow
   command bumps `lastUpdate` at all is a BackOffice question). Not silently patched here.
2. ⚠️ **`mobileCountry` is nobody's yet.** The client never sends it — normalisation decides it and
   a client that sent one would be guessing. Spec 301 rules on the column only for *removal*; what a
   **change** does to it is a question for the BackOffice spec, recorded at the call site.

**Also settled here** (304's carried-over question, pointed at this ticket by its INDEX line): the
draft does **not** survive a tab switch, deliberately. Somewhere for a draft to outlive its tab is a
change to `MemberTabs`, not to a command; this control loses one field where the profile form loses
nine, and giving this one a store of its own would settle nothing for the form while leaving the
screen with two answers to one question.

`/code-review high` — **no defect in this ticket's own code.** It cleared the three properties the
ticket turns on by name: the verdict's ordering (letters checked before sameness), `compact` reused
rather than a second normalisation, and *the verdict IS the request* — the confirm cannot be armed
off one value and send another. Five findings, and **every fixable one is in another ticket's
file**, so all five are recorded here and none patched from this session:

- 🚩 **MEDIUM, `profile-form.ts` (304):** `profileProblems` validates the whole draft rather than
  the dirty fields, so a member whose **stored** email fails the shape check (`user@localhost`,
  `n/a`) can never be saved at all — `submit` short-circuits before `save.mutate`. An analyst who
  only wants to fix a misspelt name must first edit or blank a contact detail. **This is 304's own
  ruling reintroduced through the one field that has a shape rule**, and it wants a ticket.
- ⚠️ **MEDIUM, this diff:** the stranded-profile-edit interaction above, independently found. It
  confirms the triage rather than moving it — `StatusCommand` has had the identical effect since
  **303**, so this is three commands on one tab and not something 305 introduced.
- **LOW ×3, the IDoc Inspector wave (296–300):** a missing verdict rendering the *unknown* banner
  with a blank code; four bare object-literal indexes (`VERDICTS`, `EXPORT_BADGES`,
  `ATTENTION_BANNERS`, `OUTCOME_KEYS`) reachable through `Object.prototype` — the exact hazard
  `member-commands.ts` and `profile-form.ts` already guard with `Object.hasOwn`; and
  `ProfileForm`'s render-phase `setSeed` having no bail-out if the projection ever answers a null
  `lastUpdate` (which would also make the stale guard a silent no-op).

### Verification

`typecheck` · `lint` · `build` green · **2153 vitest** (10 new) · admin drive **106/106** ·
`loy-member-drive` **184/184**. 🚩 **Still no live SIS.Api** — every envelope on this path is
stubbed at Playwright, and the route does not exist.
