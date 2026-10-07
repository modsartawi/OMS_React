---
status: done
spec: — (grilled 2026-10-07, /grill-with-docs; decisions below)
blocked-by: —
---

# 427 — The palette jumps to a loyalty member by Loy ID or mobile

**Source:** a grilling session on 2026-10-07. It is too small for a spec, so the settled decisions
live here. No server change: it composes the existing `resolveMember` lookup and the `LoyWeb/Access`
probe.

Today the palette's **Jump to number** group offers *Open delivery N* and *Open document N*
(`layout/palette-groups.ts`, spec 380 K11). This ticket adds a third row that opens a
**loyalty member**, found by either of its two keys (see `CONTEXT.md` → *Loyalty member*).

## Decisions (settled)

1. **One row, *Open loyalty member N*.** It runs the same mobile-then-Loy-ID lookup the Loy search
   field uses. The client never guesses which key a number is (decision 225: no shape rule).
2. **When the row shows:**
   - Fold Arabic and Persian digits, then apply the Loy field's own `compact` (whitespace, dashes,
     parens and a leading `+`).
   - If the result is all digits, the row shows.
   - Delivery and document keep their strict all-digits rule, so a pasted `+966 55 500 0111` shows
     only the Loy row.
   - Loy IDs are digits only (owner, 2026-10-07).
3. **Gate.** The row sits behind `canOpenLoyMember` (the `LOY_ACCESS_KEY` probe, the same call and
   cache key the menu leaf uses). A pending or errored probe hides it (K12).
   - Each jump row follows its own landing page's gate.
   - Delivery and document stay on OMS `canOpenDetail`.
   - A Loy-only agent sees only the Loy row.
4. **Order.** The Loy row comes **last** in Jump, after delivery and document. An OMS user's
   "number + Enter opens the delivery" is unchanged.
5. **No palette Recent for members.**
   - `core/commands/recent` stays deliveries and documents only, because it is `localStorage`, per
     user, and outlives the tab.
   - A jump that resolves a member lands on the Loy page's own `sessionStorage` chips (ticket 239),
     because the page treats it as a submit.
6. **The palette navigates; the Loy page resolves.**
   - The palette goes to `/loy/members` with router state `{ lookup: <typed> }`.
   - **Router state, never a URL param:** a mobile is personal data and must not reach history,
     logs or a pasted link.
   - Only the digits are folded to ASCII; the rest travels as typed, and the page compacts as it
     does for the field.
7. **The page treats the lookup as a submit.** It puts the text in the field and runs the existing
   `resolveMember` mutation.
   - A found member goes to `/loy/members/:loyId` with `{ typed }`, as today.
   - No match, a 403 and an outage render exactly as they do from the field.
8. **One shot per history entry.**
   - The page reads the lookup per entry (`location.key`), not only on mount, so a jump made while
     already on a member's profile still runs.
   - It then replaces the state away, so a reload or Back never re-runs it (the `open-intent`
     precedent).
9. **Where the code lives:**
   - The router-state shape (writer + defensive reader) lives in `features/loy/member` and
     `layout/palette-groups.ts` imports it. That is allowed, because `layout` is the composition
     root, and only one feature consumes it, so unlike `open-intent` it does not need to graduate to
     `core`.
   - `foldDigits` is exported from `core/commands/palette-model` for reuse.
10. **Row copy.**
    - New key `common:palette.jump.member` ("Open loyalty member") in EN and AR, with its own person
      icon.
    - The number is the row's `value`, which the row already isolates.

## What to build

- `layout/palette-groups.ts`:
  - A `memberJumpRow(query, navigate)`.
  - `paletteGroups` takes the Loy probe state and appends the row after the two jump rows when
    `canOpenLoyMember`.
- `layout/` palette host: pass the `LOY_ACCESS_KEY` probe state in, the same `useQuery` the menu
  already runs.
- `features/loy/member/`:
  - A small `lookup-intent.ts` (`lookupState`, `lookupOf`, `withoutLookup`).
  - `MemberLookupPage` consumes it once per history entry and runs the existing submit path.
- `core/commands/palette-model.ts`: export `foldDigits`.
- `src/locales/en/common.json` (+ AR): `palette.jump.member`.
- Shortcuts sheet / switch hint copy only if it names the jump's kinds.

## Spine reach

UI: palette Jump group and the Loy member page's arrival. No API change.

## Proof (→ `tdd` red-green cycles)

- [x] `member jump row shows for a compacted all-digits query and folds Arabic digits` · Vitest (`palette-groups.test.ts`)
- [x] `+966 55 500 0111 yields only the member row; 80001237 yields delivery, document, member in that order` · Vitest
- [x] `member row hidden while the Loy probe is pending, errored or denies; delivery/document follow canOpenDetail independently` · Vitest
- [x] `member row navigates to /loy/members with { lookup } state and no URL param` · Vitest
- [x] `palette Recent never records a member` · Vitest (`recent` unchanged / `paletteGroups`)
- [x] `lookupOf reads defensively; withoutLookup keeps the rest of the state` · Vitest (`lookup-intent.test.ts`)
- [x] Drive (stubbed `LoyWeb` envelopes):
  - A mobile jump resolves to the profile.
  - A Loy-ID jump resolves after a `LOY-00100` miss on mobile.
  - No match shows the field's sentence with the typed text.
  - Jumping while on a profile switches member.
  - Reload and Back after a jump do not re-run it.

**What was driven (2026-10-07, all stubbed):** the new `tools/loy-jump-drive.mjs` passes 27/27. It
also covers two cases beyond the bullets above: a jump made while a field lookup is still in flight
wins, and Back from a jumped-to member returns to where the jump began. Also green:
`loy-member-drive` 184/184, `command-palette-drive` 366/366. Typecheck, `npm test` (3,826), all four
lint gates and the build are green. 🚩 Nothing was driven against a live SIS.Api.

## Boundaries

- No change to `resolveMember`'s rule, to `compact`, or to the delivery/document jump rows.
- No member in palette Recent.
- No URL param carrying a mobile.
- Logical Tailwind, zero literals, bidi rule (the row value is a machine value).

## Done when

All proof boxes are ticked, and typecheck, `npm test`, lint and the build are green.

## Open questions

- Out of scope, noticed: the Loy search field may not fold Arabic digits before its own lookup.
  This was not verified. If true, it is a separate ticket.

## Comments

**2026-10-07 — built.**
- The lookup-intent names carry the feature's word: `memberLookupState`, `memberLookupOf`,
  `withoutMemberLookup`, plus `memberLookupKeyOf` (the "is it a key" check).
- `loyAccessQuery()` is new in the Loy `api.ts`; the page and the palette host both read it.
- The top-bar palette field's copy now names loyalty members.
- The decision 10 "AR" key does not apply: the repo has only an `en` locale.

**Review triage.** Fixed:
- A palette jump made while a field lookup was in flight could be overtaken by the earlier lookup's
  `onSuccess` (spec review + /code-review). Now the latest key asked for wins.
- A jump's hit **replaces** the bare `/loy/members` entry, so Back from the member returns to the
  screen the jump came from, not to an empty field (/code-review).
- The duplicated test literal (standards review).

Noted, not changed:
- The member route's entry still carries `{ typed }` in history state. This is the pre-existing
  field behaviour, which decision 7 keeps "as today", so a palette-typed mobile sits in that entry's
  state exactly as a field-typed one does.
- `memberLookupKeyOf` accepts anything that compacts to digits (`1`, `2026-10-07`). That is the
  "is it a key at all" rule decision 2 chose; the delivery and document rows accept `1` too.
- The menu leaf still builds its Loy probe from `LOY_ACCESS_KEY` + `loyAccessApi`. It shares the key,
  and `useVisibleMenu` applies the same options, so it is still one call.
- `lookup-intent` repeats `open-intent`'s strip-one-key shape. A shared core helper can wait for a
  third use.
- The copy and the "Jump to number" heading do not say a formatted mobile works.
- The "Loy ID" wording in comments and drive text versus the glossary's "loyalty id" — low weight.
