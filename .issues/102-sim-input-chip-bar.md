---
type: wayfinder-ticket
wayfinder: prototype
map: 097
status: done
blocked-by: 101
---

# 102 — The input chip bar: collapse, expand, edit, and the stale run

## Question

The map ruled that the input region collapses into a chip bar once a run has been processed, and
[101](101-sim-screen-device-prototype.md) places it. This ticket settles **how it behaves** — the
part that decides whether the space saving is a gift or a trap.

1. **What the collapsed bar says.** Seven header fields, two checkboxes, N item rows and M manual
   conditions do not fit one strip. Which are chips, which are a count (`5 items`), and which are
   simply not shown when they hold their default? A chip bar that shows everything has saved nothing.
2. **What expands it** — a click anywhere, a named control, a chip's own affordance? And does it
   expand **in place** (pushing the results down) or **over** the results? The first is honest, the
   second keeps the results still; pick one and say why.
3. **Does it auto-collapse?** On Process is the obvious moment. Is there a moment it auto-*expands*
   — a failed run whose cause is an input, for instance?
4. **Editing after a run — the stale-result question.** The moment an input changes, the results on
   screen describe a basket that no longer exists. Today the form and the results sit side by side
   and the screen says nothing about it. Under a chip bar the inputs are *further* from the results,
   which makes the silence worse. Rule it: does the result region mark itself stale, does the
   Process control change, or does nothing happen? **Watch the scope line** — this is presentation
   of a state the app already has, not new run semantics; a rule that re-runs, blocks, or discards
   results is behaviour and belongs to a different effort.
5. **The items and manual-conditions grids.** They are *editable* surfaces, not parameters — a chip
   is not an editing affordance ([100](100-sim-chip-vocabulary.md) rules that out). Do they collapse
   with the form, stay visible, or become a summarised strip that expands to the editor?
6. **Keyboard and focus.** Where focus lands on expand, and whether the analyst's re-run loop
   (tweak one field → Process) still works without reaching for the mouse.

7. **The in-flight shape**, folded in from the map's fog by [101](101-sim-screen-device-prototype.md):
   the strip owns Process, so it owns the seconds after it is pressed. Does the strip say anything
   while a run is out, do the previous results stay on screen, and what happens to `Edit ▾` and the
   two other run controls? 099 recorded "the same screen with one spinner" as today's answer;
   101 approved a strip dense enough that a spinner has nowhere obvious to go.

Note 101's ruling on where this lives: the chips, `Edit ▾`, the money readout and the three run
controls are **one unframed strip**, not a chip bar under a separate headline band, and expansion
replaces the collapsed row **in place**. Sub-question 2's "in place vs over" is therefore narrowed to
its mechanics, not its principle.

Draw the collapsed bar, the expanded state, the in-flight state and the stale state in the prototype. Real field values
from [098](098-simulate-payload-capture.md), including the case where a field holds its default and
the case where every optional field is blank.

## Answer

**Ruled.** Owner session, 2026-07-25, against
[`assets/102-input-chip-bar.PROTOTYPE.html`](assets/102-input-chip-bar.PROTOTYPE.html) — five states
(settled · expanded · stale · in-flight · whole-run 400), three chip sets (5 / 8 / 9), three
staleness treatments, manual conditions closed and open, both themes, every value from 098's
`03-applied-and-potential` and `04a-unknown-material`. All four open rulings went to the drawn
option; the prototype **is** the answer, and the seven sub-questions resolve as below.

### The structural idea: one status slot, three states

The strip carries **a single status slot** between the chip set and the money readout:

| Slot state | When | What it says |
|---|---|---|
| **absent** | the inputs on screen produced the results on screen | nothing — silence is the healthy state, exactly as an `ok` line carries no mark (100) |
| **stale** | any input differs from the request that produced the on-screen result | `↻ Inputs changed` |
| **in flight** | a Process is out | `Processing…` + spinner |

So **stale, in-flight and settled are one slot in three states**, not three inventions. The slot is
deliberately **not a chip** — it changes while you read it, which is precisely what 100's chip test
excludes — and it is drawn as a dashed neutral pill (`bg-muted`, dashed `border-strong`) so it reads
as a different species from the chips beside it. It is the **only new form** this ticket adds.

**Staleness is neutral by force, not by taste.** 100 spent the entire hue budget — `success` on a
fire, `attention` on a `W`. Amber on a stale run would break that budget *and* promise a fault where
there is none: nothing is wrong, the screen is simply describing an older basket.

### 1 — What the collapsed bar says: the header, and nothing else

Five chips at rest — `PLANT P001` · `ORG 1000` · `CHAN 20` · `25 Jul 2026` · `PROMO on` — rising to
eight when the three test levers are set and nine with `ELEM on`, exactly the counts 100 predicted.

- **Determination fields chip even when they hold their defaults.** Ruled deliberately against the
  tempting alternative (chip only what differs, so the strip's *length* means "unusual run"). 098
  finding 8 decides it: an invalid plant prices silently, so the determination a run actually used
  must be readable without expanding anything. A strip that says nothing because everything is
  ordinary cannot distinguish "ordinary" from "not shown".
- **Levers and flags are the opposite** — blank ⇒ no chip, per 100 §4.
- **No counts in the strip at all.** `5 items` and `2 conditions` were both rejected: they would
  summarise a frame that is *right there* and never collapses. The manual-conditions count rides its
  own disclosure label inside Items, where the thing it counts lives.

### 2 — What expands it: the chip set *is* the control

One `<button>` wrapping the chips, ending in a visible `Edit ▾` tail — **one tab stop for seven
fields and two checkboxes**, one `aria-expanded`. The chips inside are spans and never act on their
own (100 §3 forbids it). Expansion **replaces the collapsed row in place** (101 §3), so nothing below
moves except by the form's own height and the results stay where the eye left them. Collapse: the
same control (now `Done ▴`), `Esc`, or Process.

**The money readout is gone, not moved, while the form is open** — a total belongs to a run, and once
you are editing you are no longer looking at that run's inputs. Process / Clear / Wipe cache move
into the form's footer so the run loop is never more than one control away.

### 3 — Auto-collapse: on every Process. Auto-expand: never.

One rule, no exceptions — **including a Process that 400s**, which is still a Process. The screen must
not move itself while the analyst is starting to read a failure. The rejected alternative was
reopening the form focused on the offending field when the envelope blames the header (098's bad
distribution channel).

Instead the **400 banner carries the route**: an item fault (`INVALID_UOM`) points at Items
(`Fix it in Items ↑`), a determination fault points at the run settings and opens the form **on
click**. The analyst chooses the moment. Per 101 the banner replaces the work area and Items stays
put; the money readout is **absent rather than zeroed**, because a failed run has no total.

### 4 — Staleness: the slot says it, the work area confirms it once

Treatment **A**. Two marks, both neutral: `↻ Inputs changed` in the slot (where the change happened)
and one dashed line above the results — *"These results describe the previous run — one input has
changed since."* Nothing dims, nothing disables, nothing is discarded.

- **Treatment C (dim the money)** was rejected: it costs a readable total on a loop whose whole point
  is comparing this run's total with the last one, and dimming reads as "invalid" rather than "older".
- **Treatment B (silence, as today)** was rejected on the ticket's own argument — under a chip bar
  the inputs sit further from the results, so the silence gets worse, not better.

**Watching the scope line, as the ticket demands:** this is presentation of state the app already
holds. No re-run, no block on Process, no discard of results — all three would be run semantics and
belong outside this map.

**The seam this hands the spec:** staleness is a pure comparison of the *current* request against the
request that produced the on-screen result — the same `SimulateRequest` the page already builds, so
it is a pure function over two payloads and the one genuinely testable module this ticket creates.
Every input counts (header fields, both checkboxes, item rows, manual-condition rows), because every
one of them feeds the request.

### 5 — Items and manual conditions: neither collapses, neither joins the strip

099's two-lifetimes ruling, drawn. Manual conditions stay a **disclosure inside the Items frame** —
no fourth frame (101 §4) — with a count on the label when non-empty, and **the disclosure opens
itself whenever rows exist**. That last part is a direct answer to 098 finding 6: the grid's own
default (`itemNumber: 0`) is a value the server rejects, so a manual condition sitting silently
behind a closed twisty is the difference between an explicable run and an inexplicable 400.

### 6 — Keyboard and focus

- Expand → focus **Plant**, the first field.
- `Esc` → collapse, focus returns to the chip set (never lost to the document).
- **`Ctrl`+`Enter` → Process from anywhere**, including inside the items grid and the form. This is
  what makes the tweak-one-field-and-re-run loop mouse-free, and it is signposted on the button
  itself (`▶ Process ⌃⏎`).
- Process keeps focus across the collapse, because it is in the strip in **both** states — the one
  concrete benefit of the strip owning the run controls.

### 7 — The in-flight shape (folded in from the map's fog)

The slot's third state, and nothing more:

- **The previous results stay on screen.** 098's runs return in 184–268 ms; blanking them would be a
  flicker of nothing, and the analyst is comparing this total against the last one.
- **The spinner waits 150 ms** before appearing, so an ordinary run never flashes a spinner.
- A hairline indeterminate bar runs along the strip's **own bottom edge** — inside the strip's
  border, so it introduces no new region and no layout shift.
- The inputs, `Clear` and `⛁ Wipe cache` **lock** (today's behaviour, `process.isPending`).
  `Edit ▾` is **disabled rather than hidden** — hiding it would reflow the strip twice per run.
- `▶ Process` becomes a disabled `Processing…`, which is what 099 recorded as today's answer; what
  changes is that it is no longer the *only* thing that says so.

### What this hands on

- [103](103-sim-deep-layers-placement.md) — the manual-conditions disclosure is now specified
  (inside Items, counted, self-opening); it is one of the four disclosures 103 arranges, and it may
  not become a frame.
- [105](105-sim-responsive-arrangement.md) — the strip has **four wrap groups** in source order:
  chip set · status slot · money · run controls. Where they wrap is 105's, but the slot must never
  wrap away from the chips it is commenting on.
- [106](106-sim-rtl-mirroring.md) — the slot, the `Edit ▾` tail and the in-flight hairline all take a
  direction; the hairline's animation is the one physical-direction exception on the strip.
- **The spec** — one pure module (the request-comparison staleness predicate), one 150 ms timer, one
  `Ctrl`+`Enter` handler, and `aria-expanded` on the chip-set button. Nothing else here is state.
