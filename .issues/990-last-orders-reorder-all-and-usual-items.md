---
status: open
spec: 983
blocked-by: 989, 4455 (BackOffice)
---

# 990: Last orders with Reorder all, and usual items as one-click chips

Slice of [spec 983](983-the-console-is-built-around-the-caller-spec.md). Reference picture: the
*Call Center Console v3* artifact (v3).

## What to build

In the caller column, *Last orders* shows the last 5 orders from C2: number, date, total, the items
in short, and **Reorder all**. *Usually buys* shows up to 8 chips. Both load once per attached
customer (D11).

*Reorder all* adds each item through the normal `addItem` path, one at a time:
- it stops at the first `BUSY`;
- a refused line shows its own message and the rest continue;
- the toast says "4 of 5 added".

## Spine reach

contract doc (§ CustomerHistory, v1.13) · model · api (`customerHistory`) · pure (`reorder.ts`) · component · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `reorderAddsOneAtATimeAndReportsEachRefusal`: a stubbed refusal on item 2 of 3 still adds 1 and 3 and reports 2 · pure
- [x] `noHistoryWithoutACustomer`: the read is not made before attach · pure
- [x] Drive on a C2 stub · flow

## Boundaries

Blocked on [BackOffice 4455](C:\Work\DMSCO\BackOffice\.issues\4455-callcenter-customer-history-read.md) for live data. Build against a stub of exactly C2.

## Done when

On the walk, a known customer's last order is reordered and priced, and the chips add items.

## Comments

**2026-11-27: built on branch `t/990`, against a stub of C2. Live data waits on BackOffice 4455.**

Built:
- **Field names are BackOffice 4455's**, which pins them more exactly than the spec's prose: `orders[]` of `{ orderNumber, date, channel, status, payable, items[] { itemNumber, description, qty, uom } }` and `usual[]` of `{ itemNumber, description, timesBought }`. The ticket's "total" is 4455's `payable`. 4455 also pins the degraded read: `success: true` with **`null` lists**, never empty ones.
- Contract: § 3.8 `CustomerHistory` in `CONTRACT.md`, a row in the §1.1 verb table, a note in the header, and a second v1.13 row in §10.
- Model: `CustomerHistory`, `CustomerHistoryOrder`, `CustomerHistoryItem` and `CustomerUsualItem` in `core/models/callcenter.ts`. Api: `callCenterApi.customerHistory(transactionId)` and `customerHistoryKey(customerId)`.
- `reorder.ts` (pure):
  - `reorderAll` adds the lines one at a time. It stops at the first `SESSION_BUSY` that outlives `runGuarded`'s schedule, and also on a dead order (`SESSION_CLOSED` / `NOT_YOUR_SESSION`). Every other refusal is that line's: it carries the server's message, and the loop goes on. A below-availability ask counts as *not added*: a reorder never accepts a shortfall for the agent.
  - `historyRead` is the gate: only with a caller attached on an open order, keyed by that caller.
- `HistoryPanel.tsx` sits in 989's `history` slot:
  - Each card shows `number · date` (isolated once with `Ltr`), the payable (`Money`), the channel, the status, and the first 3 items with *and N more*.
  - *Reorder all* is on each card.
  - Under it is a report: each refused line with the server's message, and a busy stop with *Add the remaining N*, which re-sends only the lines it never tried.
  - *Usually buys* shows up to 8 chips. Each chip is one ordinary `addItem` of quantity 1, the search row's own path.
  - `null` is drawn as *could not load* with Retry, and `[]` as *no history*.
- The page reads once per attached customer (`staleTime: Infinity`, `enabled` only through `historyRead`).
  - *Reorder all* gives each line its own `requestId` and its own `runGuarded`, with no `again`. It applies each state as it lands.
  - The toast says `2 / 3 added`, via `formatCount` inside `fsi`. It is a success toast when every line landed and a warning otherwise.
- **For 992:** the page exposes `reorderLastOrder: (() => void) | null`, which is *Reorder all* on the newest order. It is `null` when there is no order, when `canAddItem` is false, or while a reorder runs. It is passed to `ConsoleShell` as the prop `reorderLastOrder`, which is typed and not yet read there. 992 seats it in `paletteCommands`.
- i18n: `history.*` in en and ar. No new hand-written control: chips and buttons are `core/ui` `Button`, so the ratchet is unchanged.

Proof:
- `reorder.test.ts`, 8 cases: `reorderAddsOneAtATimeAndReportsEachRefusal`, the busy stop, the closed stop, below-availability, `onLanded`, `noHistoryWithoutACustomer`, the per-customer key, and no read on a submitted order. They were red (no module) and then green.
- `tools/callcenter-history-drive.mjs` on port 5210: 47/47 in ltr and rtl at 1280, plus a degraded run.
  - No read and no panel before attach, and exactly one read across the call.
  - The panel sits between the caller and the book.
  - Three sequential AddItems, each with its own `requestId`, `qty` and `uom`. The refused line shows the server's message, and the toast says `2 / 3`.
  - A chip is one add of quantity 1.
  - A BUSY line is tried 6 times and nothing after it is sent.
  - A `null` read shows *could not load* and Retry re-reads.
- typecheck, `npm test` and lint: clean.

Decisions for the owner:
- **A below-availability ask during a reorder is reported as *not added*** and is not raised as the acceptance sheet. One sheet per line in the middle of a loop would stall it. The agent can accept from search.
- **`channel` values are not pinned by 4455.** The console words `CallCenter`, `Online` and `Store`, matching case-insensitively and ignoring spaces, `_` and `-`. Any other value is drawn as the server sent it.
- **A dead order also stops the loop**, alongside the BUSY stop the spec names.
- The toast reads `2 / 3 added` (`formatCount`, per the bidi rule), not "2 of 5".

Owed:
- The live walk (Done when), once BackOffice 4455 is deployed: a known customer's last order reordered and priced, and the chips adding items.
