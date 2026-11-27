---
status: open
spec: 983
blocked-by: 984
---

# 989: The caller column: tier, addresses and the location link

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

The left column holds the following:
- the caller's name, member number and **tier**. **No points** anywhere: `BAR_ORDER` drops
  `points` (D2);
- the address book, as selectable cards;
- **`LocationLinkPanel` moved under it**, with its states and verbs unchanged (D10). An applied pin
  shows as the selected address.

With no caller attached, the column holds the existing attach/sign-up flow.

## Spine reach

component (`CallerColumn`; move `LocationLinkPanel` out of the centre) · pure (`caller-bar.ts`) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `pointsAreNeverShown`: `barFields` has no points field for a member who has points · pure
- [x] 574's location drive passes unchanged from its new place · flow

## Boundaries

No wire change. The panel keeps its key per transaction (a new order starts with no link).

## Done when

The column is live on the walk, a link is sent, received and applied there, and no points show.

## Comments

**2026-11-27: built on branch `t/989`. The live walk is still owed.**

Built:
- `caller-bar.ts`: `BAR_ORDER` drops `points` (D2), so `barFields` never returns one. `railFields` is unchanged; the bar just never seats points. `CallerBar` lost its points renderer.
- `CallerColumn.tsx` seats the start column in this order: the caller, then a `history` slot for 990 (last orders, usually buys), then the address book, then the location link.
- `CallerBar` in the narrow column:
  - Attached, the caller is a card: name and ✕ on the first line, then tier · mobile · member · email, then the requests chip.
  - In the lookup, the outcome (found / miss / hint) opens under the phone row.
  - A found member's name takes its own line, so it is not crushed to one letter.
- `AddressCards.tsx` shows the caller's book as selectable cards.
  - It shows only while a caller is attached, `canOpenAddressBook` holds and the order delivers (not collect, matching the sentence's address word).
  - One click applies through the page's ordinary rebind, so a basket with lines still gets the store-move confirmation.
  - The selected card is the order's address, and it shows *pin applied* when the order's address carries a pin (`bookCards`, read off `header.address.gpsLat/gpsLon`, never off the book row).
  - *Manage* opens the existing `AddressPicker` dialog for edit, delete and add.
  - A refusal shows on the cards only while the dialog is shut. A failed read offers Retry.
- `LocationLinkPanel` moved unchanged from under the header sentence to the caller column, under the cards. It keeps its key per transaction, its states and its verbs. Only its placement comment changed.
- i18n: `callerColumn.*` in en and ar. Control ratchet: the address card button is allowlisted (`callcenter/console` 21 → 22).

Proof:
- `caller-bar.test.ts` `pointsAreNeverShown`, plus `address-book.test.ts` `bookCards` (4 cases): red, then green.
- `callcenter-location-drive.mjs`: 367/367. Three changes:
  - The two placement assertions now say "in the caller column, under the address book".
  - The wire-order check counts the book's writes, not its GETs.
  - New checks: the applied pin shows on the selected card and nowhere else, and a card applies its address in one click.
- `callcenter-callerbar-drive.mjs`: 159/159, retargeted to the caller column:
  - the bar is the column's first child, and the column is 288px at 1280;
  - "same pixels" now means the bar's top, the centre's width and the sentence's top;
  - the fields are name, tier, mobile, member, email, and the text has no "points".
- `callcenter-drive.mjs`: the caller-bar assertion now targets the caller column, and the field order has no points.
  - Block 25 is rewritten: the attach now reads the book once, for the cards, and a failed read retries from the cards.
  - Run with `[data-cc-blockers]` swapped for `[data-cc-checklist]` in a throwaway copy, it gets past both of those. The real file still stops on `[data-cc-blockers]`, which 986 owns.
- typecheck, `npm test` and lint: clean.

Decisions for the owner:
- **The book is now read on every attach** (of a delivery order). 166 had ruled "attaching does not read the book". Showing the book as cards (D10, this ticket) needs the read. It is one GET per attached caller.
- The cards are hidden on a collect order, as the sentence's address word is.

Owed:
- The live walk (Done when): the column on the walk set-up, a link sent, received and applied there, and no points shown.

