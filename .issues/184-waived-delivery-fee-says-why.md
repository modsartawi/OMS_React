---
status: open
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

- [ ] `deliveryFeeView` — each `waivedReason` yields its own phrase; a waived fee with a **null** or
      unrecognised reason yields the waived state and no reason; a test that would fail if anyone
      derived the reason from `gross` vs `thresholdGross` · pure
- [ ] `fulfilment-176-drive.mjs` extension — the fee region is absent under `PickInStore` and the
      reason renders under `Delivery` · flow (Playwright)

## Boundaries

**Server:** BackOffice [786](C:\Work\DMSCO\BackOffice\.issues\786-web-cc-submission-path.md) §2
(contract v1.5, additive).
**i18n:** existing namespace; one key per reason plus the reasonless waived state.
Blocked by 182 because that slice decides whether this region exists at all.

## Done when

A waived fee in the running app names its reason, the *free over …* line no longer disappears at the
moment of waiving, and no code path compares `gross` to `thresholdGross`.

## Blocked by

[182](182-mode-flips-the-screen-payment-word-follows.md)
