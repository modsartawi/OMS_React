---
status: done
spec: 231
blocked-by: —
---

# 239 — The lookup remembers the last five members you found

## What to build

Under the empty lookup field on `/loy/members`, a row of **up to five chips** — the keys of the last
five searches **that resolved a member**, newest first. Clicking one searches it again.

An agent works a queue of calls and comes back to the same two or three members within a shift; today
every return trip is a re-typed twelve-digit number read off a note. The chips are the cheapest
possible fix: no server, no new call, no new concept on the screen.

🚩 **This deliberately revives what [227](227-the-shape-of-the-member-screen.md) rejected.** Variant C
put a lookup rail with session recents down the side of the screen and was ruled out — it cost ~250 px
against an eight-column Sales tab and introduced a "this session" concept nobody had asked for. 227's
closing line was *"recents die with C and nothing on the screen remembers the previous member."* The
user has since asked for them back, in a form that carries neither cost: **a chip row on the empty
state only**, where there is nothing else on screen, and no rail anywhere. Do not "correct" this back
to 227 — the arrangement 227 rejected is not the one being built.

**The four decisions, settled with the user before this ticket existed** (grilled 2026-08-06):

1. 🚩 **`sessionStorage`, not `localStorage`.** A loyalty key is customer PII and this is a shared
   back-office workstation: the chips survive a reload and navigating away, and die with the tab.
   `localStorage` — the precedent `features/oms/deliveries/grid-views.ts` sets — would leave customer
   numbers on disk for whoever sits down next, and it is the wrong precedent to follow here.
2. **The chip shows the typed key and nothing else** — `966501076360`, exactly what the identity bar
   already shows as SEARCHED. No name, no LoyId, no cached member: the stored record is one string per
   chip, so there is no member data at rest anywhere and no name on screen before anyone has searched.
3. **Clicking re-runs the ordinary search** — the same submit path, so the same `resolveMember`
   cascade, the same miss sentence, the same everything. A member archived or renumbered since is
   handled identically to retyping the key. It must **not** shortcut to `/loy/members/:loyId`: that
   would need the LoyId stored per chip, and a chip whose member has since gone would land on a
   member-read error instead of the familiar "no member matches".
4. **Only a search that resolved a member earns a chip.** A miss leaves nothing — the bar is a list of
   people you looked at, not of numbers you mistyped.

**Five, not three** — five twelve-digit keys sit in one row under the centred field, and three throws
away the member you looked at four searches ago for no gain.

**The empty state only.** The chips render under the field on `/loy/members` and **not** in a resolved
member's identity bar. That bar already carries SEARCHED · Change · New lookup; a fourth thing in it
would be furniture on the screen 227 spent its argument keeping clear.

**What is stored is the key the agent typed**, not a normalised or compacted form — the chip is a
record of what they did, and the compaction to digits happens inside `resolveMember` on the way out as
it does for typing. Same string, same result, no second normalisation rule.

**Dedupe and order:** searching a key already on the bar moves it to the front rather than adding a
second chip. The list is newest-first and capped at five; the sixth push drops the oldest.

## Spine reach

**logic** (a pure recent-searches module: push · dedupe · cap · read/write, with a corrupt-storage
guard) · component (the chip row) · i18n · test

No `api.ts` change, no new model, no new route, no server call — the whole slice is client-side, which
is why it can ship while the `LoyWeb` door is still settling.

## Proof (→ `tdd` red-green cycles)

- [x] the pure module — a push moves an existing key to the front instead of duplicating it; the cap
      holds at five and drops the oldest; a blank or whitespace key is never stored; reading back
      **malformed** storage (not JSON, JSON that is not an array, an array holding non-strings) yields
      an empty list rather than throwing · **pure** — `src/features/loy/member/recent-searches.test.ts`.
      🚩 The corrupt-storage case is the one that matters: this reads a store a human can edit and a
      previous version of this code may have written, and a throw here would take the whole lookup
      screen down with it.
- [x] `tools/loy-member-drive.mjs` (extended) — a resolved search leaves a chip; a **miss leaves
      none**; clicking a chip resolves that member; a **reload keeps the bar** (`sessionStorage`, not
      component state) · **flow**
- [x] the storage key is read once per mount, not on every render, and nothing writes on a failed
      search · covered by the drive's call log

## Boundaries

- **No new npm dependency**, no server call, no new endpoint — nothing here touches the door.
- `sessionStorage` is per-tab by construction: two tabs keep two bars, and that is correct, not a bug
  to reconcile.
- ⚠ **Not `localStorage`** — see decision 1. A reviewer reading the `grid-views.ts` precedent as the
  house rule should read this line instead: grid views are the agent's own furniture, a loyalty key is
  a customer.
- Private browsing and locked-down profiles can make `sessionStorage` **throw on write**. The module
  swallows that and degrades to "no chips ever appear", which is the correct failure: a convenience
  feature must not be able to break the screen it decorates.

## Done when

The pure suite is green, `npm run lint` and `npm run typecheck` are clean, and the drive shows a chip
appearing on a hit, none on a miss, a click resolving the member, and the bar surviving a reload.

## Blocked by

—

## Answer

Built 2026-08-06. Landed: `features/loy/member/recent-searches.ts` (pure, with its suite),
`RecentSearches.tsx`, four hunks in `MemberLookupPage.tsx`, the `recent.*` block in `loy.json`, and
drive scenario 7b. No `api.ts`, no model, no route, no dependency — the whole slice is client-side.

Three things worth carrying forward:

- **The list logic and the storage are split.** `pushRecent` / `parseRecents` are pure and carry the
  twelve-case suite; `readRecents` / `saveRecents` are the thin edge that touches `sessionStorage`,
  which vitest's node environment does not have. That split is what makes the corrupt-store case —
  the one that could white-screen the lookup — testable at all.
- 🚩 **The chip is the field, pressed.** `pickRecent` fills the box and calls the SAME mutation a
  typed submit calls, so the cascade, the miss sentence and the failure banner cannot drift between
  the two ways in. Driven: clicking `100001293` produces `byMobile:100001293, byLoyId:100001293` —
  the ordinary two-call cascade, not a shortcut to the LoyId route.
- **Storage is read once per mount**, not per render: the field re-renders on every keystroke and
  `sessionStorage` is synchronous. State is the render source from then on, written through beside it.

The drive asserts what the module cannot: that a reload keeps the bar (so it is not component state)
and that **nothing matching `recent` is in `localStorage`** (so decision 1 is visible rather than
assumed).

Gates: `npm run typecheck`, `npm run lint` (three gates), `npm run build`, `npm test`
(**1215** pure cases, 76 files), `tools/loy-member-drive.mjs` **184/184** (was 177/177).

Driven live as well, against the real `LoyWeb` door on a running SIS.Api: searching `0501076360`
resolved member `1000000034` and left one chip, which survived a full page load. First slice of this
wave to be proven against a live server rather than stubs.
