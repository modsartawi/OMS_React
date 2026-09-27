---
status: open
spec: 324
blocked-by: 327
---

# 328 — The Prescription card's Files · N · Show row switches to the Attachments tab

## What to build

The summary rail's **Prescription** card gains a **Files · N · Show** row (spec 324 → "The Prescription card and the
Files row").

- **N** is 327's number, the same one the badge shows.
- The row shows only when both hold:
  - the tab would show (a "files row allowed" flag the page computes from 327's gate);
  - N > 0.
- `fields.ts` stays **pure**. It receives N and the flag and never reads the probe.
- **Show** selects the Attachments tab. On a first selection that starts the one ByOwner read, exactly as clicking
  the tab does.
- The card's rule ("show when any row has a value") now counts the Files row. An order with files but no approval
  number, patient, clinician, eRx or link shows the card with only its Files row.
- The **"Rx document"** link row is unchanged.
- **The card row type gains an optional `action`**, a callback rendered by `SummaryRail` as a button (logical
  utilities, an `aria-label` via `t()`), beside today's optional `href`. A row has one or the other.

**Words:** "Files" and "Show" go in the `document` namespace.

## Spine reach

store/logic (`fields.ts`) · component (`SummaryRail`, page wiring) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [ ] `fields.test.ts`, new cases:
      - the Files row is present only with the flag **and** N > 0;
      - the card shows on the Files row alone;
      - the Rx link row is unchanged, and a row carries `action` or `href`, never both;
      - the existing cases stay unchanged.

      · pure (vitest)
- [ ] `order-attachments-drive` gains these checks:
      - Show switches to the tab, with one ByOwner on the first switch and none after;
      - no Files row without the gate or with N = 0;
      - the card appears on files alone.

      `document-cards-drive` and `document-rail-drive` stay green. · flow

## Boundaries

No endpoint. New `document` keys. A small, local extension of the rail's row type.

## Done when

On a stubbed order with files, the Prescription card shows Files · N · Show, and clicking Show opens the Attachments
tab with its single read. `fields.test.ts` and the drives are green.

## Blocked by

[327](327-opening-the-attachments-tab-lists-the-orders-files-once.md)
