---
status: open
spec: 380
blocked-by: 392
---

# 394 — The palette lists the last five records opened

## What to build

The palette gains a **Recent** group between This screen and Go to. It holds the last **5**
deliveries and documents opened through Delivery details, newest first.

- **Recording.** Opening `oms/delivery/:deliveryNo` or `oms/document/:documentNo` records the
  **number only**, plus whether it is a delivery or a document, once the header has loaded. A
  record that is not found or is denied is not recorded.
- **Storage.** It is kept per browser in `localStorage` **keyed by user id**. It never stores the
  customer, the mobile or the OTP. Re-opening a number moves it to the front, with no duplicates.
- **Defensive parse.** A malformed or foreign store reads as an empty list and never throws.
- **Gating.** The group is **re-filtered by the current grants on every open**. A delivery or
  document row needs `canOpenDetail`, and a pending or errored probe hides the group (fail closed).
- **Choosing a row** navigates to the route, and the page applies its own gate.

**Implements:** spec 380 **K9** and **D11** (the recording half, on today's Details page).

**Rulings:** [364](364-what-the-command-palette-holds.md) §1 (Recent: numbers only, per user, which
contrasts with 239's `sessionStorage` PII ruling) and §2 (re-filtered by current grants).

## Spine reach

store/logic (a pure Recent store: push, cap, parse, filter) · component/route (Details records on
load; `layout/` composes the group) · i18n (`common:palette.recent`) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `recentKeepsFiveNewestNumbersOnly`: pushing 7 numbers keeps the newest 5 in order, and a
  re-push moves a number to the front with no duplicate. The stored value holds only kind + number
  · pure
- [ ] `recentParseIsDefensiveAndPerUser`: a malformed JSON value, a wrong shape or another user's key
  each read as an empty list · pure
- [ ] `recentRefiltersByCurrentGrants`: with `canOpenDetail` denied or pending, the group is
  empty/hidden · pure
- [ ] `tools/command-palette-drive.mjs`, extended. After opening two deliveries, Ctrl+K lists them
  under Recent, newest first, and choosing one lands on its Details page · flow (Playwright)

## Boundaries

- No new API endpoint.
- One key, `common:palette.recent`.
- The `document` feature's Details page calls a core recorder from `@/core/commands`. It may not
  import `layout/`.

## Done when

Recent shows the last five opened numbers per user, gated by current grants, and the proof tests
and the drive are green.

## Blocked by

[392](392-ctrl-k-opens-one-palette-with-go-to-and-jump.md).
