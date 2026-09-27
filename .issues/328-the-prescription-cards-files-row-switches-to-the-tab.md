---
status: done
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

- [x] `fields.test.ts`, new cases:
      - the Files row is present only with the flag **and** N > 0;
      - the card shows on the Files row alone;
      - the Rx link row is unchanged, and a row carries `action` or `href`, never both;
      - the existing cases stay unchanged.

      · pure (vitest)
- [x] `order-attachments-drive` gains these checks:
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

## Comments

**Built 2026-09-27 (AFK).** Decisions are in `.afk/HITL-328.md`.

**Pre-flight.** BackOffice 2061, 2062 and 2063 are `status: done` on pricing2. BackOffice 2077 is `status: open`
(expected). The drive keeps stubbing `attachmentCategory` exactly as its `## Web contract` says, and the field has not
been renamed. 328 adds no endpoint, so there is no contract to cross-check.

**What was built.**
- **`fields.ts`.** `railCards(doc, t, files?)` takes a `RailFiles`: `{ count, allowed, onShow }`, all computed by the
  page. `filesRow` adds the Prescription card's Files row last. It needs `allowed` and `count > 0`, so `null` and `0`
  are both no row. The card's "any row" rule counts it, so an order whose only prescription fact is its files shows
  the card with only that row. `fields.ts` never reads the probe. Without `files`, every existing call is unchanged.
- **`CardRow.action`** is `{ label, ariaLabel, onSelect }`, beside `href`, and a row has one or the other. It is an
  object rather than a bare callback because the button's word and its `t()` aria-label must travel with it (HITL).
- **`SummaryRail`** renders an action as the value, an `aria-hidden` `·`, then a `<button>` in the card's ink.
  Every utility is direction-neutral.
- **The page** hands in `count`, `allowed` and `onShow`:
  - `count` is `attachments.badge`, the one `attachmentsBadgeCount`, so the row follows the stored list's length once
    the list loads;
  - `allowed` is `attachments.target !== null`, the tab's gate;
  - `onShow` calls the same `selectTab('attachments')` the tab's own click does, then moves focus to the tab.
- **Words** (`document`): `cards.files` "Files", `cards.show` "Show", `cards.showFiles` "Show the order's files in the
  Attachments tab" (the aria-label). All three wait on the owner's read.

**A fix to 327, from `/code-review`.** Two numbers on one route (for example `/oms/document/A` then `/oms/document/B`)
can name the same `attachmentOwnerNo`. The page's own ByOwner observer holds that key while the next document loads,
so `gcTime: 0` never dropped the list. B's first selection then showed A's cached list with **no audited read**.
- `open()` now calls `forgetAttachments` (`core/attachments/api.ts`, beside `rereadAttachments`: a `resetQueries`
  on exactly that key) as the latch sets.
- Every observer of the key is still disabled at that moment, so nothing extra is fetched. The drive still counts
  exactly one read everywhere.
- `/oms/document` ↔ `/oms/delivery` is not affected: they are separate route components, and the page remounts.
- The new drive check failed before the fix (0 reads) and passes after it (1).

**Proof.**
- `npm test`: 153 files, **2650** tests green. The 5 new ones are `filesRow` cases in `fields.test.ts`:
  - the flag and N > 0 (and `null`, `0`, no flag and no `files` all give no row);
  - the aria-label comes from the namespace;
  - the card shows on the Files row alone (`8000000121`) and is absent without it;
  - the Rx link row is unchanged, and no row carries both `href` and `action`;
  - no other card changes.

  The existing cases are untouched.
- `typecheck`, `lint` (boundaries 672 files, contrast 129 pairs, palette 677 files) and `build` are clean.
- `order-attachments-drive` **237/237** (was 210):
  - Files 3 · Show last on the card, with the Rx link row still a link;
  - Show is a named button;
  - zero ByOwner on load;
  - Show selects the tab, focuses it, and reads ByOwner once with no `/Content`;
  - N follows the stored list (6), as the badge does;
  - a second Show, and the tab after it, read none;
  - the tab first, then Show, reads one;
  - there is no Files row for no owner, no category, `NOT_SET_UP`, a bare-string probe, a category not held, N = 0
    or no count;
  - the card shows on files alone and opens the tab with one read, and has no card without the gate or with N = 0;
  - the same-owner, same-route check above.
- The four slip drives pass **unedited**: `slip-count` 64/64, `slip-drawer` 63/63, `slip-add` 52/52,
  `slip-withdraw` 68/68.
- The document drives: `detail` 39/39, `cards` 45/45, `rail` 25/25, `rtl` 53/53, `band` 34/34, `items` 23/23.
  `document-actions` fails the same 3 checks as before this wave (7358a84; see HITL-327). Not 328's.

**Outstanding (not AFK's).** The owner's read of the three new strings, and the owner's walk against a live SIS.Api
(2071's Proof). Both need BackOffice 2077 actually served.
