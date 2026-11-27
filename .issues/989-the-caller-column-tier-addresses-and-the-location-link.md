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

- [ ] `pointsAreNeverShown`: `barFields` has no points field for a member who has points · pure
- [ ] 574's location drive passes unchanged from its new place · flow

## Boundaries

No wire change. The panel keeps its key per transaction (a new order starts with no link).

## Done when

The column is live on the walk, a link is sent, received and applied there, and no points show.
