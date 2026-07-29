---
status: done
spec: 180
blocked-by: 182, 183, 187, 189, 191
---

# 192 — ctrlKReachesEveryOrderActWithoutEndingTheCall

Lands **last** because a palette row cannot exist for a verb that is not wired. Its five blockers are
the five slices that supply its rows.

## What to build

One key reaches everything the order can do.

**`Ctrl+K` / `Cmd+K` opens a command palette from anywhere in the console, including from inside any
text box** — because the agent lives in a text box all day. It must `preventDefault()`: it is
Chrome's omnibox-search key and **is** interceptable (Linear, Slack and GitHub all take it). It is
**inert while any `<dialog>` is open** — a palette over a confirmation sheet is two truths on one
screen. Build it on `core/ui/Modal`, the native `<dialog>`, so focus trap and restore are free.

**Rows come from `SessionState`, in this order:**

1. **Actionable offers** — the strip's own view model, read once, exactly as `ConsoleShell` already
   does for the top-bar count, so **the palette and the count can never disagree**. `Alt+1..3` was
   rejected: the cards re-order as the basket moves, so a number is a *position*, not an offer.
2. **Order verbs**, one row each: *Search items* (which is also the way home for an agent whose focus
   is stranded on a chip), *Address book*, *Change store*, *Delivery slot*, *Source & reference*,
   *Order note*, *Fulfilment mode*, *Payment type*, *Apply coupon*, *Attach caller* / *Remove
   caller*, *Refresh*.
3. **The two terminal acts**, sorted **last** and **never auto-highlighted**.

🚩 **Nothing on the keyboard can end a call.** *Place order* and *Abandon call* are palette rows and
nothing else; sorted last and never the auto-highlighted row, so a mistyped `Enter` cannot reach
them. If a query matches *only* `Abandon call`, the palette highlights **nothing** and the agent must
press `↓`. *Abandon* still opens its existing `Keep`-defaulted modal on top.

🚩 **A refused verb is a disabled row carrying its reason** — the console's **one deliberate
exception** to the standing law that a control the door would refuse is worse than no control. The
law is about a control the agent's hand *lands on*; the palette is a question the agent **asked**,
and an empty answer to a deliberate question teaches nothing. Disabled rows stay **highlightable**
and `Enter` on one does nothing — skipping them would hide the very reason the exception exists.
Enablement is always the `capabilities` boolean; the reason is always a separate
`capabilityReasons` lookup, so a missing reason is a vague sentence and never a wrong refusal.

**The palette is the whole cheat sheet.** No `?` (it types a question mark into the box the agent is
in), no `F1`. Four keys do not justify a second surface that can drift out of date: the foot carries
`↑↓ move · ↵ run · esc close`, and `Ctrl+K` is advertised in the **search box's placeholder**, where
the caret already is on every call. The known cost is accepted: it disappears the moment the agent
types.

**Line verbs stay out.** `changeQty`, `changeUom` and `voidLine` take a *line*, and a palette row for
them needs a second step. The palette is **one level deep and its object is the order** — which also
keeps the highest-risk of the three, *void*, aimed at a line the agent is looking at. The basket
keeps its own controls and stays `Tab`-reachable.

## Spine reach

logic (`palette-model` — new; reuses 191's `highlight`) · component (the palette + the placeholder
hint) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `palette-model` — row order: offers, then order verbs, then the two terminals **last** · pure
- [x] `palette-model` — the terminals are **never** the auto-highlighted row, including when the
      query matches only one of them · pure
- [x] `palette-model` — a disabled row is highlightable, carries its `capabilityReasons` phrase, and
      running it does nothing; a row with no reason available still renders disabled · pure
- [x] `palette-model` — offer rows are read from the strip's view model, asserted against the same
      fixture that drives the top-bar count, so the two cannot drift · pure
- [x] new `tools/command-palette-drive.mjs` — `Ctrl+K` opens from inside the search box and from
      inside the phone field · flow (Playwright)
- [x] `command-palette-drive.mjs` — **the negatives, asserted as hard as the positives**: `Ctrl+K`
      over an open confirmation sheet does nothing; no *mistyped* key sequence reaches *Place order*;
      *Abandon* reaches only its `Keep`-defaulted modal · flow (Playwright)

**Built** — 29 pure (`palette-model.test.ts`) + `command-palette-drive.mjs` 44/44, typecheck, lint
and build green.

`palette-model.ts` takes the strip's `GuidanceView` (read ONCE in `ConsoleShell`, where the top-bar
count is read, so the two cannot drift by construction) and a record of **handlers** — never
`capabilities` booleans. A row is enabled exactly when the page handed it the same handler the chip,
the rail or the receipt already reads, so an act withdrawn from one surface is withdrawn from both.
`ConsoleShell` needed **no new prop**: every palette row runs a handler the shell already had.

Three rulings taken during the build, all beyond the ticket's letter:

1. 🚩 **An offer row hands off to the item search** (172's `onSearchRest`) rather than adding. A
   near-miss names no material to add — an add row would need `ResolvePrereq` run for every
   actionable offer the instant the palette opens. The strip resolves one card, on demand; the
   palette gives the strip the keyboard path US91 asks for and leaves the add where it is aimed.
2. 🚩 **The aim is carried against the query AND the row ids** (`paletteQuestion`). The rows are
   rebuilt from the live `SessionState`, so an add landing or an offer arriving reshuffles them
   under an open palette with the query untouched — and `highlight.ts` clamps an over-long index to
   the LAST row, which here is *Abandon call*. Folding the ids in makes any such change a new
   question, which falls the aim back to `autoHighlight`, which never aims at a terminal.
3. 🚩 **`Ctrl+K` is `preventDefault()`ed BEFORE the inert check.** *Inert* must mean this console
   does nothing — not that Chrome does something: left to its default the key puts the caret in the
   omnibox, so an agent reaching for it over an open sheet would leave the application entirely.

⚠ **One place the letter and the grammar disagree, resolved in favour of 153.** The Done-when reads
*no sequence of keys places or abandons an order without its modal*; 153 ruling 3 says *Place order*
"presses the button the receipt already gates on `canSubmit`", and submit has no modal anywhere on
this console. So the two guards that ARE specified — sorted last, never auto-aimed — are what stand
between a mistyped `Enter` and it, and both are asserted; a **deliberate** `↓` then `Enter` places
the order exactly as the receipt's own button does, which the drive asserts for what it is (one
`Submit`, one `requestId`). *Abandon* keeps its `Keep`-defaulted modal, asserted with the wire
proving nothing was voided. If the owner wants submit gated behind a confirmation, that is a new
ticket about the receipt's button, not about the palette.

⚠ **`palette.reason.*` is one key per capability the contract has NOT yet given a code.** The
fulfilment and payment refusals are worded from the chip row's own `fulfilment.locked.*` /
`payment.locked.*` families — one refusal, one sentence, whichever surface asked — and a dead
*Place order* borrows the receipt's `submitBlockers`. The one reason quoted rather than looked up is
§6.3's attach-before-address ordering, guarded on `hasCaller` being false so it can never be a wrong
refusal.

## Boundaries

**No server dependency.** Every gate is a `capabilities` field the client already holds; 153
deliberately did **not** mint a field for this, because [176](176-fulfilment-mode-drawn.md) had
already minted `capabilityReasons` for the chip row's identical problem and one field serves both.
**i18n:** existing namespace; one key per row, the foot's four hints, the placeholder hint.
⚠ Note the file-name collision risk: `tools/palette-drive.mjs` is unrelated to the existing
`tools/palette-drive.mjs` for the POS colour palette — pick a distinct name
(`command-palette-drive.mjs`).

## Done when

In the running app, `Ctrl+K` from inside any text box opens a palette listing the live offers and
every order-level act, refused verbs read as disabled rows carrying their reason, and no sequence of
keys places or abandons an order without its modal.

## Blocked by

[182](182-mode-flips-the-screen-payment-word-follows.md) ·
[183](183-order-note-reaches-the-order.md) ·
[187](187-agent-creates-and-corrects-an-address.md) ·
[189](189-coupon-names-itself-and-comes-off.md) ·
[191](191-arrow-then-enter-adds-the-highlighted-row.md)
