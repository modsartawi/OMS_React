---
type: spec
status: ready
---

# 289 — The screen that creates a bonded return

**This is the FRONTEND spec** — the Document Details dialog that fills in the `return-document`
placeholder, in this repo (`oms-react`, `C:\Playground\oms-react`). Its backend half is
**BackOffice spec 1283**, in the sibling BackOffice repo at `C:\Work\DMSCO\BackOffice`:

> [file:///C:/Work/DMSCO/BackOffice/.issues/1283-web-bonded-return-door-spec.md](file:///C:/Work/DMSCO/BackOffice/.issues/1283-web-bonded-return-door-spec.md)

**1283 is the normative owner of every server shape on this effort** (map 1266, ticket 1271 §1).
Everything under [The wire, transcribed](#the-wire-transcribed) below is a **transcription** of its
§2 and §2b. Nothing in this repo claims authority over a payload shape.

> ⚠ **Drift rule, carried by both specs.** A `400` on the joining ticket's first live call is a
> **drift report against BackOffice spec 1283 §2/§2b**, not a frontend bug. *The spec is corrected
> first, then the transcription — never the transcription alone.*

## Problem Statement

An operator on Document Details, looking at a bonded delivery a customer wants to send back, presses
**Return Document** and is told the module is not available. The button has been on the action bar
since ticket 094; pressing it toasts `returnDocument.unavailable` and nothing else happens. The only
way to create a bonded return is the WPF BackOffice screen, so the web operator either switches
applications or does not do the job.

Underneath the missing screen sit three problems that filling the placeholder in naively would ship:

- **The command's own gate is wrong.** `commands.ts` enables Return on
  `deliveryDocumentType === 'BB'` — *bonded*, which includes BZ01/SMSA, where carrier returns are
  manual and out of scope. A return created against a non-Starlinks store is persisted, books no
  pickup, and never refunds, and the operator is told it worked. A silent dead document is the worst
  possible outcome of a Return button, and the loose gate is what produces it.
- **There is nothing on the screen that knows what has already come back.** A delivery whose lines
  were partly returned last week looks identical to an untouched one. Without a per-line remaining
  quantity the operator discovers the overlap as a `400` naming a line number, after submitting.
- **The WPF, copied faithfully, carries its defects across.** It requires a box count and a total
  weight and then sends neither; it lets the client state line money and condition money on the
  wire; it silently does nothing when the document is ineligible; and it confirms twice and reports
  with a message box.

## Solution

One **dialog** on Document Details — not a route — that opens on the delivery in front of you and
creates the return against it. It shows the delivery's lines with **how much of each is still
returnable**, hides the lines with nothing left, lets the operator tick lines and set a quantity
that cannot go below 1 or above what remains, lets them tick which **delivery fees** carry back,
asks **what happens to the goods** with no option pre-selected, and — only when the goods are
actually being collected — offers the **pickup address** as a collapsed summary that expands into
the full field set the courier reads. It POSTs `SdDocumentWeb/CreateReturn` with a client-minted
`requestId`, and **no amount of any kind**.

The command itself stops guessing. `commands.ts` reads the server's **`canReturn`** flag instead of
spelling the store rule, and renders **disabled with a reason** in three distinguishable cases — you
are on an order, this is not a Starlinks bonded delivery, everything here has already been returned.
`BZ02` is not written anywhere in this repo.

The arrangement is not being designed here. It was built as an HTML build target, driven in a
browser, and approved before either spec was written:
[file:///C:/Work/DMSCO/BackOffice/.issues/assets/1270-return-screen-build-target.html](file:///C:/Work/DMSCO/BackOffice/.issues/assets/1270-return-screen-build-target.html).
This spec is written *against* that artifact; where the two disagree, the artifact is the picture and
this document is the ruling.

## User Stories

1. As an OMS operator, I want **Return Document** on a bonded delivery to open a return screen, so
   that I do not switch to the WPF BackOffice to do my job.
2. As an OMS operator, I want the command to stay **visible but disabled with a reason** on a
   delivery I cannot return, so that I learn why instead of pressing a button that does nothing.
3. As an OMS operator on an **order**, I want the reason to tell me to open the delivery, so that I
   do not submit a return that dies on a reference lookup.
4. As an OMS operator on a non-Starlinks bonded delivery, I want the reason to say so, so that I
   know to look elsewhere rather than retry.
5. As an OMS operator on a spent delivery, I want the reason to say **everything has already been
   returned**, so that I stop rather than opening an empty screen.
6. As an OMS operator, I want each of those reasons to **name the way out** rather than restate the
   rule, so that the tooltip is worth reading twice.
7. As a frontend engineer, I want the eligibility answer to come from the server as one flag, so
   that this repo never spells a store code and cannot drift from a policy that moves.
8. As an OMS operator, I want the return to open **over** the delivery I am reading, so that the
   identity band, status rail and summary rail stay behind it as the context I check the decision
   against.
9. As an OMS operator, I want the dialog body to scroll and the submit bar to stay pinned, so that
   the decision and its button are never separated by the fold.
10. As an OMS operator, I want to choose which lines come back, so that a customer returning one item
    of a five-line delivery is an ordinary transaction.
11. As an OMS operator, I want a **select-all** on lines, so that returning a whole delivery is one
    click.
12. As an OMS operator, I want **no select-all on fees**, so that the deliberate guard on refunding a
    delivery fee is not defeated by a control beside it.
13. As an OMS operator, I want to return **part** of a line's quantity, so that a customer returning
    1 of 3 of the same SKU is expressible.
14. As an OMS operator, I want the quantity to pre-fill with everything still returnable when I tick
    a line, so that the ordinary case costs me nothing.
15. As an OMS operator, I want the quantity stepper **inert until its line is ticked**, so that the
    screen never invites me to set a number that will not be sent.
16. As an OMS operator, I want the stepper's `−` to disable at 1 and `+` to disable at the cap, so
    that **zero is unreachable by pressing**, not merely rejected after.
17. As an OMS operator who types into the quantity box, I want the typed value clamped to the same
    range, so that the keyboard is not a way around the stepper.
18. As the business, I want the server to refuse a zero or negative quantity as well, so that the
    guard holds at both ends and not only in a browser I do not control.
19. As an OMS operator, I want each row to say **how much is left** — *of 2 left* — so that I
    discover a partly-returned line before I submit rather than from a `400` afterwards.
20. As an OMS operator, I want a row that was never touched to say *of 3 delivered*, so that the two
    cases read as different facts rather than the same phrasing.
21. As an OMS operator, I want lines with nothing left **hidden**, so that the grid shows only what I
    can act on.
22. As an OMS operator, I want the grid header to say **how many lines were hidden**, so that a
    missing line is never something I have to wonder about.
23. As an OMS operator, I want the delivery fees listed with their real money, so that I can see what
    refunding a fee would actually cost.
24. As the business, I want the fee ticks **empty on open**, so that refunding a fee for a service
    that was performed is always a deliberate concession.
25. As the business, I want the client to name only **which** fee carries back and never **how
    much**, so that a browser cannot choose the size of a refund.
26. As a finance reviewer, I want the fee's money read as its rate on the header row, so that the
    screen does not display a structural zero as the cost of a refund.
27. As an OMS operator, I want line unit price and a per-line value shown, so that I have the money
    as context while I decide.
28. As a finance reviewer, I want the screen to **claim no grand total**, so that no operator quotes
    a customer a number this client invented while the server recomputes VAT and discount pro-rata.
29. As an OMS operator, I want the two reasons spelled out by **consequence** — *the courier collects,
    the refund is issued once the goods arrive* against *refunded now, the customer keeps the goods*
    — so that I choose with my eyes open.
30. As the business, I want **neither reason pre-selected**, so that an immediate, irreversible refund
    is never reached by clicking through a default.
31. As an OMS operator choosing Refund Only, I want the pickup address section to be **absent** — not
    greyed, not disabled — so that the screen does not imply a courier is coming when none is.
32. As an OMS operator choosing Return and Refund, I want the address shown as a **one-line summary
    with a Change affordance**, so that the ordinary correct address costs me no attention.
33. As an OMS operator, I want to expand and **correct the pickup address**, so that a parcel whose
    wrong address is the reason it is coming back can still be collected.
34. As a customer who has moved since delivery, I want the pickup to happen where I am, so that the
    collection does not fail.
35. As an OMS operator, I want a **district picker** rather than a free-text district, so that I
    cannot type a district the courier cannot route to.
36. As an OMS operator, I want the expanded address to carry building number, postal code, short
    address and the second street line, so that everything the carrier reads can be corrected here.
37. As an OMS operator, I want a sentence under the expanded form saying this is where the courier
    collects, so that I understand what I am editing.
38. As an OMS operator, I want an optional free-text note, so that the warehouse sees why the goods
    are coming back.
39. As an OMS operator, I want the note to be **optional**, so that the screen does not manufacture
    the word "return" typed into a box.
40. As an OMS operator, I want the submit bar to tell me **one** missing thing at a time, in the
    order I must act, so that I am given the next step rather than a list of complaints.
41. As an OMS operator, I want the submit bar to flip to a plain summary — *3 lines · 1 fee* — once
    nothing is missing, so that the same strip reports readiness as well as blocking it.
42. As an OMS operator, I want **one** confirmation and for it to be the submit button, so that a
    screen I already filled in is not confirmed twice.
43. As an OMS operator, I want success to arrive as a toast carrying the **new return number** and
    what happens next, so that I can quote it without going to find it.
44. As an OMS operator, I want the dialog to close and the delivery beneath it to reload, so that the
    screen I return to reflects what I just did.
45. As an OMS operator who double-clicks Submit, I want **one** return created, so that the customer
    is not refunded twice.
46. As an OMS operator whose browser lost the response, I want a retry to show me the **same** return
    number, so that I neither create a second one nor go looking for one that already exists.
47. As an OMS operator, I want that duplicate to render as **plain success with one extra clause**,
    so that I am not shown an error about a return that was in fact created.
48. As an OMS operator refused by the server, I want a **banner that stays** as well as the toast, so
    that I can still read what went wrong after the toast has gone.
49. As an OMS operator, I want the banner to carry the machine code beside the human sentence, so
    that I can quote it when I ask someone.
50. As an OMS operator refused by the server, I want my selections **left intact**, so that a refusal
    I can act on does not cost me the whole form.
51. As an OMS operator, I want submit disabled and the dialog held open while the request is in
    flight, so that I cannot fire it twice by impatience.
52. As an operator on a right-to-left locale, I want the dialog to mirror, so that the screen reads
    correctly when Arabic lands.
53. As a reader of this repo, I want the request and response types under **one provenance line**
    pointing at BackOffice spec 1283, so that there is exactly one owner of the shape.
54. As a reader of this repo, I want no `BZ02` literal anywhere in React, so that a policy change on
    the server does not need a frontend release to stay correct.
55. As an implementer, I want the screen's decisions in a **pure module**, so that they red-green in
    vitest with no network, no clock and no React.
56. As an implementer, I want four checked-in fixtures covering the returnable, exhausted, refused
    and replayed cases, so that every path is drivable before a live SIS.Api exists.
57. As the next person to read this, I want the recorded gaps — the dropped box count and weight, and
    the two address fields the server-side copy still leaks — written down, so that they read as
    known rather than as later discoveries.

## The wire, transcribed

> **From BackOffice spec 1283 sections 2 and 2b.**
>
> Everything in this section is a transcription. It is not the owner of these shapes and does not
> get to change them; a mismatch found live is corrected in 1283 first. Field names, optionality and
> the `reason` union are all 1283's.

```ts
// ---- §2 — the create door's wire contract ------------------------------------
// POST SdDocumentWeb/CreateReturn

/** One line coming back. No price, no discount, no VAT — by construction. */
export interface CreateReturnLine {
  lineNumber: number
  itemNumber: string
  quantity: number
}

/** The pickup address. Omitted under `RF`; the server ignores it there. */
export interface CreateReturnAddress {
  street1: string
  street2: string
  cityCode: string
  cityName: string
  districtCode: string
  districtName: string
  postalCode: string
  buildingNumber: string
  shortAddress: string
  gpsLat: number
  gpsLon: number
}

/** The two return reasons. `ReturnReasonPolicy`'s set, and nothing else. */
export type ReturnReason = 'RTRF' | 'RF'

export interface CreateReturnRequest {
  /** Client-minted idempotency key — REQUIRED. Stamped into `SourceReference`. */
  requestId: string
  /** A DELIVERY number. Never an order number. */
  refDeliveryNo: string
  reason: ReturnReason
  lines: CreateReturnLine[]
  /** WHICH delivery fees carry back — never how much. */
  conditionTypes: string[]
  /** Omitted under `RF`. */
  shippingAddress?: CreateReturnAddress
  note?: string
}

/** The slim create response. Deliberately not the header model. */
export interface CreatedReturnModel {
  documentNo: string
  orderNo: string
  documentReason: string
  storeCode: string
  /** `true` when this `requestId` had already created a return: the SAME one. */
  replayed: boolean
}

// ---- §2b — the delivery read model addition ---------------------------------
// Additive fields on the model both `SdDocumentWeb/Document/{no}` and
// `SdDocumentWeb/Delivery/{no}` already return.

/** Added to `SdDocumentHeaderModel`. Delivery && Starlinks-bonded && anything left. */
// canReturn: boolean

/** Added to `SdDocumentLineModel`. See the ⚠ below on its spelling. */
// returnedQuantity: number
```

⚠ **One thing 1283 §2b does not fix, and the joining ticket resolves first.** §2b says the line gains
"a returned-so-far **(or remaining)** quantity" and gives the arithmetic for both, but never names
the field. This transcription takes **`returnedQuantity`** and derives `remaining` on the client as
`quantity − returnedQuantity`, per §2b's own formula. That choice is a guess about a shape this repo
does not own. Confirming it — the exact name, and whether the server sends returned or remaining —
is the **first** thing the joining ticket does against a live door, and any correction lands in
BackOffice spec 1283 §2b before it lands here.

**Refusals** arrive as the envelope this repo already renders: a `400` carrying `success:false` and
`errors[0].errorCode` — a **guardrail refusal** in `CONTEXT.md`'s vocabulary, read through
`apiErrorMessage` / `apiErrorCode` (`.claude/rules/api-envelope.md`). The two codes 1283 §8 mints are
build detail there; this screen branches on **no** code and renders whichever it is given.

## Implementation Decisions

### D1 — A dialog on Document Details, not a route

`ReturnDialog` lives in `src/features/oms/document/`, opened from the existing `return-document`
command in `DocumentDetailsPage`'s action switch — the line that toasts `returnDocument.unavailable`
today. **No new route, no new menu entry, no new feature folder**, so none of
`.claude/rules/feature-structure.md`'s registration checklist beyond the i18n keys applies.

The ruling is 1270's and is not reopened: a return is *one decision taken about the delivery you are
looking at*, and the identity band, status rail and summary rail behind it are the context that
decision is checked against. The prior art is exact — `ChangeStoreDialog` is already a wide modal
wrapping a full AG Grid with a filter, a note field and a derived-value status line, so a grid in a
dialog is this screen's house pattern. `Modal` already provides the wide max-width, the internally
scrolling body and the pinned footer slot this needs; **nothing new is built in `core/ui`**.

### D2 — The command reads `canReturn`, and gives three reasons

`commands.ts` today gates Return on `isBeyondBorder(deliveryDocumentType)`. That function and its
`BEYOND_BORDER = 'BB'` constant **go**, along with `command.disabled.beyondBorderOnly`.

`CommandContext` gains what the server tells it, and `stateReason` gains three causes in place of
one, in the order they are checked:

| Cause | What is read | Reason shown |
|---|---|---|
| Not a delivery | `documentCategory` (already on the model) | *Open the delivery to return it.* |
| Not on the Starlinks bonded rail | `canReturn` false with a delivery category | *Only bonded deliveries handled by Starlinks can be returned here.* |
| Nothing left | `canReturn` false and the visible lines project to nothing returnable | *Everything on this delivery has already been returned.* |

⚠ **`canReturn` is one boolean carrying two of the three causes.** The server folds the store rule
and the exhausted-lines rule into one flag (1283 §2b), so a `false` on a delivery does not by itself
say which. The screen separates them from data it already holds: **if every line's remaining
quantity is zero, the cause is exhaustion; otherwise it is the store.** That is a *reason string*
choice, never an eligibility one — the button's `disabled` comes from `canReturn` and nothing else,
so a wrong split mislabels a tooltip and can never enable a command the server would refuse.

`commands.ts` stays pure and keeps taking `t` as a parameter. **No `BZ02` and no `BB` in this repo
after this change.**

### D3 — One pure module owns every decision the screen makes

`return-order.ts`, beside `change-store.ts` and `reschedule.ts`, in the document feature. Pure: no
React, no `t()`, no network, no clock. It owns:

- **The line projection.** From the delivery's `lines`, produce the returnable rows — each with its
  delivered quantity, its returned-so-far, and its remaining — plus a **count of the rows omitted**
  because nothing is left. Hiding is the projection's job; the grid renders what it is handed.
- **The fee projection.** From the delivery's `conditions`, the header delivery-fee rows: those with
  `condDocumentLine === 0` and the delivery-fee category, each carrying its type, its server-resolved
  description and its **`condAmount`** — the rate. Per `header-condition-money.md` in the BackOffice
  repo, `condValue` on a header row is structurally zero and reading it is a silent zero; and the
  per-line `'H'` copies are **never** summed in — the projection takes the item-0 row alone.
- **The submit gate.** One outcome at a time, in the order the operator must act: *select at least
  one line* → *a returned quantity must be at least 1* → *choose what happens to the goods*; then a
  summary of what is selected. A list of three complaints is not more useful than the next thing to
  do. The gate returns a **key and its parameters**, never a sentence — `t()` lives at the call site.
- **The quantity clamp.** `[1, remaining]`, applied to typed input as well as to the steppers.
- **The request builder.** Screen state → a `CreateReturnRequest`. This is where the contract is
  honoured: ticked lines only, quantity as clamped, ticked fee **types** only, `shippingAddress`
  **omitted entirely** under `RF`, note omitted when blank, and **no field that carries an amount**.

The builder is the single most valuable test in this spec: it is the one place a client-supplied
amount could reappear.

### D4 — The fee category is a display constant in this repo, and that is a considered exception

The conditions list arrives whole; there is no *is a header fee* flag on the wire and 1283 does not
add one. So `return-order.ts` carries the delivery-fee category code as a local constant and filters
on it — the WPF's own filter, unchanged.

This does **not** reopen 1267's refusal of a second `BZ02`. That code is *a value a running program
branches on to decide whether money moves*, so a second copy is a second behaviour diverging
silently. This one decides **which rows are drawn**: the server re-reads the rate for every type it
is given and owns the money regardless, a wrong filter is visible on screen the instant it is wrong,
and the alternative is a backend change 1283 does not carry, blocking the fee grid on it. Recorded
here so it reads as a decision rather than an oversight.

### D5 — The reason fork is the screen's spine

`reason` starts `null` — **neither option pre-selected** — and the submit gate treats that as its
third missing thing. The two options render as **cards carrying their consequence in the operator's
language**, not bare radio labels, because Refund Only never touches the carrier: it refunds
immediately and the customer keeps the goods, which is an irreversible money movement with nothing
coming back.

Selecting `RF` **removes the address panel from the tree**. Not disabled, not greyed — absent. And
the request builder omits `shippingAddress` under `RF` independently of what the panel did, so the
two cannot disagree.

### D6 — The address is a collapsed summary that expands into the full carrier field set

Collapsed by default to a one-line summary of the delivery's own shipping address plus a **Change**
affordance; expanded, it is district (a **picker**), city, street, building number, postal code,
short address and the additional street line — the whole set 1283 §2 carries.

The district picker reuses `lookupQueries`' cached `SdDocument/Districts` read in
`core/services/lookups` — already fetched for the Change Store picker, so the control is free and
**no feature imports another feature**. City is derived from the chosen district, as Change Store
already does it. GPS is carried through from the delivery unedited; there is no map picker here.

Edits are local to the dialog and are discarded on cancel — the address on the delivery is not
touched, only the one posted with the return.

### D7 — `requestId` is minted once per dialog opening, not per submit

The dialog mints its `requestId` when it opens and **keeps it across retries**. That is what makes
the key work: a double-click, a lost response, or a manual retry after a network failure all carry
the same key and replay onto the same return. A fresh key per submit press would create a second
return, which is precisely the failure the key exists to prevent.

Cancelling and reopening the dialog mints a new one — a deliberate new attempt is a new request.
`crypto.randomUUID()`; the server treats it as an opaque string.

### D8 — Success, replay and refusal

- **Success** — a `sonner` toast (`core/services/notify`) carrying the new `documentNo` and what
  happens next: *the courier will be asked to collect* under `RTRF`, *refund only, no collection is
  booked* under `RF`. The dialog closes and the delivery beneath it **reloads** (the existing
  TanStack Query invalidation the other write commands already use), so the reopened screen shows
  the newly-consumed quantities. The screen **stays put** — it does not navigate to the created
  return, because whether Document Details can open an `ORRT` at all is unverified and the toast
  carries the number either way.
- **Replay** (`replayed: true`) — **the same toast**, with one extra clause saying the request had
  already been received and this is the same return, not a second one. It is a success, and showing
  an error about a return that *was* created is the confusing half of the problem the key solves.
- **Refusal** — a toast **and an `ErrorBanner` inside the dialog that stays**, showing the server's
  own sentence via `apiErrorMessage` with the machine code from `apiErrorCode` beside it. The dialog
  **stays open with every selection intact**: a refusal the operator can act on must not cost them
  the form. `core/ui/ErrorBanner` already renders exactly this shape and takes children.

There is **no pre-confirm**. The dialog *is* the confirmation — the same rule `ChangeStoreDialog`
follows. `core/services/confirm` is not used on this path.

### D9 — What the screen does not send, and does not show

- **No box count and no total weight.** Dropped, per 1269: weight is optional to the carrier and OMS
  has never sent it; box count has no destination at all. Collecting either would be the WPF's
  mistake made deliberately.
- **No line money on the wire.** `unitPrice`, `discount` and `vatAmount` are **displayed read-only**
  as context and are absent from the request.
- **No grand total.** The screen shows a per-line value for the quantity selected and stops there.
  The server recomputes discount and VAT pro-rata and re-reads the fee rates, so any total this
  client added up would be a number it invented and an operator would quote to a customer.

### D10 — Data-fetching, and one new call in `api.ts`

`documentApi` gains `createReturn(body: CreateReturnRequest): Promise<CreatedReturnModel>` posting
`SdDocumentWeb/CreateReturn` — through `@/core/api` like everything else, per
`.claude/rules/api-envelope.md`. It is a TanStack `useMutation` at the dialog, not a query.

The dialog needs **no read of its own**: lines, conditions, shipping address and `canReturn` all
arrive on the `SdDocumentHeaderModel` the details page has already loaded and passes in. That is why
§2b exists.

### D11 — i18n

All copy goes under `returnDocument.*` in the **existing** `document` namespace — no new namespace,
no `core/i18n.ts` change. `returnDocument.unavailable` is deleted with the placeholder it explained.
`command.disabled.beyondBorderOnly` is replaced by the three reason keys of D2. Every string on the
screen is a `t()` key, including the consequence sentences, the *of N left* / *of N delivered* row
suffix, the hidden-lines count, the three gate sentences and the address hint
(`.claude/rules/i18n-zero-literal.md`).

The word **close** never appears on this screen. A return is not a cancellation, and `CONTEXT.md`
reserves that word for cancelling a document.

### D12 — Layout

The two grids are **stacked**, not tabbed. The fee grid is two rows and is not a peer of the line
grid; tabbing buries a money decision behind a tab nobody opens, and — unlike Document Details' own
tabs, which hide *readings* — a hidden tab here hides a **selection the submit is about to act on**.

Logical properties throughout, shadcn tokens only, no colour literals — `npm run lint`'s three gates
apply unchanged (`.claude/rules/logical-tailwind.md`).

### D13 — The joining ticket is the drift detector, and it is last

The final ticket of this spec is the one that points the built screen at a live SIS.Api. Everything
before it is built and verified against **checked-in fixtures**. That ticket's first `400` — a
rejected field name, a missing `requestId`, a `returnedQuantity` that is actually named something
else — is a **drift report against BackOffice spec 1283 §2/§2b**. The correction is made in 1283
first, in the BackOffice repo, and only then transcribed here. This is the one gate on the copy, and
it is why the copy is acceptable: a request type has nothing in this repo to typecheck against.

## Testing Decisions

**What makes a good test here.** Assert the decision, not the plumbing: the rows that survive the
projection, the number a line reports as remaining, the one sentence the gate names, the body the
builder emits. Nothing asserts that a component rendered a particular element or that a helper
exists.

**Seam 1 — pure vitest, and it carries almost everything.** *(Owner-confirmed.)* `return-order.ts`
is dependency-free by construction, so every decision in D3 red-greens in-memory. The runner is
already bootstrapped (ticket 090, `vitest.config.ts`), and the prior art is immediately adjacent —
`change-store.test.ts`, `items.test.ts`, `rail.test.ts` and `commands.test.ts` are all pure suites in
this same folder.

| Unit | Proves |
|---|---|
| **Line projection** | remaining per line; a fully-returned line **omitted** and counted in the hidden tally; an untouched line reporting its full delivered quantity; a **non-trivial** case where the answer differs from delivered, from zero, and from the last return's quantity |
| **Fee projection** | only `condDocumentLine === 0` fee rows survive; the money read is **`condAmount`**, never `condValue`; the per-line `'H'` copies are neither included nor summed |
| **Submit gate** | the three missing-things in order, exactly one at a time; the flip to a summary; that a ticked line with a cleared quantity blocks on the quantity sentence and not the lines one |
| **Quantity clamp** | `[1, remaining]` for steppers and for typed input; a pasted `0`, a negative and an over-cap value all land in range |
| **Request builder** | ticked lines only, with clamped quantities; fee **types** only; `shippingAddress` **omitted under `RF`** and present under `RTRF`; blank note omitted; ⚠ **and a whole-body assertion that no key anywhere carries an amount** — the one test that would catch money creeping back onto the wire |

**`commands.test.ts` is extended, not replaced.** It already covers the bar's shape and the
BeyondBorder gate; the gate assertions become the three `canReturn` causes, including the split
between *store* and *exhausted* that D2 derives, and a case proving `disabled` follows `canReturn`
alone even when the derived reason would say otherwise.

**Seam 2 — a Playwright drive**, `tools/return-dialog-drive.mjs`, following
`tools/document-actions-drive.mjs` and `tools/store-choice-drive.mjs` exactly (manual-run, not a CI
gate: `npx vite --port 5199` in one shell, `node tools/return-dialog-drive.mjs` in the other). It
drives what only a browser can prove:

- the command's three disabled reasons on hover and focus, and the enabled case;
- tick a line → the stepper wakes and pre-fills; `−` disabled at 1, `+` disabled at the cap;
- select-all on lines, and **no** select-all on fees;
- the fully-returned line absent, with the hidden count in the header;
- the reason cards with **nothing** selected on open; choosing `RF` **removes** the address panel
  from the DOM and choosing `RTRF` brings it back;
- expand the address, pick a district, collapse — and cancel leaves the delivery untouched;
- the submit bar's three sentences in order, then the summary;
- **success**, **replay** and **refusal** end to end — the last one asserting the banner survives
  while the toast goes, and that the selections are still there;
- an RTL pass, as `tools/document-rtl-drive.mjs` does for this screen family.

**No React Testing Library this wave.** *(Owner-confirmed, and the standing repo position — see
`CLAUDE.md`.)* The pure module is where a regression would be silent; the dialog is a thin renderer
over it, and the drive covers what a renderer can get wrong.

**Fixtures, checked in — no `msw`.** This repo has no mock infrastructure and is not growing any
here. Four fixtures live beside the existing `__fixtures__/payloads.ts`, and ⚠ **their shapes are
contractual; their values are not**:

| Fixture | What it puts on the wire |
|---|---|
| `delivery-with-remaining` | a `canReturn` delivery, one line untouched, one **partly** returned, one fully returned, two header delivery-fee conditions |
| `fully-returned-lines` | the same delivery with every line exhausted — `canReturn` false, and the projection empty |
| `refused-not-eligible` | the create door's `400` envelope: `success:false` with `errors[0].errorCode` |
| `duplicate-replay` | a `200` `CreatedReturnModel` with `replayed: true` |

The `delivery-with-remaining` line fixture is the one seeded with a **non-trivial prior-return
history** (two earlier partial returns on the same line), mirroring the mutation check 1283's own
testing section applies to the server-side arithmetic — the two sides then agree on a number that is
not the obvious one.

## Out of Scope

- **The create door itself**, the delivery model addition and every server shape — BackOffice spec
  1283, in the BackOffice repo. This spec transcribes and never owns.
- **The WPF return screen.** Not changed, not migrated, not referenced by the build.
- **The bonded return pipeline** — the return delivery, the carrier booking, the refund. Live in
  production and untouched by either half of this effort.
- **Follow-through visibility.** Showing the created return, its carrier status or its refund on the
  web. Ruled out at charting: this effort *creates* a return, it does not track one. The screen stays
  put and the toast carries the number.
- **Force Refund** and anything behind the privileged-staff policy.
- **A per-reason permission.** One guard covers creating a return, whichever reason (1269 §8, owner
  ruling). The web gate has no action dimension and is not growing one here.
- **A new route, a new nav entry or a new feature folder.** This fills a placeholder on an existing
  screen.
- **React Testing Library.** Still the hardening ticket's to add.
- **Box count and total weight** as inputs — dropped, per D9.
- **The `BuildingNumber` / `PostalCode` leak** in the server-side return-delivery address copy. The
  web collects the full set and is not the leaking side; fixing the copy edits the live pipeline and
  changes every return including the WPF's. Recorded on map 1266 as a separate effort.

## Further Notes

**Flag posture: none.** The command is a placeholder today, which is the effective off-switch. When
the screen lands the placeholder goes with it. Nothing existing changes behaviour except the
command's gate, which is being corrected because it is **wrong** — a `BB` delivery at a non-Starlinks
store is exactly the case that produces a persisted return that never refunds.

**Build order.** This spec goes to `/to-tickets` in parallel with BackOffice spec 1283; the
dependency between them is build-order only and lands on the single joining ticket (D13). Everything
before that ticket is buildable and verifiable against fixtures with SIS.Api absent — which is the
posture this repo has shipped several waves under.

**One dependency worth naming early.** `canReturn` and `returnedQuantity` are additive server fields
that do not exist yet. Until they do, the fixtures carry them and the screen behaves as though the
server sends them. A build that reaches the joining ticket before 1283's tickets land will see
`canReturn` undefined — which must read as **not returnable**, fail-closed, never as enabled.

**Recorded gaps, so they are not discovered later.** The carrier's weight field exists and OMS has
never sent it. `BuildingNumber` and `PostalCode` are collected by this screen, carried on this wire,
and still dropped downstream by a copy this effort does not touch — so they do not reach the courier
today even though the web now sends them.

**Rules that bind this work:** `.claude/rules/api-envelope.md` (the create call and its refusal),
`.claude/rules/i18n-zero-literal.md` (every string on a brand-new screen),
`.claude/rules/logical-tailwind.md` (the dialog mirrors), `.claude/rules/feature-structure.md` (this
stays inside the `document` feature and imports no other feature), and — in the BackOffice repo, read
before touching a fee — `.claude/rules/header-condition-money.md`.
