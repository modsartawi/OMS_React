---
status: open
spec: 289
blocked-by: 290
---

# 291 — The dialog opens on the lines that can still come back

## What to build

**Return Document** stops toasting *not yet available* and opens a dialog over the delivery you are
reading. The identity band, status rail and summary rail stay behind it — a return is one decision
taken about the delivery in front of you, and those rails are the context it is checked against.

The dialog's first and largest region is the **line grid**, rendered from 290's projection:

- **Fully-returned lines are absent** — not greyed — and the grid header says **how many were
  hidden**. An operator must never have to wonder whether a missing line is missing or filtered.
- Every row says how much is left: **of N left** when something has already come back, **of N
  delivered** when nothing has. Two different facts, phrased differently.
- **Select-all on lines.** Returning a whole delivery is the common case and that is the whole flow
  in one click.
- The **quantity stepper is inert until its line is ticked**, and pre-fills the full remaining
  quantity on tick. `−` disables at 1 and `+` disables at the cap, so **zero is unreachable by
  pressing** rather than rejected afterwards. Typing is clamped to the same `[1, remaining]` range,
  so the keyboard is not a way around the stepper.
- Unit price and a per-line value for the quantity selected are shown **read-only, as context**.
  There is **no grand total** — the server recomputes discount and VAT pro-rata, so any total this
  client added up would be a number it invented and an operator would quote to a customer.

The **submit bar** states **one** missing thing at a time, in the order the operator must act. This
ticket delivers the first two: *select at least one line* → *a returned quantity must be at least 1*.
Submit stays disabled throughout — there is nothing to post yet.

The arrangement is not being designed here. It is
[1270's approved build target](file:///C:/Work/DMSCO/BackOffice/.issues/assets/1270-return-screen-build-target.html);
build against the picture.

## Spine reach

logic (`return-order.ts` gains the submit gate and the quantity clamp) · component (new
`ReturnDialog`, wired into `DocumentDetailsPage`'s command switch) · i18n (the `returnDocument.*`
block begins; `returnDocument.unavailable` deleted) · test (pure vitest + a new drive)

## Proof (→ `tdd` red-green cycles)

- [ ] `clampReturnQuantity` — `[1, remaining]` for steppers and for typed input; a pasted `0`, a negative, an over-cap value and a non-numeric all land in range · pure
- [ ] `submitGate names the lines sentence when nothing is ticked` · pure
- [ ] `submitGate names the quantity sentence when a ticked line has a cleared quantity` — and **not** the lines sentence, proving one complaint at a time in the right order · pure
- [ ] `submitGate returns a key and its parameters, never a sentence` — `t()` lives at the call site · pure
- [ ] `return-dialog-drive.mjs` — pressing Return Document on a returnable delivery **opens the dialog** (and the placeholder toast is gone) · flow (Playwright)
- [ ] `return-dialog-drive.mjs` — the fully-returned line is **absent from the DOM** and the hidden count reads in the grid header · flow
- [ ] `return-dialog-drive.mjs` — a row that has been partly returned reads *of N left*; an untouched one reads *of N delivered* · flow
- [ ] `return-dialog-drive.mjs` — ticking a line wakes its stepper and pre-fills the remaining quantity; `−` is disabled at 1 and `+` at the cap · flow
- [ ] `return-dialog-drive.mjs` — select-all ticks every visible row and leaves the hidden ones out of the count · flow
- [ ] `return-dialog-drive.mjs` — the submit bar shows the lines sentence, then the quantity sentence, and Create Return is disabled in both · flow
- [ ] `return-dialog-drive.mjs` — the dialog claims **no grand total** · flow

## Boundaries

- **No network.** The dialog cannot submit; Create Return is disabled by construction until
  [294](294-submitting-names-what-comes-back.md). Cancel closes it and discards everything.
- **No new component in `core/ui`.** `Modal` already gives the wide max-width, the internally
  scrolling body and the pinned footer slot. ⚠ Its footer is `justify-end`, so the gate sentence
  rides on `me-auto` — exactly what the build target does.
- **i18n:** `returnDocument.unavailable` is deleted with the placeholder it explained. Everything new
  goes under `returnDocument.*` in the existing `document` namespace — including the *of N left* /
  *of N delivered* suffix, the hidden-lines count and the two gate sentences.
- The word **close** never appears on this screen. A return is not a cancellation and `CONTEXT.md`
  reserves that word.
- New drive: `tools/return-dialog-drive.mjs`, following `tools/document-actions-drive.mjs` — a
  manual-run tool, not a CI gate.
- No new route, no menu entry, no feature folder. This fills a placeholder on an existing screen.

## Done when

Return Document opens the dialog on a returnable delivery in the running app; the pure suite and
`return-dialog-drive.mjs` are green; `npm run typecheck` and `npm run lint` pass.

## Blocked by

[290](290-the-command-names-which-of-three-reasons.md) — the projection and the model fields the grid
renders.
