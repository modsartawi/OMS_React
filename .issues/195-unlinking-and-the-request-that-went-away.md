---
status: done
spec: 193
blocked-by: 194
---

# 195 — unlinkingIsAFullUndoAndTheRequestThatWentAwayIsNamed

## What to build

The two paths off a linked order: taking the link back, and being told the request is gone.

**Unlink empties the basket, so it asks first.** It is not a stamp being cleared — it removes the
copied lines and re-shuts the store gate. Split out from [194](194-the-callers-open-request-becomes-the-order.md)
because that is the sharp, independently testable rule and it carries the real risk: an agent who
reads *unlink* as *stop referencing this request* will lose a basket they meant to keep.

🚩 **Why it is a full undo rather than WPF's stamp-drop.** 194's link is refused unless the basket is
empty (`LINES_EXIST`), and WPF copies no items so its `CancelRequestLink` never had this problem. If
unlink left six copied lines behind, the basket would no longer be empty, the re-link would be
refused, and an agent who picked the wrong row out of two could never pick the right one. The
invariant *linkable ⇔ empty basket* has to survive an unlink, which is what makes the undo total
rather than tidy.

The confirm says what it costs, in the console's existing sheet: the lines go, the store choice
re-opens, **the caller stays attached**. That last line is there because the two acts sit next to each
other in the rail and an agent must not fear losing the caller they just attached.

**`removeCustomer` also clears the link** — server-side, in the same patch arm that already clears the
address ([880](C:\Work\DMSCO\BackOffice\.issues\880-cc-linked-sales-request.md) §6). The client's
whole job is to **not** contradict it: the linked card is read off `header.linkedRequest`, so it
disappears on its own, and no client-side memory of the request may survive the caller leaving. 🚩
This is the abuse answer — link caller A's request, change to caller B, submit, and the 055b spine
completes A's request against B's order — and it is why the owner's first proposal (lock the customer
for the life of the order) is **not** built. A locked customer would have reversed 871 §6's ruling
that a wrong-caller correction must not cost the basket.

**`REQUEST_ALREADY_CONVERTED` is a sentence, not a retry.** Another agent — or the pharmacist at the
till — can convert or cancel the request between the link and the submit; 055c's one-shot guard then
refuses the order. Without this the refusal arrives as the transient `SUBMIT_UNAVAILABLE` and an agent
retries forever on an order that will never post. It must name the request, and offer the one act that
resolves it: **unlink, then submit** — the order itself is perfectly good.

⚠ **The console must not pre-check.** Re-reading the request before submit would narrow the window and
invite a reader to believe it was closed. The refusal is the guard.

## Spine reach

logic (`linked-request.ts` — the unlink confirm's copy, the refusal's own family) · component (confirm
sheet wiring, the submit-refusal path) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `unlinkCost(state)` — the confirm's three facts, and the **line count comes off the state** never
      off a remembered copy (a link whose lines were partly skipped must not offer to remove six when
      four landed) · pure
- [x] `submitRefusal` — `REQUEST_ALREADY_CONVERTED` names the request number and resolves to the
      unlink escape; asserted **not** to reach the `SUBMIT_UNAVAILABLE` retry wording, and the
      transient code asserted still to reach it (the two must not swap) · pure
- [x] `tools/linked-request-drive.mjs` boxes — unlink from a linked TMRA order leaves the basket
      **empty**, the store gate **shut** (`canAddItem` false) and the caller **still attached**; a
      `removeCustomer` on a linked order leaves **no linked card and no stale request text anywhere on
      the screen**; and a stubbed `REQUEST_ALREADY_CONVERTED` submit draws the request's number with
      the unlink offered · flow (Playwright)

## Boundaries

**Server:** 880 §5 (`UnlinkRequest`), §6 (the `removeCustomer` arm) and §7 (`REQUEST_ALREADY_CONVERTED`).
⚠ §6 is a **server** change with a **client obligation to stay quiet** — the client's correctness here
is an absence, so the drive proves it by reading the whole screen for the request number rather than by
checking one element.
**Shares `CallCenterConsolePage` with 194** — sequence, don't parallelise.

## Done when

In the running app, unlinking a linked order asks first, then leaves an empty basket with the store
choice re-open and the caller attached; removing the caller takes the linked card with them; and a
request converted behind the agent's back is named on the submit refusal with unlink offered.

## Blocked by

194 — there is no link to take back until there is a link.

## Open questions

None.

## As built

**Proof:** 9 new pure cases in `linked-request.test.ts` (41 in the file, 792 suite-wide) +
`linked-request-drive.mjs` **92/92**. Typecheck, lint and build green.

🚩 **880 was BUILT under this ticket.** `.issues/assets/136-cc-contract/15-linked-sales-request.json`
(contract v1.11, captured live at 00:49 today) landed mid-session with the whole scenario on the
wire — list, link, a second link refused `LINES_EXIST`, and the unlink. Two things came out of
reading it rather than the prose:

- **The read was calling the wrong door.** 194 sent `CustomerRequests` with no parameters at all;
  the live route is `CustomerRequests?transactionId=…` — the session row is what holds the loyalty
  id the query is scoped by. Fixed here (194's shape was read off an unbuilt ticket), and the scope
  is still the SERVER's: no customer id crosses the wire.
- **The unlink's own bytes.** `linkedRequest: null`, `lines: []`, `plantSource: seededAtOpen`,
  `canAddItem` **false** with `STORE_NOT_CHOSEN` back among the blockers, `canLinkRequest` **true**
  again — and the caller untouched. The drive's stub is shaped on those rather than on §5's prose,
  which is also how the one **surprise** surfaced: the prefilled `sourceReference` **survives** both
  the unlink and the caller's removal. It is the ORDER's field from the moment §4.4 filled it, so
  the drive's whole-screen sweep exempts the chip row and says why — a console that scrubbed it
  would be editing the header behind the server's back.

**The cost is read off the basket, at the moment it is asked.** `unlinkCost(state)` takes the state
and nothing else — no report, no remembered copy — so a link that landed four of six lines offers to
remove four. It is re-derived on every render of the open sheet rather than frozen when it opened,
which also closes the sheet by itself if the link goes from under it (the caller removed in a second
tab). An empty basket says *there is nothing to lose* in its own words rather than through a plural
with a zero in it.

**The third fact is a field.** `keepsCustomer: true` rides the cost object rather than living as a
sentence the sheet is trusted to remember, for the same reason `SubmitFailure.orderOpen` does:
*unlink* and *remove the caller* sit next to each other in the rail, and an agent who fears losing
the caller will not press the one control that fixes a mis-picked request.

**`REQUEST_ALREADY_CONVERTED` did not need a new failure kind.** `readSubmitFailure` already answers
it `retryable: false`, so it never reaches the outage's *Try again* — asserted in the pure tests
from both directions, since the two swapping is the actual defect. What 195 adds is the naming and
the escape: `submitRefusal(code, state)` reads the request off the projection's own stamp and
answers a closed set of one escape, so the receipt cannot invent a second way out. 🚩 It is silent
when the order holds no link — then the server's sentence stands alone rather than being decorated
with a control that would be refused. And when it does speak, the server's own sentence is
**dropped**: §7's phrase names the same request the block does, and one thing said twice in two
voices is what 189 settled for `COUPON_REVERSAL_REFUSED`.

**No pre-check anywhere**, as the ticket rules: the requests read still fires once per caller
(`staleTime: 60_000`) and nothing re-reads the request before submit. The refusal is the guard.

**Where things ended up.** *Unlink* is on the rail's linked card and, identically, inside the submit
refusal — one act, one confirmation, one `requestId` minted when the sheet opens. The sheet is
`ConfirmSheet` with an `UnlinkConfirm` body (a third body, not a third mechanism); it carries no
`reissue`, because there is no token to go stale. `removeCustomer` gained no client behaviour beyond
closing what was open: the link disappears because the projection says so.

⚠ **Not done, and named rather than left silent:** the command palette (192) still lists neither
*view requests* (194) nor *unlink* — `VERB_ORDER` predates the whole request surface. Whoever
revisits 192's "one key reaches every order act" owns both, together.
