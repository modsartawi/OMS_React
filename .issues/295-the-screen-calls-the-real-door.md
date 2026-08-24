---
status: open
spec: 289
blocked-by: 294
---

# 295 — The screen calls the real door

## What to build

Everything before this ticket was built and verified against **checked-in fixtures**. This one points
the finished screen at a live SIS.Api and creates a real bonded return on dev.

🔑 **This ticket IS the drift detector, and both specs say so.** The §2/§2b types in this repo are a
**transcription**; a request type has nothing here to typecheck against, so this call is the only
gate on the copy. A `400` on the first live call — a rejected field name, a missing `requestId`, a
field spelled differently from what was transcribed — is a **drift report against BackOffice spec
1283 §2/§2b**, not a frontend bug.

> ⚠ **The spec is corrected first, then the transcription — never the transcription alone.** The
> correction is made in
> [1283](file:///C:/Work/DMSCO/BackOffice/.issues/1283-web-bonded-return-door-spec.md), in the
> BackOffice repo at `C:\Work\DMSCO\BackOffice` — and only then copied back here. Patching the
> TypeScript to make a 400 go away leaves the two halves disagreeing with nothing left to catch it.

**First job, before anything else.** BackOffice spec 1283 §2b says the delivery line gains "a
returned-so-far **(or remaining)** quantity" and gives the arithmetic for both — but **never names
the field**. This repo transcribed `returnedQuantity` and derives remaining as
`quantity − returnedQuantity`. That is a **guess about a shape this repo does not own**. Confirm
against the live model: the exact field name, and whether the server sends returned-so-far or
remaining. Whatever it turns out to be, 1283 §2b is amended to name it before this repo changes a
line.

**Then walk the paths that only a live door can prove:**

- a real return created against a real BZ02 delivery — the number in the toast is the number in
  `SdDocumentHeader`;
- the **same `requestId` posted twice** replays: same number, `replayed: true`, and exactly **one**
  `ORRT` behind it;
- a **partial quantity** consumes only what was returned — reopening the delivery shows the line's
  remaining reduced by that amount and no more;
- a delivery with **every line exhausted** comes back `canReturn: false`, and the command renders the
  *everything has already been returned* reason;
- a **non-Starlinks bonded delivery** refuses with its machine code, and the banner renders it;
- a ticked fee credits at its rate, **once** — not twice, and not zero.

An **RTL pass** on the dialog rides here, as `tools/document-rtl-drive.mjs` does for this screen
family.

## Spine reach

api (the live call) · model (whatever §2b's confirmed spelling turns out to be) · component (only if
drift forces it) · test (the drive, re-run live) · **and, if drift is found, an edit to BackOffice
spec 1283 in the sibling repo — first**

## Proof (→ `tdd` red-green cycles)

- [x] `§2b field name confirmed` — the live delivery model's returned/remaining field is read and matched against the transcription; any mismatch is written into BackOffice spec 1283 §2b **before** this repo is touched · manual, ⚠ **confirmed against the owning SOURCE, not a live wire** (see below)
- [ ] `a return is created against a live BZ02 delivery` — `200`, and the toast's number is the persisted `ORRT` · flow, live
- [ ] `the same requestId replays` — same number, `replayed: true`, exactly one `ORRT` behind it · flow, live
- [ ] `a partial quantity consumes only what was returned` — the reopened delivery's remaining is reduced by exactly that amount · flow, live
- [ ] `an exhausted delivery disables the command with the right reason` · flow, live
- [ ] `a non-Starlinks bonded delivery refuses` — the banner carries the server's sentence and its code · flow, live
- [ ] `a ticked fee credits once at its rate` — not twice, not zero · manual, against the created return
- [x] `the dialog mirrors under RTL` · flow (Playwright) — `tools/document-rtl-drive.mjs` §6, **41/41**; needs no live door (the drive mocks the wire)

## Progress — 2026-08-24: the two items that did not need the door

The ticket stays **open**. `SIS.Api` answers nothing on `:5111` (connection refused), and BackOffice
[1282](file:///C:/Work/DMSCO/BackOffice/.issues/1282-the-return-door-is-smoked-on-dev.md) — *the
return door is smoked on dev* — is itself still `open`, so the live half has not been stood up by
its own side yet. Every remaining Proof item is a live walk and none of them was faked. But two
items turned out not to need the door, and both are done.

**1. §2b's field name is confirmed — and there is NO drift.** The first job did not have to wait for
a live call: BackOffice ticket 1277 is `done`, so the shape's **owner** is on disk. Read from
`SdDocumentLineModel` / `SdDocumentHeaderModel` and `Sd/ReturnDoor/ReturnableQuantity.cs`:

| | |
|---|---|
| the field | **`ReturnedQuantity`** — settable, stamped on every line by the delivery load path |
| the direction | **returned-so-far.** The client subtracts. |
| its twin | `RemainingReturnableQuantity`, computed `Quantity - ReturnedQuantity` |

So this repo's transcribed `returnedQuantity`, and its `remaining = quantity − returnedQuantity`,
were **right** — the guess this ticket existed to catch was a correct guess. The server also ships
the computed remainder; deriving it here off the same base is conforming, and 1283 §2b now says so
in as many words.

🔑 **The spec was still wrong, and was corrected first.** §2b genuinely never named either field —
that gap was real, and it outlived the implementation. 1283 §2b now carries both names, their kinds,
the delivered base (`Quantity`, not `ConfirmedQuantity`/`BaseQuantity`), and ⚠ the rule that
**`RemainingReturnableQuantity` can be NEGATIVE, so a screen hides on `<= 0`, never on `== 0`** —
§2b leaves the subtraction unclamped because §9's wrong-`PrecedingDocumentLine` bug can pile one
line's returns onto another's. This repo already hid on `<= 0` and already had the over-returned
case under test; the comments claiming the field "does not exist on the wire yet" were stale and are
now accurate, and the over-return test says why it is a documented shape rather than a hypothetical.

⚠ **What this does NOT confirm**: the JSON casing on the wire, and that the computed property
actually serializes. Source is the owner, but it is not the wire — that stays for the live walk.

**2. The RTL pass is done and mutation-checked.** `tools/document-rtl-drive.mjs` mocks the wire, so
it never needed the door. Section 6 opens the return dialog in both directions and measures **logical**
gaps, so a correctly-mirrored element reports byte-identical numbers either way — which it does:
the `me-auto` gate sentence, the `text-end` money cell, the leading select column. 🚩 Asserted
non-vacuous by mutation: swapping the cell to `text-right` and the gate to `mr-auto` leaves **both
`ltr` checks passing byte-identically** and fails exactly the two `rtl` ones. That asymmetry is the
entire hazard — a physical utility is invisible in the direction we develop in. **41/41.**

Gates: typecheck · lint · build green, **1978** pure cases. No app behaviour changed — the only
source edits are comments brought into line with the confirmed contract.

⚠ Still carried into the live walk, from 294: 292's district fallback can pair a chosen
`districtCode` with a blank `cityCode`, and that now **posts**.

## Boundaries

- ⚠ **Blocked on the BackOffice half shipping.** Nothing in this repo can unblock it: it needs
  `SdDocumentWeb/CreateReturn`, `canReturn` and the line's returned/remaining field live on a dev
  SIS.Api. Until then this ticket stays `open` and unstartable — that is expected, and it is why it
  exists as a numbered issue from the start.
- **Real documents are created on dev.** Each one enqueues a real return-delivery job behind it.
  Create deliberately and note what was created; do not loop.
- **Do not touch the return pipeline** — the return delivery, the carrier booking, the refund are
  live in production and untouched by either half of this effort. This ticket observes them, it does
  not change them.
- **Recorded gaps, expected and not defects of this wave:** the carrier's weight field exists and OMS
  has never sent it; `buildingNumber` and `postalCode` are collected by this screen and carried on
  this wire but are still **dropped downstream** by a server-side copy this effort does not touch, so
  they do not reach the courier today. If they are observed missing at the carrier, that is
  [map 1266](file:///C:/Work/DMSCO/BackOffice/.issues/1266-the-return-order-the-web-cannot-yet-create.md)'s
  separate effort, not drift.

## Done when

A real bonded return is created from the web against a live SIS.Api and replays on retry; every path
above is walked; and either no drift was found, or BackOffice spec 1283 has been corrected **and**
this repo's transcription brought into line with it.

## Blocked by

[294](294-submitting-names-what-comes-back.md) — the screen must be able to post before it can post
for real.

Externally: BackOffice spec 1283's own tickets, in `C:\Work\DMSCO\BackOffice\.issues\`.

## Open questions

- **What is §2b's field actually called, and which direction does it count?** Named above as this
  ticket's first job. The answer belongs in BackOffice spec 1283 §2b, not here.
- **Which dev delivery is the fixture for the live walk?** Needs a real BZ02 delivery with remaining
  quantity, and a second one already exhausted. Identify both before starting.
