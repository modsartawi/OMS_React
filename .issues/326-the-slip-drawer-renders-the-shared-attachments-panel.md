---
status: open
spec: 324
blocked-by: 325
---

# 326 — The slip drawer renders the shared attachments panel, and the four slip drives pass unmodified

## What to build

**Prefactor, second half of the lift** (spec 324 → "The lift into `core/attachments/`"). There is no behaviour change.
The visual body of `SlipDrawer.tsx` moves into one shared **attachments panel** under `src/core/attachments/`, which
the slip drawer then renders. These parts move:
- the stored list with its till text;
- the Withdrawn (n) list;
- the preview, with object URLs revoked on selection change and on leave;
- the list error and the withdraw notice;
- the Add (`SlipAdd`) and the withdraw dialog (`SlipWithdrawDialog`).

**The panel's parameters** (the seam 327–331 plug into):
- owner kind, owner key, category, kind;
- the ByOwner read's **freshness** (325's parameter). The slip drawer keeps a new read on every opening;
- the **reason list as data**, `{ code, label, labelArabic?, noteRequired }[]`. The slip drawer resolves its five
  bundle keys into this shape, with Other as `noteRequired`. 331 passes the server's `withdrawReasons` instead;
- the **caller's words**: the empty sentence and the Add label;
- whether Withdraw is offered (the caller's gate). The bare-403 "take it away for this visit" stays inside the panel;
- `onChanged`. The slip drawer passes `markSlipDayChanged` through it.

Add stays the slip's multi-file, no-caption Add. The one-file-with-caption mode is 330's, so do not build it here.
If a seam for it falls out naturally, leave it unexercised.

**Stays in `collection/inquiry`:** `DrawerFrame` (the native `<dialog>`, its title and in-flight close guard), the
grid-staleness hook, the slip count/column/chip, and the slip reason keys.

**i18n.** A new `attachments` namespace (`src/locales/en/attachments.json`), registered centrally in `core/i18n.ts`,
holds the panel's own words. The slip drawer's generic keys move into it **with their values unchanged**. Slip-specific
words (the drawer title, "No slips…", the slip reasons, the Add label) stay in the slip's namespace and are passed in.

## Spine reach

component · i18n · test (drives)

## Proof (→ `tdd` red-green cycles)

- [ ] `slip-drawer-drive`, `slip-add-drive`, `slip-withdraw-drive` and `slip-count-drive` pass **unmodified**. A
      drive that needs an edit is a behaviour change and a finding. · flow (Playwright)
- [ ] `npm test`, `typecheck`, `lint` (the core boundary; no colour literals) and `build` are green. No moved key
      renders raw: the drives read the same strings. · typecheck + drive

## Boundaries

A new `attachments` i18n namespace. No endpoint, no nav, no model change. RTL is not installed (spec 083), so the
component move is proven by the four drives alone.

## Done when

`SlipDrawer` renders the shared `core/attachments` panel with slip parameters, and the four slip drives pass without a
single edit.

## Blocked by

[325](325-the-slip-rules-reads-and-upload-store-live-in-core-attachments.md)
