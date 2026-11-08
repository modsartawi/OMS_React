---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3461-cancellation-reasons-are-one-maintained-list-and-a-delivery-is-cancelled-only-by-request-spec.md
blocked-by: —
---

# 854 — A delivery offers Request cancellation and no Cancel or Force cancel

## What to build

On a **delivery** document (opened as a delivery, or a delivery category, the same test Return Document
uses), the action bar's terminal tier is **empty**: `force-close` (`DFCL`) and `close` (`DCLS`) aren't drawn,
and their keys refuse like any undrawn command. The bar keeps no gap or orphan divider. Orders, eRx and other
categories keep both commands. Request cancellation is unchanged, including its "already requested" disabled
state.

This is a **documented exception** in `commands.ts`'s module header, next to Withdraw Request's retirement
(BackOffice 2022) and the grant rules. It's a ruling about deliveries, not a state gate, so the bar still
never shifts between two deliveries. The action codes stay defined in `actions.ts`. The server endpoints are
untouched.

## Spine reach

UI (command bar + keys)

## Proof (→ `tdd` red-green cycles)

- [x] `a delivery's terminal tier is empty` — and the cancel-request cluster still holds Request cancellation · commands.test.ts (vitest)
- [x] `an order and an eRx keep Force cancel and Cancel` · commands.test.ts
- [x] `the close and force-close keys refuse on a delivery` · the key-layer test
- [x] `a delivery opened under a non-delivery category (9000000003 shape) is still a delivery` · commands.test.ts

## Boundaries

Client only. It can ship on its own, before any BackOffice ticket.

## Done when

The Proof tests are green, the type check and the suite pass, and a delivery in the dev app shows no Cancel or
Force cancel.

## Blocked by

None — can start immediately.

## Comments

**As built (2026-11-08, branch `impl/3461-854`).** `commands.ts` gains `isDelivery(ctx)` — `openedAs === 'delivery'`
or a `D` category, the same two-signal test Return Document's first reason now calls — and `commandBar` returns an
empty `terminal` on a delivery. The ruling is documented in the module header beside Withdraw Request's retirement
(2022) and the grant rules, as a ruling on the document's kind, not a state gate. `actions.ts` and the server doors
are untouched. The key layer needed no code: no key binds close or force-close, and every key and list intent goes
through `commandOf`, which now finds nothing for either on a delivery. `CommandPanel` no longer renders the terminal
tier's wrapper when it is empty, so no `gap-x-4` is left at the end of the bar (there's no divider element).

Proof: 5 new cases in `commands.test.ts` (including a `D` delivery on the document route, and all four captured
deliveries drawing the same bar) and 2 in `detail-keys.test.ts`. Both files were red before the `commands.ts` change.
Six older cases that assumed a delivery's terminal pair were re-pointed: the grants suite and the terminal-pair pin
now use an order, and "same commands on every document" became per kind. typecheck clean; `npm test` 715 files /
9804 tests green. `npm run lint`: the four gates after boundaries are clean. The boundaries gate fails on four
`insurance-rules/aliases/door-shapes.test.ts` imports, and it already failed before this change.

**Not proven:** the dev-app check ("a delivery in the dev app shows no Cancel or Force cancel"). It wasn't driven.

**Review follow-up 2026-11-08.** The review flagged that a category-`T` record opened at `/oms/document` gets Cancel back.
The orchestrator ruled this is by design: it is the spec's test ("the same test Return Document uses"), and this ticket's proof pins it.
The `commands.ts` header now says so in one sentence. On the page, the category-only flag that shadowed `commands.isDelivery` is renamed to
`isDeliveryCategoryRecord`. `updateFor`'s endpoint routing was left unchanged.
