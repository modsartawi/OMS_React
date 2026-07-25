---
status: done
spec: 110
blocked-by: 113, 123
---

# 120 — The screen's non-result states: pre-run, manual conditions, and the whole-run failure

## What to build

The three states that are not a successful run, all of which the frame budget changed and none of which
the earlier slices cover.

### Pre-run: the form open, one sentence, **no empty frames**

Before any Process the run strip is **expanded as the form** — there is no run to condense, and this is
the moment the determination fields are actually set. Below it, the Items frame with one blank row. Where
the work area will be: **one line of quiet text**. Not a framed empty box, not a skeleton, not a sample
basket. Nothing has happened, so there is nothing to draw — **that is the reclaim**. Eleven frames and
seven headings become three and three after a run, and **one and one** before the first Process.

The three test levers — procedure key, loyalty group, loyalty tier — live in the open form, always
reachable, and never appear as chips unless set. They are **deliberate test levers, not vestigial
fields**: the procedure key selects another pricing procedure to test, and the loyalty fields exercise
promotions restricted to a tier.

Two alternatives were offered and **declined**: recalling the last run (real behaviour, outside this
rework's scope line — it can be proposed as its own ticket) and a worked example (occupies space with
fiction).

### Manual conditions: a disclosure inside Items that opens itself

Manual conditions stay a **disclosure inside the Items frame** — **no fourth frame** — with a count on
the label when non-empty. **The disclosure opens itself whenever rows exist.** That is a direct answer to
a capture finding: the grid's own default item number is a value the server **rejects**, so a manual
condition sitting silently behind a closed twisty is the difference between an explicable run and an
inexplicable 400.

Items themselves never collapse and never join the strip — they are the instrument retyped every run.
`itemConditionControl` stays a **permanent, labelled column**: setting it to `M` is how a coupon, which
carries no base price, is priced without failing. It is load-bearing, and it explains a capture finding
that was filed without understanding.

### The whole-run 400: the banner replaces the work area

Failures arrive as **whole-run 400s** — no per-line error was produced on any capture, and only warnings
ride a 200. So this is the only evidenced failure path and it is worth building properly.

- **The banner replaces the work area** rather than pushing it down, so a failed run never leaves the
  previous run's results sitting below an error. **Items stays exactly where it was**, so the offending
  line is corrected in place.
- **The banner carries the route.** An item fault points at Items; a determination fault points at the
  run settings and **opens the form on click** — never automatically. The analyst chooses the moment;
  the screen must not move itself while they are starting to read a failure.
- **The money readout is absent rather than zeroed**, because a failed run has no total.
- The strip still **collapses on this Process**, because a Process that fails is still a Process.

## Spine reach

component (pre-run, the Items disclosure, the failure banner) · i18n · test (drive)

## Proof (→ `tdd` red-green cycles)

- [x] `before the first Process the screen is the open form, the Items frame and one sentence` — no empty frames, no skeleton, no sample basket · **flow (Playwright, new `tools/sim-states-drive.mjs`)**
- [x] `the manual-conditions disclosure opens itself whenever rows exist` — and carries a count on its label · **flow (same drive)**
- [x] `a whole-run 400 replaces the work area, leaves Items in place, and opens the form only on click` — with the money absent rather than zeroed · **flow (same drive)**
- [x] `faultRoute` maps an envelope to `items` / `settings` / no route · **pure (vitest, `fault-route.test.ts`)** — added beyond the agreed seams: the routing rule is the one piece of this slice with a pure surface, and every case is an envelope the 098 session actually produced.

## Boundaries

No API change and no change to Process/Clear semantics. The existing whole-run error path and its
`ApiError` handling are reused, not rewritten — this slice changes **where the banner sits and what it
points at**, not how failures are classified. **i18n:** `banner.failed` survives and the
manual-conditions key family is unchanged; the pre-run sentence reuses `summary.noResult`. If the
banner's routing hints need copy the ledger did not anticipate, add it to
[123](123-sim-i18n-key-expand.md) rather than to the locale file from here — that file has one owner for
the duration of the expand phase.

**Concurrency:** this slice owns `tools/sim-states-drive.mjs` and **drive port 5204** — a drive of its
own rather than an extension of [113](113-sim-run-strip.md)'s, so it can run in the same wave as
[114](114-sim-status-slot.md) without contending for that file or its port. Work in a git worktree.

## Done when

Driving the app: a fresh screen shows the open form, the Items frame and one line of text with no empty
frames; loading a basket with manual conditions opens that disclosure by itself with a count on the
label; and a run that 400s replaces the work area with a routed banner, leaves Items untouched, shows no
money, and opens the form only when the route is clicked. The extended strip drive green.

## Blocked by

- [113](113-sim-run-strip.md) — pre-run *is* the strip expanded, and the banner's route opens it.
- [123](123-sim-i18n-key-expand.md) — the locale file's single owner during the expand phase.

## Done 2026-07-25

Built on `ticket/120-sim-non-result-states` (a worktree off `main` @ `e8632fc`).

**Pre-run.** `stripOpen` starts `true`, so the first paint is the open form; Process still collapses it
and nothing auto-expands. The work area became a **single slot with exactly three occupants, never a
stack** — the failure banner, the Results frame, or one `<p>` of `summary.noResult`. The right column
(promotion blocks · detail · bonus-buy tabs) is absent entirely with no result: its dashed
`summary.noResult` box was itself a frame drawn around nothing.

**Manual conditions.** `SimManualConditions` lost its frame and became a disclosure rendered as
`SimItemsEntry`'s `children`, inside the Items frame. `open` is **derived, not stored** —
`rows.length > 0 || emptyOpen` — so it cannot be shut while rows exist; the local state only decides what
an *empty* disclosure does. While rows are there the label is a plain heading with a count pill rather
than a twisty, so no control is offered that would do nothing. `itemConditionControl` keeps its permanent
`Control` column, untouched.

**The 400.** A new pure module, `fault-route.ts`, reads the route **off the machine code, never off the
server's English**: the two faults the 098 captures produced from the basket carry codes
(`INVALID_UOM`, `INVALID_CONDITION_ITEM_LEVEL`) and route to Items; the determination rejection came back
code-less, so any other business 400 routes to the run settings; anything that is not a business envelope
(the 500 a negative quantity returns) carries **no** route rather than a guess. `SimFailureBanner` renders
it inside the work-area slot — an item fault as a sentence, a determination fault as a **button** that
calls `setStripOpen(true)` on click and never by itself. `ErrorBanner` gained an optional `children` slot
so the danger-token surface stays in one place.

**Proof.** `tools/sim-states-drive.mjs` (port 5204) **27/27**; 113's `tools/sim-strip-drive.mjs`
**29/29**; `npx vitest run` **173/173** across 9 files; `npm run typecheck`, `npm run lint` (all three
gates) and `npm run build` green.

**Review (`/standards-review`, both axes).** Standards clean on all four rules. Three findings applied:
the empty disclosure's label drops to `font-medium` so the pre-run screen spends **one** heading, not two;
`results.empty` lost its call site here and joined `RETIRING_KEYS` for 121; the RTL chevron comment no
longer claims 121's story for a chevron 121 could not have swept.

**Two findings answered rather than applied.**

- *"The locale file was edited from this slice."* The keys have to land in `simulation.json` for anything
  to resolve; "add it to 123" is a **ledger** instruction, and 123's own boundary says "add it here in a
  follow-up edit rather than in the slice". [113](113-sim-run-strip.md) set exactly this precedent with
  `strip.done`. The four keys are in 123's follow-up block and in `i18n-keys.test.ts`.
- *"The disclosure cannot be closed while rows exist, so spec story 25's count-without-opening is
  unreachable."* Correct, and deliberate: this ticket's own words are "**The disclosure opens itself
  whenever rows exist**", justified by a hazard — "a manual condition sitting silently behind a closed
  twisty is the difference between an explicable run and an inexplicable 400" — that a latch (auto-open on
  arrival, closable afterwards) reintroduces. Under the lock the count is a **summary**, not a peek. The
  ticket wins over the story it derives from; flagged for 121's close-out if the spec would rather keep
  story 25 literal.

**Two notes for the wave.**

1. `tools/sim-strip-drive.mjs` needed a **four-line** edit: its collapsed-row assertions read the strip at
   first paint, which is now the open form. It collapses the strip first and defers the pre-run state to
   this slice's own drive. That is the one file this slice touched outside its own — flagged because
   [114](114-sim-status-slot.md) owns port 5199 and may be extending the same file.
2. **In flight, the work area still empties.** `useMutation` clears `data` when the next mutation starts,
   so a re-run shows the pre-run sentence until the response lands, where the spec wants the previous
   results to stay. That is unchanged behaviour (it showed `results.empty` in the same window before), and
   it is the in-flight path — [114](114-sim-status-slot.md)'s. Left for that slice rather than solved
   here, per this ticket's own "114 wins" rule.

**Deliberately not blocked by [114](114-sim-status-slot.md).** The original slicing coupled them because
the failure path and the in-flight path both live on the strip, but that is a soft coupling: the 400
banner's *money absent rather than zeroed* rule does not need the status slot to exist. The edge was
dropped so this slice can run beside 114 rather than behind it. If the two do turn out to fight over the
strip's state handling, 114 wins and this slice rebases.
