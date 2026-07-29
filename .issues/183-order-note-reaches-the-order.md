---
status: open
spec: 180
blocked-by: —
---

# 183 — theOrderNoteReachesTheOrder

## What to build

The agent types what the caller told them and it travels with the order.
[175](175-nothing-enters-an-unaddressed-order.md) ruled the order note **in**; nobody built it, and
`api.ts` has no `setOrderNote`.

A chip like every other header field — it opens a modal, takes free text, and saves. Clearing it
(sending `null`) is a real act, so a stale instruction never travels with the order. It carries no
submit blocker: an order with no note is an ordinary order.

The sidecar's `OrderNote` column is BackOffice [871](C:\Work\DMSCO\BackOffice\.issues\871-cc-opening-gate-and-plant-source.md)'s
one new column, so this slice is genuinely one field wide on both sides.

## Spine reach

model (`header.orderNote`, already present) · api (`setOrderNote`) · logic (`header-chips`) ·
component (page wiring + a small form) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `header-chips` — the note chip carries its text when set and reads as unset when `null`;
      it never contributes a submit blocker · pure
- [ ] `callcenter-drive.mjs` extension — typing a note, reloading, and reading it back; then
      clearing it and confirming it is gone rather than blank-but-present · flow (Playwright)

## Boundaries

**Server:** BackOffice 871 (contract v1.3's remaining verb). Envelope codes: `SESSION_CLOSED`,
`SESSION_BUSY` (existing retry).
**i18n:** existing namespace; chip label, modal title, placeholder, save/clear.

## Done when

A note typed in the running app survives a refresh and a second tab, and clearing it removes it
rather than leaving an empty string.

## Blocked by

None — can start immediately.
