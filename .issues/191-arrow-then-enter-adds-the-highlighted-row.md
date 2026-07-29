---
status: open
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

- [ ] `highlight` — `↓` from nothing highlights the first row; `↑` from nothing highlights nothing
      (or the last, per the module's ruling — assert whichever, so it is a decision and not an
      accident) · pure
- [ ] `highlight` — a new query **resets** the highlight; a shorter result set clamps rather than
      pointing past the end · pure
- [ ] `highlight` — inert while the gate is shut and while an add is in flight · pure
- [ ] `callcenter-drive.mjs` extension — `↓` then `Enter` in the search box adds the highlighted item
      and the basket gains exactly one line · flow (Playwright)
- [ ] `callcenter-drive.mjs` extension — **the negative**: `Enter` with **nothing** highlighted adds
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
