---
status: open
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

- [ ] `before the first Process the screen is the open form, the Items frame and one sentence` — no empty frames, no skeleton, no sample basket · **flow (Playwright, new `tools/sim-states-drive.mjs`)**
- [ ] `the manual-conditions disclosure opens itself whenever rows exist` — and carries a count on its label · **flow (same drive)**
- [ ] `a whole-run 400 replaces the work area, leaves Items in place, and opens the form only on click` — with the money absent rather than zeroed · **flow (same drive)**

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

**Deliberately not blocked by [114](114-sim-status-slot.md).** The original slicing coupled them because
the failure path and the in-flight path both live on the strip, but that is a soft coupling: the 400
banner's *money absent rather than zeroed* rule does not need the status slot to exist. The edge was
dropped so this slice can run beside 114 rather than behind it. If the two do turn out to fight over the
strip's state handling, 114 wins and this slice rebases.
