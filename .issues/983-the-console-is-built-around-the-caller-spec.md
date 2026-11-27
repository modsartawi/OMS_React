---
type: spec
status: ready
---

# 983: The console is built around the caller (call-center console v3)

Settled in the 2026-11-27 production walk of the web call center (BackOffice session, local SIS.Api on
the production DB, owner placing real orders). Several design rounds led here: grid "A with numbers" →
header card v2 → caller-first v3, plus research into how phone-order and contact-center order entry
tools are built. The owner approved v3 with "woow now we are talking", then asked for three changes:
- **No points.** The tier stays.
- **A promotions panel at the bottom,** so the agent can recommend.
- **The location link inside it.**

The reference mock-up is the private artifact *Call Center Console v3*
(https://claude.ai/artifact/AEXoDC2MCjaCWKZc3KPnh9, v3). It is a picture of the target, **not** a
source of figures. Its totals are computed in the page, and the real console still takes every figure
from the server.

The wire is the call-center session contract (`assets/136-cc-contract/CONTRACT.md`, live at v1.11,
with v1.12 proposed). This spec proposes **v1.13, additive**: decisions C1–C3, served by two new
BackOffice tickets.

## Problem Statement

An agent on the phone works a screen made of the following:
- three header bands;
- a sentence-shaped header that reads codes rather than names;
- an unnumbered basket whose pricing note says "Vat % 20.32" when 20.32 is an amount;
- a summary with only net, VAT and gross;
- promotion guidance in a single strip.

The agent cannot see:
- who the caller is beyond a name, or what they bought last time;
- what the order still needs before it can be placed;
- what to tell the caller about the offers that fired or nearly fired.

The engine knows all of it (fired promotions and near-misses, with progress and what to add), and
the screen does not say it. The owner's verdict on the current shape: "a bit ugly and not compatible
with our theme", "still not that great, the header behaviour too need work and the lines maybe need
numbering".

## Solution

One screen in three columns, with the caller first. Every column reads the existing `SessionState`
unless a decision below names a new read.

- **Caller column (left):**
  - name, member number, tier and flags;
  - **last orders** with *Reorder all*;
  - **usually buys** as one-click chips;
  - the address book;
  - the **location link** (spec 574, already built), moved here from its own panel.
- **Order column (centre):**
  - a **step rail**: Caller · Items · Fulfilment · Payment · Review. Each step shows its own answer
    and turns amber while incomplete, and any step can be clicked at any time;
  - the item search;
  - the **numbered basket** with an expandable pricing detail per line;
  - the **promotions panel** underneath, in three columns: Applied · One step away · Could still
    use;
  - fulfilment, slot and payment.
- **Summary column (right):**
  - the receipt: Original · Discount · Subtotal · VAT · Delivery fee · Total, plus "Caller saves …";
  - the **Before you place it** checklist;
  - the **read-back sentence**;
  - **Place order**.
- **Ctrl K** gains rows for the new acts. *Place order* stays a terminal palette row with **no
  chord** (153, 192, 365 §7 unchanged).

## User Stories

1. As an agent, when a known caller's order opens, I see their tier, last orders and usual items
   before I ask anything, so I can say "the same as last time?".
2. As an agent, *Reorder all* on a past order adds each of its items through the normal add path, and
   anything not sold or not in stock is refused line by line in the server's own words.
3. As an agent, a usual-item chip adds one unit in one click.
4. As an agent, I can text the caller a location link from the caller column, watch it count down,
   then use the pin for this order or save it as an address (574's flow, moved).
5. As an agent, the step rail tells me at a glance what is done and what is missing, and clicking a
   step takes me to it.
6. As an agent, each basket line has a number I can read to the caller ("line 2"), and clicking a
   line shows how it was priced: basic price, each discount by name, net, VAT rate **and** amount,
   and total.
7. As an agent, the summary shows the original amount, the total discount, the subtotal, VAT, the
   delivery fee (or "free" with the waived fee struck out) and the total. Every figure comes from
   the server.
8. As an agent, the promotions panel shows each **applied** promotion with what it is, the lines it
   landed on (by number), the amount, and the lines a coupon skipped and why (for example medicine),
   so I can explain it.
9. As an agent, the panel shows each promotion **one step away**: a progress bar, the items that
   would complete it (one-click add, stock-checked at the order's store) and a sentence I can say to
   recommend it.
10. As an agent, the panel shows what the caller **could still use**: coupons they hold that are not
    applied, with an *Apply* button.
11. As an agent, the read-back sentence states the items, the saving, the total, where, when and how
    they pay, so I can confirm the order aloud before placing it.
12. As an agent, *Place order* is disabled until the checklist is clear, and the checklist names
    what is missing.
13. As an agent, the source I am set up with is applied to every new order by itself, and I am asked
    only for a reference when the source needs one.
14. As an agent, changing the order's store never leaves the console stuck.

## Implementation Decisions

- **D1: Three columns, and the caller is the left column.** It replaces the three header bands. Below
  1280 px the columns stack (caller, order, summary) with no sideways scroll. Theme tokens come from
  `app/global.css` (IBM Plex, navy, gold focus ring).
- **D2: The tier, never points.** Owner ruling 2026-11-27. The caller column and the caller bar drop
  the points field (`caller-bar.ts` `BAR_ORDER` loses `points`).
- **D3: The step rail is derived, never stored.** Each step's state is a pure function of
  `SessionState` and the server's submit blockers (`submit-blockers.ts`), so the rail and the
  checklist cannot disagree with *Place order*'s own refusal. Clicking a step focuses that step's
  section. Nothing is linear and nothing is skipped.
- **D4: Lines are numbered by position in the basket** (1-based, recomputed after a void). The
  numbers are display only and never sent to the server. The promotions panel names lines by the
  same numbers through `FiredPromotion.lineIds`.
- **D5: The pricing detail labels VAT as rate plus amount.** It fixes "Vat % 20.32".
- **D6: The receipt adds Original and Discount from the server** (C1). The client never subtracts to
  find them.
- **D7: The promotions panel replaces the guidance strip's cards and keeps its verbs.**
  - *Applied* reads `FiredPromotion` (description, amount, lineIds).
  - *One step away* reads `NearMiss` (progress `have/need`, the prerequisite and the reward arms of
    412) and adds through the existing `ResolvePrereq` / `ResolveReward` one-click paths.
  - *Could still use* reads what `CouponPicker` already reads for the caller, and the column hides
    when it has nothing.
  - Every phrase the agent says is a `callcenter:` i18n key filled from server facts. No figure is
    computed in the client.
- **D8: The read-back sentence is a pure function of `SessionState`** (`read-back.ts`). It lists
  lines (quantity × short name), the discount, the payable total, the fulfilment with address label or
  store, the slot and the payment. It is written in the console's language, and an Arabic sentence is
  its own key, not a translation of word order.
- **D9: Place order stays a terminal row** (153, 192, 365 §7). It has no chord. In the summary it is
  a button disabled while blockers remain.
- **D10: The location link moves, unchanged.** `LocationLinkPanel` renders in the caller column under
  the address book. Its states and verbs are 574's. An applied pin appears as the selected address.
- **D11: Last orders and usual items come from one new read** (C2), loaded once per attached
  customer. *Reorder all* is N `addItem`s through the normal path, one at a time, and stops at the
  first `BUSY`. A refused line shows its own message and the rest continue.
- **D12: Nearby stock in search is on demand.** The highlighted search row asks `StockElsewhere` after
  a debounce and shows "0 here · Malqa 2" under the price. It never fans out over every row (the read
  is a remote hop, see `stock-view.ts`).
- **D13: Ctrl K rows added:**
  - Reorder last order
  - Send location link
  - Switch to collect / deliver
  - Next free slot
  - Apply a held coupon

  They go into `palette-model.ts`, each enabled exactly when its handler exists.
- **D14: The default source applies at open.** If the order has no source and the agent's
  `myDocumentSources` holds an `isDefault` one, the console calls `setDocumentSource` once. On
  `SOURCE_REFERENCE_REQUIRED` it opens the Source section with the source pre-filled. With no
  default it does nothing (the owner's own login has none).

### Contract v1.13 (additive): BackOffice asks

- **C1: `SessionTotals` gains `beforeDiscount` and `discount`.** Both are money, taken from the
  engine's header figures for the same run that produced `net`. They satisfy
  `beforeDiscount − discount = net`, and the delivery fee is excluded. → BackOffice
  [4454](C:\Work\DMSCO\BackOffice\.issues\4454-callcenter-session-totals-carry-before-discount-and-discount.md).
- **C2: `GET CallCenterWeb/CustomerHistory?transactionId=`** returns, for the session's **attached
  customer only** (the door's scoping rule from 137), the following:
  - `orders[]` (last 5): order number, date, channel, status, payable, and `items[]` (item number,
    description, qty, uom);
  - `usual[]` (top 8 by frequency over 12 months): item number, description, times bought.

  With no customer attached it refuses `NO_CUSTOMER_ATTACHED`. It adds no other new code. →
  BackOffice
  [4455](C:\Work\DMSCO\BackOffice\.issues\4455-callcenter-customer-history-read.md).
- **C3: No other wire change.** Promotions, near-misses, stock elsewhere, the location link and the
  submit blockers are all live today.

## Testing Decisions

- Every rule above that decides something is a pure module with a vitest beside it:
  - `step-rail.ts`
  - `line-numbers` inside `basket-view.ts`
  - `receipt-view.ts`
  - `promotions-panel.ts`
  - `read-back.ts`
  - `reorder.ts`
  - `default-source.ts`
  - the palette rows in `palette-model.ts`
- One Playwright drive per slice, on stubs of exactly the v1.13 shape. The guidance drive is retargeted
  to the panel.
- Live verification on the walk set-up (local SIS.Api on production, jobs stripped). It is owed per
  slice and noted on the ticket.

## Out of Scope

- **Allergy flags and a note on file in the caller column.** The mock-up shows them, but no source is
  known. They need their own question first.
- Caller ID and telephony integration: the number arrives by typing or pasting, as today.
- Loyalty points anywhere in the console (D2).
- A place-order keyboard chord (D9).
- Prefetching stock for every search row (D12).
- The WPF call center.

## Further Notes

- The engine fix found on the same walk (NOV10 landing on excluded medicine after an OPEN resume) is
  SIS.Pos **26.4.164** on the engine branch `fix/resume-reenrich-codes`. It has to be committed, packed
  from the committed HEAD and released before go-live. It is not part of this spec.
- Go-live is unchanged: pilot agents, CLCN cash.

## Comments

**2026-11-27 — built (implement-spec run).** Tickets 984–994 are built and **merged to main** (fast-forward to d41340c2; the integration branch and its worktree are removed). All on stubs; every ticket stays `open` until its live walk. The first commit carries the 2026-11-27 walk fixes to `HeaderSentence.tsx` / `ItemSearchPanel.tsx` that sat uncommitted on main. `/code-review` found 4 important + 6 nits, all fixed in 2bc37582. typecheck, 12914 tests, lint, and the callcenter drives are green.

Open asks (unfiled):
- US10 *Could still use* / Ctrl K *Apply a held coupon*: no read of coupons the caller holds but has not applied — needs a BackOffice read; the column is not drawn and the palette row is disabled.
- "Not on line N" matches a coupon to a fired promotion by exact description — a `couponCode` + per-line skip reason on `FiredPromotion` would make it exact (and give the "medicine" reason).
- VAT rate per line is derived (description %, 0 when amount 0, else VAT/net rounded) — a `rate` on the condition would remove that client arithmetic (985).
- Owner rulings listed in each ticket's Comments (address book read on attach 989, switch skips the two-choice picker 992, reorder below-ATP reported not added 990, read-back wording 988, Caller saves excludes VAT 986).
