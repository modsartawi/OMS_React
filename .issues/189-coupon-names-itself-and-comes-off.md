---
status: open
spec: 180
blocked-by: —
---

# 189 — theCouponNamesItselfAndComesOff

## What to build

`applyCoupon` shipped in v1.0 and the projection deliberately **hides** the `COUP` voucher line it
creates — rightly, because its money is already flattened onto the product line. Nothing replaced it,
so an applied coupon moves the total and **names itself nowhere**: its discount arrives as an
`AppliedBonusBuy`, which carries no coupon attribution at all, and the agent's only way to discover a
coupon is to apply it again and read the refusal. There is no way to take one off.

`CouponPicker`, `coupon-view` and the `coupon` chip already exist and are proved by
`coupon-159-drive.mjs`; `ConsoleShell` already accepts `onChangeCoupon`. **`CallCenterConsolePage`
supplies nothing** — that, plus the two verbs, is the work.

**The coupon is the last chip in the row**, carrying the **code and never the amount** — the chip row
has never held money, so the amount draws in the modal and the receipt gains no coupon row. It is the
only chip an order need never fill and carries no submit blocker.

Three rules that are not obvious and must be built as written:

1. **A shut gate is not a shut chip.** `canApplyCoupon` gates *applying*; the list projects
   regardless, because an order may hold a coupon the agent has to read out on a call where a new one
   may not be applied. `canRemoveCoupon` is the **server's boolean and never `coupons.length > 0`** —
   whether a remote reversal hop can be attempted is not a count.
2. 🚩 **`COUPON_REVERSAL_REFUSED` means NOTHING CHANGED.** The server reverses *before* it voids, so
   a refusal leaves the order untouched and the coupon still on it — the **opposite** of what a
   failed remove normally means. An agent told *"could not remove"* would reasonably tell the caller
   the discount had gone. The console says it in those words, and names `abandon` as the escape.
3. 🚩 **A coupon-gated near-miss is stated, never offered.** Capture 02 already offers `COUPT173` — a
   **coupon SKU** — as an addable material prerequisite, and prerequisite matching has no line-type
   filter, so a plain add qualifies the bonus buy **while burning nothing**. The fourth
   `prereq.kind`, `coupon`, draws as its own class: not actionable (no basket change reaches it), not
   unavailable (it is real, and the caller may hold the coupon), **not counted** in the top bar's
   *offers within reach*, and answered at the coupon chip. `guidance-view` already carries the class.

A second, *different* coupon is accepted — the engine holds a list and the duplicate check is
per-code, so the console must not enforce a one-coupon rule the engine does not have.

## Spine reach

model (`header.coupons[]`, the two capabilities, `prereq.kind` — already present) ·
api (`applyCoupon`, `removeCoupon`) · logic (`coupon-view`, `guidance-view`) ·
component (page wiring) · i18n (already present) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `couponSurface` — the list projects while `canApply` is false, with the reason carried;
      `canRemove` is the server's boolean and a test that would fail if anyone derived it from
      `coupons.length` · pure
- [ ] `guidance-view` — a `coupon` prereq classifies as `needsCoupon`, is **not** counted in the
      actionable total, and an unknown future kind still degrades safely · pure
- [ ] `coupon-159-drive.mjs` **re-pointed at the wired console** — applying, reading back, applying a
      second different code, removing; a refused removal renders the *nothing changed* sentence and
      the coupon is still listed · flow (Playwright)

## Boundaries

**Server:** BackOffice [879](C:\Work\DMSCO\BackOffice\.issues\879-cc-coupon-projection-removal-and-signup-branch.md)
— **implementing now**. Contract v1.10, additive. Envelope codes: `COUPON_REJECTED`,
`COUPON_ALREADY_APPLIED`, **`COUPON_REVERSAL_REFUSED`** (new), `NO_CUSTOMER_ATTACHED`,
`STORE_NOT_CHOSEN`.
**i18n:** ✅ `chips.coupon`, `coupon.*` and `guidance.needsCoupon` already exist from the prototype.
⚠ Every state is a **stub** until 879 lands, and the drive must keep saying so in its own output.

## Done when

In the running app the chip names the coupons on the order, the modal shows each one's amount,
applying is refused with real words before a caller and a chosen store, a refused removal says
nothing changed, and a coupon-gated offer has no Add button and does not raise the top-bar count.

## Blocked by

None — can start immediately. ⚠ Shares `CallCenterConsolePage` with
[182](182-mode-flips-the-screen-payment-word-follows.md); run them in sequence rather than
concurrently.
