---
status: open
spec: 983
blocked-by: 989
---

# 992: Ctrl K can reorder, send the location link, switch fulfilment and take the next slot

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

New rows in `palette-model.ts` (D13):
- Reorder last order;
- Send location link;
- Switch to collect / Switch to deliver;
- Next free slot;
- Apply a held coupon.

Each is enabled exactly when its handler is handed in, and a refused row carries its reason. *Place
order* and *Abandon* stay terminal rows with no chord (153, 192, 365 §7).

## Spine reach

pure (`palette-model.ts`) · page wiring · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `newRowsAreEnabledOnlyWithAHandler` · pure
- [x] `noChordReachesATerminalAct`: the existing guard still holds with the new rows · pure

## Boundaries

No wire change.

## Done when

Every new row works from Ctrl K on the walk.

## Comments

**2026-11-27 — built on `t/992` (implementer).**

- `palette-model.ts`: five new verbs — `reorderLast`, `sendLocationLink`, `switchFulfilment`,
  `nextFreeSlot`, `applyHeldCoupon` — each beside the verb whose subject it shares. Enabled exactly
  when a handler is handed in; a withheld one is a disabled row with its reason. Reasons: the switch
  borrows `fulfilment.locked.*` (canChangeFulfilment), the held coupon `coupon.shut.*`
  (canApplyCoupon); two fact-guarded sentences, `palette.reason.NO_CALLER_HISTORY` (no caller) and
  `palette.reason.COLLECTION_HAS_NO_SLOT` (pickup); otherwise the vague sentence. The switch is named
  by where it goes (`switchFulfilment.toCollect` / `.toDeliver`). Keys in en + ar. No `keys` on any
  row; Place order / Abandon remain the only terminals.
- `slot-view.ts` `nextFreeSlot(days, held)`: the first window with room (server `status`) after the
  held one, across days; the first with room when none is held or the held one is not in the list;
  `null` when nothing later has room (tested).
- Page wiring (`ConsoleShell` gains one `shortcuts` prop, spread into the palette's verbs):
  - *Send location link* — while `canSendLocationLink`; bumps an `askToSend` counter on
    `LocationLinkPanel`, which opens its own send dialog. With a link already held it does NOT send
    a second one: it focuses the panel's first live button (Resend / Send again / Apply).
  - *Switch to collect / deliver* — open order, `canChangeFulfilment` gate open, no flip in flight;
    opens the fulfilment section and runs `setFulfilment` to the other mode (success closes the
    section; a refusal stays drawn in it).
  - *Next free slot* — open delivery order with a plant, no slot apply in flight; reads the windows
    fresh, opens the slot section and `setSlot`s `nextFreeSlot` (a lapse / failure draws in the
    picker; nothing free or a failed read just opens the picker).
  - *Reorder last order* — **NOT wired**: 990's reorder handler is not on this branch. Row listed
    disabled ("Attach the caller first…" without a caller, the vague sentence with one). Wire
    `shortcuts.reorderLast` after 990 merges.
  - *Apply a held coupon* — **NOT wired**: the console has no read of the caller's held coupons
    (`CouponPicker` reads only the coupons already on the order, and 987 invents no new read).
    Row listed disabled with the coupon-shut / vague reason until a held-coupon source exists.
- Drive: `tools/callcenter-location-drive.mjs` gains a 992 step: the three wired rows listed
  enabled, the switch named *Switch to collect* on a delivery order, reorder + held coupon listed
  disabled, no console row carries a chord, and Ctrl K → *Send location link* opens the dialog
  pre-filled. All five passed in LTR (vite :5211); the run later died on a `page.goto` 30 s
  timeout in an unrelated step (cold vite while tests/lint ran alongside), so the RTL pass of
  the step did not run.
- Owed: live walk (Done when) — the switch and next-slot rows are not driven end to end; reorder +
  held-coupon wiring.
