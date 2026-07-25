---
status: done
spec: 110
blocked-by: 113
---

# 114 — The status slot marks a stale run and an in-flight one

## What to build

Fill the slot [113](113-sim-run-strip.md) left empty in the strip. **One slot, three states** — so
staleness and in-flight become one form rather than two separate inventions:

| State | When | What it says |
|---|---|---|
| **absent** | the inputs on screen produced the results on screen | nothing — silence is the healthy state, exactly as a healthy line carries no mark |
| **stale** | any input differs from the request that produced the on-screen result | `↻ Inputs changed` |
| **in flight** | a Process is out | `Processing…` + spinner |

The slot is **deliberately not a chip** — it changes while you read it, which is precisely what the chip
test excludes — and reads as a different species: a dashed neutral pill. It is **the only new component
the whole rework adds.**

**Staleness is a pure module**: the current `SimulateRequest` compared against the request that produced
the on-screen result. Every input counts — header fields, both checkboxes, item rows and
manual-condition rows — because every one of them feeds the request. The trap to defend against is the
false positive: `''`, `null` and `undefined` on an optional field must **not** read as a change, or the
mark sticks on permanently and stops meaning anything.

**Staleness is neutral by force, not by taste.** The screen's whole hue budget is two — success on a
fired promotion, attention on a `W` line — and amber here would break that budget *and* promise a fault
where there is none. Nothing is wrong; the screen is simply describing an older basket.

**It marks, and does nothing else.** No re-run, no block on Process, no discard of results — all three
would be run semantics and sit outside this rework's scope line. A stale run keeps its results fully
readable and undimmed, because the loop's whole point is comparing this total against the last one.
Alongside the slot, one dashed neutral line above the results says once, in words, that these results
describe the previous run.

**In flight**, the third state and nothing more:

- **The previous results stay on screen.** Captured runs return in 184–268 ms; blanking them would be a
  flicker of nothing.
- **The spinner waits 150 ms** before appearing, so an ordinary run never flashes one.
- A hairline indeterminate bar runs along the **strip's own bottom edge** — inside its border, so it
  introduces no new region and no layout shift.
- Inputs, `Clear` and `⛁ Wipe cache` lock on the existing pending flag. **`Edit ▾` is disabled rather
  than hidden** — hiding it would reflow the strip twice per run. `▶ Process` becomes a disabled
  `Processing…`.

## Spine reach

store/logic (the pure staleness predicate) · component (the slot; in-flight treatment on the strip) ·
i18n · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] `an input differing from the request that produced the results reads as stale` — header field, lever, checkbox, item row and manual-condition row each count; no prior run is not stale · **pure**
- [x] `blank, null and undefined on an optional field are not a change` — the false positive that would stick the mark on permanently · **pure**
- [x] `a run in flight keeps the previous results, waits 150 ms for its spinner, and disables Edit rather than hiding it` · **flow (Playwright, extends `tools/sim-strip-drive.mjs`)**

## Boundaries

No API change; no re-run, block or discard — presentation of state the app already holds. **i18n:**
`strip.stale` is already minted by [123](123-sim-i18n-key-expand.md); call it, do not add keys here. The
in-flight text **reuses `actions.processing`** — the same string appears in the slot and on the disabled
Process button, so it is one key in two places, not a new one.

**Concurrency:** extends `tools/sim-strip-drive.mjs` on **port 5199** — the same drive
[113](113-sim-run-strip.md) created, which is safe because 113 is done before this starts. Nothing else
in this wave touches that file. Work in a git worktree.

## Done when

Driving the app: changing any input after a run raises `↻ Inputs changed` in the slot plus the dashed
line above the results, with the results left readable and undimmed; pressing Process shows
`Processing…` with the spinner suppressed on a fast run and the hairline on the strip's edge; and the
mark clears when the new results arrive. Both pure tests and the extended strip drive green.

## Blocked by

[113](113-sim-run-strip.md) — the slot is a group within the strip and has nowhere to live until the
strip exists.

## Comments

**Done 2026-07-25** on branch `ticket/114-sim-status-slot` (worktree, per the concurrency note).

**What landed.** `staleness.ts` — the pure predicate, canonicalising both sides before comparing so
`''`, `null`, `undefined` and an absent key are one absence and a rebuilt request object is not a
change; item rows normalise **in array order**, since the server numbers by position (contract 486),
so a reorder is a different basket. `SimStatusSlot.tsx` — the rework's one new component: a dashed
neutral pill (`bg-muted` + dashed `border-strong`, a chip's own ground so nothing is borrowed from
the two-hue budget), three states, plus `SimStaleResultsNote` for the confirmation above the results
and `useSpinnerVisible` for the 150 ms wait. The strip mounts the slot in **both** its collapsed and
expanded rows and runs the indeterminate hairline on its own bottom edge. The Page holds the run on
screen in its own state — a mutation clears `data` the moment `mutate` is called again, so keeping
the previous results was a prerequisite, not a nicety.

**Proof.** `staleness.test.ts` — 30 vitest cases: the single-field permutations on a hand-built
request (a capture cannot be edited one field at a time) **plus** a closing block driven by the 098
captures' own request halves, exposed as `REQUESTS` in `__fixtures__/payloads.ts` (seven of the
eleven captures recorded one; the two owner-supplied ones are absent rather than reconstructed).
`tools/sim-strip-drive.mjs` extended 29 → **51 assertions, 51/51 green** on port 5219 (see the
concurrency note below). `npm test` 192/192, `typecheck`, `lint` and `build` green.

**Three judgement calls, recorded because a reader will ask:**

1. **No new i18n key.** The line above the results says `strip.stale` in the same words as the slot —
   one key in two places, exactly like `actions.processing` — rather than minting a second sentence
   for one state. The ticket's own i18n boundary ("call it, do not add keys here") is the reason;
   123 kept sole ownership of `simulation.json` and this slice edited it not at all.
2. **The Process button's icon rides the same 150 ms flag as the slot's spinner**, so "an ordinary
   run never flashes a spinner" holds for the whole screen rather than for one of its two spinner
   sites. For the first 150 ms the button reads `Processing…` behind its `▶` glyph.
3. **The stale line above the results stands down while a run is out.** The slot's three states are
   exclusive; two vocabularies for one state, live at once, would undo that. The mark returns only
   if the arriving results are themselves stale.

**Concurrency note.** The drive is written for port 5199 as the ticket specifies, but a *stale* dev
server from an earlier session was still answering on 5199 — serving the old checkout, which would
have made every new assertion pass against code that does not contain them. It was run against a
worktree-local server on **5219** instead (`DRIVE_PORT` is honoured by the file). Anyone re-running
it should check what is on 5199 first.
