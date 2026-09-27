---
status: done
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

- [x] `slip-drawer-drive`, `slip-add-drive`, `slip-withdraw-drive` and `slip-count-drive` pass **unmodified**. A
      drive that needs an edit is a behaviour change and a finding. · flow (Playwright)
- [x] `npm test`, `typecheck`, `lint` (the core boundary; no colour literals) and `build` are green. No moved key
      renders raw: the drives read the same strings. · typecheck + drive

## Boundaries

A new `attachments` i18n namespace. No endpoint, no nav, no model change. RTL is not installed (spec 083), so the
component move is proven by the four drives alone.

## Done when

`SlipDrawer` renders the shared `core/attachments` panel with slip parameters, and the four slip drives pass without a
single edit.

## Blocked by

[325](325-the-slip-rules-reads-and-upload-store-live-in-core-attachments.md)

## Comments

**Done 2026-09-27 (AFK).** No behaviour change. The decisions are logged in `.afk/HITL-326.md`.

**What moved to `src/core/attachments/`.**
- `AttachmentsPanel.tsx` (new; the body of `SlipDrawer.tsx`): the stored list with its source text, Withdrawn (n), the
  preview (object URLs revoked on selection change and on leave; no file ever auto-selected), the list error, the
  withdraw notice, and a private `PanelShimmer` (core may not import the feature's `ListShimmer`).
- `AttachmentAdd.tsx` (`git mv` of `SlipAdd.tsx`), `AttachmentWithdrawDialog.tsx` (`git mv` of `SlipWithdrawDialog.tsx`)
  and `AttachmentSourceText.tsx` (`git mv` of `SlipTillText.tsx`). No slip copy is left behind.
- `panel-words.ts`: `AttachmentsPanelWords`, the caller's words.
- `withdraw.ts` gains `WithdrawReason` = `{ code, label, labelArabic?, noteRequired }`. The dialog draws `label` and,
  only when present, `labelArabic` in its own span (331's), so the slip's DOM is unchanged.

**The panel's parameters:**
- `target`: owner kind and key, category, kind (`slipTarget`).
- `freshness`: `READ_ON_EVERY_OPENING` for the slip, so every opening reads again.
- `reasons`: `slipWithdrawReasons(t)`, which resolves the five bundle keys, with Other as `noteRequired`.
- `words`: 20 caller sentences, see below.
- `addOffered` / `withdrawOffered`: the caller's gates, `canSeeSlips` / `canWithdrawSlips` over the one shared probe.
  The bare-403 take-away stays inside the panel.
- `onChanged`: `markSlipDayChanged`. It re-reads the day's ByOwner and marks both grids stale. It is the same three
  invalidations as before, so the panel never re-reads ByOwner a second time. The panel re-reads by itself only after a
  `/Content` 404, as the drawer did.

Add stays multi-file with no caption. The caption mode is 330's and is not built.

**Stays in `collection/inquiry`:** `DrawerFrame` (the native `<dialog>`, its title, and the in-flight close guard with
`clearSettled`), `markSlipDayChanged`, the slip count, column and chip, `WITHDRAW_REASONS` and its keys, and a thin
`SlipDayBody` that hands the panel its slip parameters.

**i18n.**
- The new `attachments` namespace (`src/locales/en/attachments.json`) is registered in `core/i18n.ts`.
- 30 keys moved there, the ones whose value names no owner. A script compared every value of the old `collection.json`:
  454 are unchanged in place and 30 moved with byte-identical values. None changed or was lost.
- Every sentence that says "slip", "day" or "drawer" stays in `collection` and is passed in. So do "Till" and the
  Other-note hint.
- ⚠ 331 expects the dialog chrome from `attachments`, but today it is caller words. That needs the owner's ruling (see
  HITL).

**Where the tests went.**
- `slip-withdraw.test.ts` gains `slipWithdrawReasons`: five codes in order, labels from the bundle, Other alone
  `noteRequired`, and the confirm rule over it.
- The new `core/attachments/words.test.ts`:
  - the namespace is registered and resolves;
  - every literal `t()` key in the panel's `.tsx` exists in `attachments.json`;
  - every upload status has a label.
- No existing assertion changed.

**Proof.**
- `npm test`: **152 files / 2590 tests** green (325 left it at 151 / 2584).
- `typecheck` is clean and `build` is green.
- `lint` is clean on all three gates. Boundaries checked 668 files, and nothing under `core/attachments` imports a
  feature.
- The four slip drives pass against vite on :5199 with stubbed doors: `slip-count-drive` **64/64**, `slip-drawer-drive`
  **63/63**, `slip-add-drive` **52/52**, `slip-withdraw-drive` **68/68**. `git diff 6a09afe -- tools/` is empty, so
  none of the four was edited. They were re-run after the review fixes.
- `/code-review`: no findings.
- `/standards-review`: no hard violations and no blocking spec findings.
  - Applied: `pick` renamed to `noSelection`, the `onChanged` docblock narrowed, and the frozen `slip-*` / `data-slip` /
    `data-cell="till"` hooks listed.
  - Recorded in HITL for later tickets: 327's first-selection latch (the panel has no `enabled` yet), 331's reasons read
    from the panel's own ByOwner, and the dialog chrome.
- **Outstanding (not this ticket's to fake):** the owner's read of the moved and caller-passed strings, and the wave's
  live hand walk (2071).
