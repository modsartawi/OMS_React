---
status: done
spec: 289
blocked-by: 291
---

# 293 — The fees carry back only when ticked, and the note is optional

## What to build

The dialog's second grid and its last field.

**Delivery fees to refund.** The delivery's conditions arrive whole on the model the details page has
already loaded; a pure projection reduces them to the header delivery-fee rows and the grid renders
those:

- Only rows at **`condDocumentLine === 0`** in the delivery-fee category.
- ⚠ **The money is `condAmount` — the rate.** `condValue` on a header row is structurally `.000`, and
  reading it is a **silent zero**: no exception, a green suite, and a fee that displays as costing
  nothing. This is the trap `header-condition-money.md` (in the BackOffice repo) exists to prevent.
- ⚠ **Never summed with the per-line copies.** One ticked fee exists as the item-0 row *and* as one
  distributed copy per line. Taking both charges it twice. The projection takes the item-0 row alone.
- **Unticked on open**, and **no select-all**. Refunding a delivery fee is a **concession** — the
  service was performed — so it is always a deliberate act, and a tick-everything control beside a
  guard that exists on purpose is a one-click way through it.

**The two grids are stacked, not tabbed.** The fee grid is two rows and is not a peer of the line
grid. Tabbing buries a money decision behind a tab an operator has no reason to open — and unlike
Document Details' own tabs, which hide *readings*, a hidden tab here would hide a **selection the
submit is about to act on**.

**The note.** One optional free-text field — the return's own reason in words, which the warehouse
reads at BZ02. Optional, because making it required manufactures the word "return" typed into a box;
the structured reason is what actually drives behaviour. It is **not** the `add-note` action's note,
which is running commentary on a document.

## Spine reach

logic (`return-order.ts` gains the fee projection) · component (`ReturnDialog` grows the fee grid and
the note field) · i18n (grid headers, the unticked-by-default hint, the note label and placeholder) ·
test (pure vitest + the drive)

## Proof (→ `tdd` red-green cycles)

- [x] `refundableFees keeps only header delivery-fee rows` — a per-line row and a non-fee category row are both dropped · pure
- [x] `refundableFees reads condAmount` — a fixture whose `condValue` is `0` and whose `condAmount` is the real rate projects the **rate**, which is the regression that would otherwise be silent · pure
- [x] `refundableFees never sums the distributed copies` — a fee present as the item-0 row plus one copy per line projects **once**, at its rate · pure
- [x] `refundableFees on a delivery with no fees` — an empty projection, not a crash · pure
- [x] `return-dialog-drive.mjs` — the fee grid renders **stacked below** the line grid, both visible at once · flow (Playwright)
- [x] `return-dialog-drive.mjs` — every fee is **unticked on open**, and there is **no select-all** in the fee grid's header · flow
- [x] `return-dialog-drive.mjs` — the note field is optional: the submit bar reaches its ready summary with the note empty · flow

## Boundaries

- ⚠ **The delivery-fee category code lands in this repo as a display constant.** There is no *is a
  header fee* flag on the wire and BackOffice spec 1283 does not add one. This does **not** reopen
  1267's refusal of a second `BZ02`: that is a value a running program branches on to decide whether
  money moves, so a second copy diverges silently; this one decides **which rows are drawn**, the
  server re-reads the rate for every type it is given and owns the money regardless, and a wrong
  filter is visible on screen the instant it is wrong. Carry spec [289](289-bonded-return-screen-spec.md)
  D4's reasoning as a comment at the constant, so it reads as a decision rather than an oversight.
- **No money on the wire, and none invented on screen.** The fee's rate is **displayed** context; the
  request will carry the fee's **type** and nothing else ([294](294-submitting-names-what-comes-back.md)).
- Still no network. Submit remains disabled.
- i18n: new copy under `returnDocument.*` in the existing `document` namespace.

## Done when

Both grids render stacked in the running app with the fees unticked and their rates correct; the pure
suite and `return-dialog-drive.mjs` are green; `npm run typecheck` and `npm run lint` pass.

## Blocked by

[291](291-the-dialog-opens-on-the-lines-that-can-come-back.md) — the dialog and its grid region.

Independent of [292](292-the-reason-decides-whether-an-address-is-asked-for.md): different panels,
different pure functions. Either may be taken first at the frontier.
