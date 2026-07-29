---
status: done
spec: 180
blocked-by: 181
---

# 191 — arrowThenEnterAddsTheHighlightedRow

🚩 **This slice fixes the map's headline feature being mouse-only**, and it is the **only slice in
spec 180 with no server dependency at all** — every gate it needs is a `capabilities` field the
client already holds. If the server track slips, this one is unaffected.

## What to build

The agent can put a line on the order without taking their hand off the keyboard.

[153](153-console-keyboard-grammar.md) found that neither a search row's *Add* nor a guidance card's
had **any** keyboard path — the map's one-click-add-from-a-near-miss shipped as a mouse target. It
also killed the obvious design: a Gmail-style grammar armed "when you are not typing" cannot work
here, because the resting focus is a text box **twice over** — the rail `autoFocus`es the phone field
at open, and the search box **re-focuses itself after every landed add**, deliberately. So the
grammar works **from inside the text box the agent is already in**.

- **`↓` / `↑`** move a highlight over the search results.
- **Nothing is highlighted until the first press.** 🚩 The reason is 131's own unsolved problem: the
  match clause is a non-sargable `LIKE '%…%'` over two description columns, so the top row is a
  relevance **guess**, and a one-key add of a guess puts a line on a live order. Two keys is the
  price of every add being aimed. (The rejected middle — arm `Enter` when exactly one row returned —
  was a rule the agent would have to model before pressing.)
- **The highlight resets on every new term**, so a stale highlight never adds the wrong item.
- Both are **inert** while `add.onAdd` is null (the opening gate is shut) or an add is in flight.
- **`Enter` on a highlighted row calls the same handler the row's button calls**, reading
  `capabilities.canAddItem` from the same prop. **Never a second predicate.**
- **`Esc` in the search box with text** clears the box and keeps the caret — already built, including
  the `stopPropagation` that stops a sheet above from also acting on it. Confirm it still holds.

The same highlight model is reused by [192](192-ctrl-k-reaches-every-order-act.md), so build it as a
module rather than as component state.

## Spine reach

logic (`highlight` — new pure module) · component (`ItemSearchPanel`, `GuidanceStrip`) · i18n
(the palette-foot hints land in 192; nothing user-visible here beyond existing keys) · test

## Proof (→ `tdd` red-green cycles)

- [x] `highlight` — `↓` from nothing highlights the first row; `↑` from nothing highlights nothing
      (or the last, per the module's ruling — assert whichever, so it is a decision and not an
      accident) · pure — **ruled: `↑` from nothing highlights NOTHING**, and it is asserted as a
      decision. Wrapping to the last row would arm `Enter` on the least relevant guess in the list,
      which is the same defect the two-key grammar exists to prevent. `↓` at the end stays put; `↑`
      off the first row hands the highlight back to nothing (the way out is the key that came in)
- [x] `highlight` — a new query **resets** the highlight; a shorter result set clamps rather than
      pointing past the end · pure
- [x] `highlight` — inert while the gate is shut and while an add is in flight · pure
- [x] `callcenter-drive.mjs` extension — `↓` then `Enter` in the search box adds the highlighted item
      and the basket gains exactly one line · flow (Playwright)
- [x] `callcenter-drive.mjs` extension — **the negative**: `Enter` with **nothing** highlighted adds
      nothing at all · flow (Playwright)

## Boundaries

**No server dependency.** No new endpoint, no new envelope code, no new capability.
**i18n:** none beyond what exists.
Blocked by [181](181-console-drive-green-on-clean-tree.md) because it extends `callcenter-drive.mjs`,
which is red on a clean tree today.

## Done when

In the running app, `↓` then `Enter` in the search box adds the highlighted item; `Enter` alone adds
nothing; and the keyboard obeys exactly the same gate the button does.

## Blocked by

[181](181-console-drive-green-on-clean-tree.md)

## Built

- **`highlight.ts`** — the whole grammar, as a module and not component state: `moveHighlight` (one
  arrow press) and `highlightedRow` (which row is aimed at *right now*). Two rulings live in the
  shape rather than in a caller's discipline. The highlight is carried **with the term it was set
  against**, so a new question drops it by construction — the stale-highlight add is the one failure
  here that is silent and lands on the caller's basket. And a shorter answer to the **same** question
  **clamps** to the last row rather than dropping the agent's aim, because the catalogue moving under
  a long call is not the agent changing their mind. It holds no row, no item number and no verb —
  the caller indexes its own list, which is what lets [192](192-ctrl-k-reaches-every-order-act.md)
  reuse it over the palette unchanged.
- **`ItemSearchPanel`** — the grammar, armed from inside the box the agent is already in. 🚩 The gate
  is one expression, `add.onAdd !== null && add.pending === null`, which is **the same condition the
  row's own *Add* is drawn and disabled on**: there is no second predicate a keyboard could get
  through a door the button cannot. `Enter` calls the same handler with the same two arguments the
  button passes, so there is no keyboard-only add path to drift. The arrows `preventDefault()` (an
  unhandled arrow jumps the caret to the end of the term and the next character lands in the wrong
  place mid-call), and a key still **finishing a word** is ignored outright — half this console's
  searching is Arabic, and an IME's own `Enter` and arrows reach the handler as ordinary keys. The
  aim is drawn as ground **and** an inset ring, direction-neutral so it mirrors for free.
- **`GuidanceStrip` — untouched, deliberately.** 153's table gives the guidance card's *Add* its
  keyboard path through the **palette** (192's offer rows), not through an arrow grammar of its own:
  a second highlight over a second list, both armed from the same box, is two lists competing for
  one `Enter`. Its buttons remain natively tab-reachable meanwhile.
- **`callcenter-drive.mjs`** — boxes 41–43. 41 takes **the negative first and with the gate wide
  open** (rows on screen, `Enter`, and nothing at all happens), then `↓` → the first row aimed with
  the caret still in the box → `Enter` → exactly one `AddItem`, carrying the same body the button
  sends, for exactly one basket line. 42 proves a new term drops the aim, and that `Esc` still clears
  the box and keeps the caret. 43 proves the shut gate is shut to the keyboard too.

**Verified:** 13 pure cases green (`highlight.test.ts`); `npm run typecheck`, `npm run build` and
`npm run lint` clean; the drive run **490/491** against the running app, with all 24 of this
ticket's own checks green. ⚠ The one failure is *the chip row is what the header captures* — a
**concurrently in-flight** change to `header-chips.ts` in the same working tree (another session's
188/header work), not this slice. The drive was therefore run from a clean `HEAD` copy carrying only
this ticket's two hunks, so the number is about this change and nothing else.
