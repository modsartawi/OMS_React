---
status: done
spec: 180
blocked-by: 182
---

# 184 — aWaivedDeliveryFeeSaysWhyItWasWaived

## What to build

When the delivery fee falls away, the agent can tell the caller **why** — threshold reached, or a
promotional window — instead of reading them a bare green word.

Today the *free over …* line is gated on `!waived`, so it **vanishes at the exact instant it would
explain itself**. That is the defect this slice fixes; `deliveryFee.waivedReason` (contract v1.5) is
the field that fixes it.

🚩 **The console must not derive the reason** by comparing `totals.gross` against
`deliveryFee.thresholdGross`. The rule lives in `CallCenterDeliveryFeePolicy`, the one copy the till,
the live quote and the submit all call ([156](156-delivery-fee-shared-rule.md)) — a second
implementation on this screen is exactly what that ticket was raised to prevent. An unrecognised
reason draws the waived state with no reason rather than a guessed one.

Under `PickInStore` the fee region is **absent, not zero** — that is [182](182-mode-flips-the-screen-payment-word-follows.md)'s
work and this slice must not undo it.

## Spine reach

model (`deliveryFee.waivedReason`, already present) · logic (a receipt view rule) ·
component (receipt) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `deliveryFeeView` — each `waivedReason` yields its own phrase; a waived fee with a **null** or
      unrecognised reason yields the waived state and no reason; a test that would fail if anyone
      derived the reason from `gross` vs `thresholdGross` · pure
      — `fulfilment-view.test.ts` › `theFeeSaysWhatHappenedToIt`, 5 cases, 18/18 green.
- [x] `fulfilment-176-drive.mjs` extension — the fee region is absent under `PickInStore` and the
      reason renders under `Delivery` · flow (Playwright) — 108/108, scenarios `waivedThreshold` /
      `waivedCampaign` / `waivedUnknown` against the four `pickup*` states.

⚠ `waivedReason` is v1.5 and **BackOffice 874 is unbuilt**, so the waived arm is proved from a
stubbed response and the drive's own footer says so (177's rule).

## Boundaries

**Server:** BackOffice [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md) §2
(contract v1.5, additive).
**i18n:** existing namespace; one key per reason plus the reasonless waived state.
Blocked by 182 because that slice decides whether this region exists at all.

## Done when

A waived fee in the running app names its reason, the *free over …* line no longer disappears at the
moment of waiving, and no code path compares `gross` to `thresholdGross`.

## Outcome — 2026-07-29

Most of this slice's spine landed **inside 182's commit**: 182 had to draw the delivery region to
prove *absent, not zero*, and a region drawn at all forces the question of what the waived arm says.
So `feeLine`, `receipt.waivedReason.*` and the three drive scenarios arrived early.

What was **not** done, and is this session's work: the degrade for an **unrecognised** category was
decided in the receipt by `t(key, { defaultValue: '' })` — a rule living in whether a translation key
happened to resolve. That is a §9 rule sitting in the i18n layer, unprovable by a pure test (the
Proof's own wording asks for exactly that test), and one empty string in `callcenter.json` silently
changes it. The set of categories this console can **say** moved into `fulfilment-view.ts` as
`WORDED_REASONS`, `feeLine` now returns `waivedNoReason` for anything outside it, and the receipt's
`t()` call is unguarded because the key can no longer miss.

The anti-derivation guard is **structural, not just tested**: the `waived` arm of `FeeLine` carries
no `thresholdGross` at all, so a later edit wanting to explain a waiver by comparing it against a
total has no number in scope. `grep` confirms `thresholdGross` is read in exactly one place — the
*free over …* sentence on the standing-fee arm — and compared against nothing.

## Blocked by

[182](182-mode-flips-the-screen-payment-word-follows.md)
