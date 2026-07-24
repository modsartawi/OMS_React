---
type: spec
status: ready
map: 068
---

# 083 — The Document Details rework

Synthesized from wayfinder map
[068 — POS palette as the app standard + Document Details rework](068-pos-palette-and-document-detail-rework.md),
tickets [072](072-command-family-taxonomy.md) · [073](073-detail-layout-with-our-data.md) ·
[076](076-action-bar-grammar.md) · [078](078-live-document-payload-capture.md) ·
[079](079-status-severity-mapping.md) · [080](080-rtl-mirroring-of-the-reworked-layout.md) ·
[081](081-rail-card-field-rules.md).

This is the **second** of the map's two specs. It consumes
[082 — The POS design system](082-pos-design-system-spec.md) and **must not start until 082 has
landed** — the map's rollout ruling is *palette first, then the screen*, and every colour named below
(`--primary`, `--success`, `--attention`, `--danger`, `--prescription`, the two family colours) is a
token 082 declares. Building against a moving palette is the one sequencing mistake available here.

## Problem Statement

Screen 2 is where an operator goes when a delivery has gone wrong. It is the screen that answers
*what is this document, who is it for, what state is it in, and what can I do about it* — and today it
answers all four in the same voice, at the same weight, in the same grey.

- **The document has no identity.** The page is titled "Document Details · 8000000174" and then
  presents three equal-weight field groups. `documentNo`, `orderNo`, the store, the customer's name
  and the net total are all label/value rows of identical prominence. An operator working a queue of
  documents has nothing to fix their eye on, and nothing that says *this one* rather than *a document*.
- **State is buried in a tab, spelled as thirteen rows of grey text.** `SdDocumentHeaderStatusModel`
  carries thirteen coded statuses. They render as a flat `FieldGroup` on a tab the operator has to
  choose to open, every row em-dashed when blank — and on live data **most of them are blank**. On the
  five captured documents the Status tab is mostly em dashes, with the two or three facts that matter
  hidden among them. Nothing on the screen distinguishes "delivered" from "cancellation requested"
  without reading.
- **Everything the operator needs at once is spread across three regions.** Customer, prescription,
  fulfilment, driver and payment fields are split between a "Document" group that mixes money with
  time slots, a "Customer" group of three rows, and a separate Shipping Address panel — while the
  driver, the tracking link and the payment instrument are not surfaced at all despite being on the
  payload.
- **The action bar is a flat row of eight buttons with a textarea attached.** There is no grouping,
  no severity, and a green `CheckCircle2` check mark on **Cancel Order** — a destructive mutation
  wearing the icon of a successful one. The standing note textarea sits at the same visual weight as
  the commands that consume it, and the coupling between them is invisible: an operator cannot tell
  which buttons post the note and which ignore it. That invisibility has already cost a workaround —
  `DocumentDetailsPage` keeps a `pendingNote` snapshot purely because Change Store must post the note
  as it read when the picker opened, not as it reads when the picker closes.
- **Fields lie or vanish on real documents.** The Fulfilment fields render the time slot and the
  delivery schedule adjacently, so `8000000174` shows the slot `"8am - 12 am"` next to a schedule of
  `20:00`–`22:00` — a visible contradiction — and `8000000121` shows a zero-length window where From
  equals To. The items grid marks a discount amber when `discount > 0`, which never fires: every real
  discount in the corpus is **negative** (`-1.500`, a promotion). `shippingAddress` can be `null`
  outright. None of this was knowable when the screen was built; all of it is knowable now.

Underneath all of it, the screen is about to change colour. 082 retires the warm-neutral palette for
the POS steel-blue scale. Re-tinting this arrangement produces a differently-coloured version of the
same undifferentiated screen — the arrangement is the problem, and the palette swap is the moment to
fix it rather than to repaint it.

## Solution

The screen is rebuilt as the approved POS device: **identity band · status pill rail · a 340px
summary rail of cards · a tabbed work area · a contextual action bar**, filled with our real
`SdDocumentHeaderModel` fields and governed by rules derived from five live payloads rather than from
a synthetic one.

**The document gets an identity.** A dark band at the top of the page carries `documentNo` as the big
line, its sub-ids beneath it, and the customer block at the end — so "whose is this" is answered
without a read of the rail. Back becomes a chevron at the start of that band; the page title and the
toolbar row above it disappear.

**State becomes a pill rail that renders only what is set.** A pill appears for every described status
that carries a value; a blank status produces **no pill at all** — not a muted one, not an em dash.
`lastAction` anchors the rail as a neutral outline that never takes a severity colour, which
guarantees the rail is never empty on any document in the corpus. Colour comes from a **per-status**
severity map holding only codes observed on live data, and the map supplies a colour and never a
word — the label is always the server's `*Description`. The thirteen-row breakdown keeps its home in
an **All statuses** disclosure at the end of the rail, and the Status *tab* is removed.

**The scattered fields become five cards on a summary rail** — Customer, Prescription (e-Rx),
Fulfilment, Driver & tracking, Payment — each with a stated emptiness rule. Money and booleans always
render (`0.00` and `No` are answers); blank text rows are omitted rather than em-dashed; two cards
collapse entirely when they have nothing to say. The driver, the tracking link and the real payment
instrument reach the screen for the first time.

**The action bar gets a grammar.** Three labelled clusters in order of increasing consequence —
Fulfilment · Cancellation request · Notes & docs — with the terminal pair (Force Cancel · Cancel
Order) pinned at the end as a *tier, not a commit*, never enlarged. Nothing is ever hidden: a command
that cannot apply is disabled and says why. The standing textarea is retired; every note is captured
at the moment of commit inside its own confirm dialog, which deletes `pendingNote` and the ambiguity
under it.

**And the field rules are corrected against the payloads.** One "Delivery window" row resolving
schedule-then-slot-then-omit, so the contradiction and the zero-length window never render. A discount
test of `!== 0` with the sign shown. A null address that silently shows name, mobile and loyalty ID —
correct, because the document that has one is a pickup. The Rx/OTC tag removed, because no field on
the payload carries it.

The result is a screen where an operator's eye lands on the document number, then on a rail of three
coloured facts, then on the block they came for — and where the destructive command is the furthest
thing on the page from the way out.

## User Stories

1. As a back-office operator, I want the document number rendered as the largest thing on the screen,
   so that I can confirm I opened the right document without reading a field label.
2. As an operator working a queue, I want the customer's name, phone and city in the identity band,
   so that I can answer "whose order is this" without reading the summary rail.
3. As an operator, I want the sub-ids (`orderNo`, document type, delivery document type, placed
   date/time, store) grouped under the big line, so that identity is one region rather than scattered
   through a field group that also holds money.
4. As an operator, I want the overall status rendered as a labelled monospace code, so that I can see
   it is a code the system has not resolved rather than mistake it for a word.
5. As an operator, I want the Dawaa Now marker to sit in the identity band as an attribute rather than
   on the status rail, so that I do not read a delivery option as a lifecycle state.
6. As an operator, I want a back chevron at the start of the identity band, so that leaving the screen
   is always in the same place whether or not any command is available to me.
7. As an operator, I want a pill only for the statuses that actually carry a value, so that I am not
   reading a rail of em dashes to find the two facts that are true.
8. As an operator, I want the last action always shown first on the rail, so that even a document with
   no lifecycle statuses tells me what most recently happened to it.
9. As an operator, I want the last action to look different from the lifecycle pills — a neutral
   outline, never coloured — so that I do not read history as a judgement about the document's state.
10. As an operator, I want a pill's colour to mean the same thing everywhere (`ok` complete, `go` in
    motion, `warn` needs a human, `bad` ended badly, `mute` unrecognised), so that I can scan the rail
    without decoding each status separately.
11. As an operator, I want `readyStatus: R` to read as "Ready" in green while `closeStatus: R` reads
    as "Close Requested" in amber on the same document, so that one letter meaning two opposite things
    never shows me one colour.
12. As an operator, I want a status the UI does not recognise to render grey with the server's own
    label, so that a new server code shows me the truth in a neutral colour rather than crying wolf.
13. As an operator, I want a status whose description merely echoes its code to render in monospace,
    so that I can tell an unresolved code from a real label.
14. As an operator, I want `closeStatus` labelled "Cancellation" rather than "Close Status", so that I
    do not read a request to abandon the order as a signal that it completed.
15. As an operator, I want all thirteen statuses still available in a disclosure at the end of the
    rail, so that promoting the useful ones never costs me access to the full record.
16. As an operator, I want the Customer card always rendered even when the document has no address, so
    that an empty customer block is itself a finding rather than a missing card.
17. As an operator, I want the address to fall back from short address to street to district to city,
    so that whichever field this particular document populated is the one I see.
18. As an operator, I want a pickup document with no shipping address to simply show name, mobile and
    loyalty ID, so that the screen does not mark an absence that is correct as a problem.
19. As an operator, I want the e-Rx card to disappear entirely on an over-the-counter order, so that I
    am not shown an empty prescription frame on every document that never had one.
20. As an operator handling a prescription, I want the approval number and patient ID on their own
    card with a distinct marker colour, so that the e-Rx facts are visually separable from fulfilment.
21. As an operator, I want a single "Delivery window" row rather than a slot row and a schedule row, so
    that I am never shown a slot that contradicts its own schedule.
22. As an operator, I want a zero-length window suppressed in favour of the slot text, so that a
    capture timestamp masquerading as a window never reaches me.
23. As an operator, I want the Fulfilment card to always render, so that delivery type and store are
    in a fixed place on every document.
24. As an operator chasing a delivery, I want a Driver & tracking card with the courier, the driver's
    name and phone and a tracking link, so that I can act on a live delivery without leaving the
    screen.
25. As an operator, I want the driver card to collapse on a pick-in-store order, so that a card with
    nothing in it does not occupy the rail.
26. As a security-conscious operator, I want the courier's master PIN never rendered, so that a
    delivery credential is not readable from a back-office screen.
27. As an operator, I want the Payment card to show the real instrument ("ApplePay · Visa") read from
    the document's own conditions, so that I am not staring at a one-letter `paymentType` code that is
    the same on every document.
28. As an operator, I want money rows to render at zero rather than being omitted, so that "nothing
    due" is stated rather than inferred from an absence.
29. As an operator, I want blank text rows omitted rather than em-dashed, so that the card shows what
    is known instead of a graveyard of dashes.
30. As an operator, I want the last note shown on the Fulfilment card, so that the most recent human
    comment is visible without opening the log.
31. As an operator, I want four tabs — Items, Header Conditions, Log, Jobs — so that the record I need
    is one click away and the status tab that duplicated the rail is gone.
32. As an operator, I want the Jobs tab to count *failed* jobs in red when any exist, so that a failed
    outbox job reaches me without my having to go looking.
33. As an operator, I want Log and Jobs to keep loading after the document renders, so that a slow
    collection never blocks the facts I opened the screen for.
34. As an operator, I want my column widths, sorts and filters to survive tab switching, so that
    setting up a grid is not undone by looking at another tab.
35. As an operator, I want item figures right-aligned in tabular numerals, so that I can compare a
    column of amounts by eye.
36. As an operator, I want a totals row pinned to the bottom of the items grid, so that the line count
    and the column sums are visible without scrolling or arithmetic.
37. As an operator, I want the item description as the first column, so that my eye lands on what was
    ordered rather than on a number.
38. As an operator, I want any non-zero discount flagged in amber **with its sign**, so that a
    promotional discount of `-1.500` is both visible and consistent with the Header Conditions tab.
39. As an operator, I want a deleted line rendered muted and struck through, so that I never act on a
    line that is no longer part of the document.
40. As an operator, I want the selected row marked with an accent bar on its leading edge, so that I
    can keep my place in a long grid.
41. As an operator, I want the commands grouped into named clusters in order of increasing
    consequence, so that I can find the one I want by meaning rather than by memorising positions.
42. As an operator, I want Force Cancel and Cancel Order pinned at the end of the bar in red, so that
    the destructive pair is somewhere I arrive at deliberately rather than pass through.
43. As an operator, I want no command ever enlarged into a "commit" position, so that the screen never
    suggests that cancelling the order is the thing I came here to do.
44. As an operator, I want Back at the top-start of the page and Cancel Order at the bottom-end, so
    that leaving and destroying are as far apart as the page allows.
45. As an operator, I want a command I cannot use to be visible but disabled **with a reason**, so
    that I can learn what the screen offers instead of discovering commands by luck.
46. As an operator on a document with an open cancellation request, I want Request Cancellation
    disabled with its reason, so that the only takeable command in that cluster is the one that makes
    sense — withdrawing it.
47. As an operator on a non-BeyondBorder document, I want Return Document disabled with its reason, so
    that I know the command exists and why it does not apply here.
48. As an operator, I want every command disabled while one is running, so that I cannot double-post a
    mutation, and I want no reason shown for that — the spinner already says it.
49. As an operator, I want no command ever hidden, so that the bar I learn on one document is the bar
    I meet on the next.
50. As an operator, I want to type my note inside the dialog of the command that will post it, so that
    I can see which command my words are attached to.
51. As an operator, I want Add Note… to open a dialog whose confirm stays disabled until I have typed
    something, so that I cannot append an empty entry to the log.
52. As an operator changing a store, I want the note I type in that dialog to be the note that posts,
    so that there is no hidden snapshot taken at a moment I did not choose.
53. As an operator, I want Cancel Order to stop wearing a green check mark, so that the icon does not
    contradict what the button does.
54. As an operator, I want Refresh at the end of the pill rail, so that the control and its most
    visible effect are in the same place.
55. As an operator, I want a successful refresh to stay silent and only a failure to toast, so that
    the notification channel keeps carrying things I need to read.
56. As an operator on a laptop, I want the summary rail to move above the work area below 900px as a
    card grid, so that the context I read the grid with is never hidden behind a toggle on the screen
    that most needs orientation.
57. As an operator on a narrow screen, I want the pill rail to wrap and the tab strip to scroll rather
    than truncate, so that no status or tab becomes unreachable.
58. As a future Arabic-reading operator, I want ids, phone numbers and totals to keep their internal
    order inside a right-to-left paragraph, so that a phone number never renders as
    `7712 018 55 966+`.
59. As a future Arabic-reading operator, I want the back chevron and the external-link arrow to point
    the correct way, so that navigation icons agree with the direction I read.
60. As a developer, I want the severity map to live beside the one screen that consumes it and to
    carry a written reason it is not the kind of code map issue 406 deleted, so that the next reader
    does not delete it for the wrong reason.
61. As a developer, I want the rail composition, the field resolutions and the totals reducer to be
    pure functions tested against the five captured payloads, so that a rule derived from real data
    stays derived from real data.

## Implementation Decisions

Everything below lands in `src/features/oms/document/` unless stated otherwise. The map's scope line
holds throughout: **this is arrangement and colour only** — no endpoint, `actionType`, request body or
dialog flow changes.

### D-1 · The screen is five regions, composed by the Page

`DocumentDetailsPage` keeps its two-endpoint spine unchanged (`openedAs` picks the load endpoint,
`documentCategory` picks the mutation endpoint and the actionType — D-17/D-19), keeps its deferred
Log/Jobs loads, and keeps its dialog state. What changes is what it renders: five regions in order —
**identity band · pill rail · summary rail + work area · action bar**, with the summary rail and work
area side by side above 900px.

New components beside it, all feature-local and relative-imported: an identity band, a pill rail, a
rail-card set, and a rebuilt command bar. `DocumentHeader.tsx`, `FieldGroup.tsx` and
`ShippingAddress.tsx` are superseded — the three equal-weight field groups and the standalone address
panel have no place in the new arrangement. `FieldGroup` is used by nothing else once the Status tab
goes, so it retires with them; `fields.ts` keeps its pure-builder shape and its `(document, t)`
signature but its exports are re-cut to the cards (D-6).

Above 900px the grid is `[340px 1fr]`. Below it the rail unstacks **above** the work area as
`repeat(auto-fit, minmax(250px, 1fr))` — a card grid, not a drawer. The summary is the context the
grid is read with; hiding it on the viewport that most needs orientation is backwards.

### D-2 · The identity band

A dark band — the one dark band on the page, which is why 082 rejected a dark sidebar.

| Slot | Source | Rule |
|---|---|---|
| Big line | `documentNo` | The route key and the id an operator quotes. |
| Overall lozenge | `status.overallStatus` (raw) | Labelled **monospace** code — no `*Description` companion exists. Omitted when blank (3/5 of the corpus). |
| Dawaa Now tag | `isExpressDelivery` | Squared tag in the band, never a rail pill — it is an attribute, not a status. |
| Sub-ids | `orderNo` · `documentTypeDescription` · `deliveryDocumentTypeDescription` · `documentDate`+`entryTime` · `storeCode` | Descriptions fall back to their codes. "Placed" is one row built from two fields. |
| Customer block (end) | `customer.customerName` · `customer.customerPhone` · `shippingAddress?.cityName` | Duplicated with the Customer card **by design**. |
| Back chevron (start) | — | Navigation; stays put whether or not any command is available. |

`refDocumentNo`, `documentSourceDescription` and `entryUser` move to the All-statuses disclosure's
neighbourhood rather than the band. `documentCategory` is machinery and stays off-screen.

**One build-time check:** `isExpressDelivery` is `false` on all five payloads and the owner reports the
source flag is named `IsDeliveryExpress`. Verify our field actually binds it before trusting the tag;
if it does not, the tag renders on nothing and that is a contract bug to file, not a design change.

### D-3 · The pill rail renders what is set

**The rule, replacing 073's fixed six:**

> A pill renders for **every described status that carries a value**. Blank and `null` produce no pill
> at all — not a muted one, not an em dash.

Candidate set: all **eight** statuses with a `*Description` companion, in lifecycle order —
`readyStatus` → `availabilityStatus` → `approvalStatus` → `paymentStatus` → `deliveryStatus` →
`clearStatus` → `acceptanceStatus` → `closeStatus`. Selection stops doing work once emptiness filters
the rail: an unused status costs nothing, and one that starts populating appears without a code
change. `closeStatus` renders under the label **Cancellation**.

**`lastAction` is the rail's anchor and is not a pill.** Always first, labelled *Last action*, a
neutral outline (`--border-strong` hairline, `--ink-2` text, no ground, no dot) that **never takes a
severity colour on any value**. It reports; it does not judge — and it guarantees the rail is never
empty, since it is populated on 5/5 of the corpus.

**Echo test.** When a `*Description` is blank **or equal to its code**, render the raw code in
**monospace** — the screen's established signal for *this is a code, not a word*. Applies to
`lastAction` (`TRDY` on `9000000003`) and to every status pill.

`consignmentStatus`, `controlStatus` and `notificationStatus` stay off the rail: no companion, and
`consignmentStatus`'s letter tracks `lastAction`'s outcome 4/4, making it an unlabelled echo of a
labelled fact already on the rail rather than a missing label. All three keep their rows in the
disclosure, where an em dash is correct because the disclosure's job is completeness.

Expected rails on the corpus, which is also D-14's fixture assertion:

| Document | Rail |
|---|---|
| `8000000253` | `Last action Delivered` · **Ready** · **Delivery: Delivered** |
| `8000000174` | `Last action Close Requested` · **Ready** · **Cancellation: Close Requested** |
| `2000000551` | `Last action Prescription Ready` · **Ready** · **Approval: Approved** |
| `8000000121` | `Last action Rescheduled` |
| `9000000003` | `` Last action `TRDY` `` (monospace) |

**All statuses (13)** is a disclosure at the end of the rail rendering exactly what
`statusBreakdownRows` renders today, unchanged. **Refresh** sits at the very end — quiet outlined
button, spinner in place, silent on success, toast on failure only (all unchanged behaviour).

### D-4 · Severity is per-status, and the map supplies a colour, never a word

`'R'` is "Ready" on `readyStatus` and "Close Requested" on `closeStatus` **on the same document**
(`8000000174`). A single shared code → severity table cannot be written without lying on a payload we
already hold, so the map is keyed `(status, code)`.

Severity vocabulary, fixed so the table is derivable rather than memorised — and identical to the one
082's `core/ui/severity.ts` declares:

| Severity | Means |
|---|---|
| `ok` | complete and went well |
| `go` | actively in motion |
| `warn` | needs a human |
| `bad` | ended badly, terminally |
| `mute` | not recognised |

The table, containing **only codes observed on live data**:

| Status | Code | Description | Severity |
|---|---|---|---|
| `readyStatus` | `R` | Ready | `ok` |
| `approvalStatus` | `A` | Approved | `ok` |
| `deliveryStatus` | `D` | Delivered | `ok` |
| `closeStatus` | `R` | Close Requested | **`warn`** |

Four rows is the honest extent of what five documents support. `go` and `bad` are **defined and
unused** on this rail — `bad` is reserved for an *executed* cancellation (a request is an outstanding
decision, not a finished one) and is already spent by the failed-jobs tab count; `go` is the in-motion
colour a mid-flight `deliveryStatus` takes the moment one is captured. Writing a fifth row to look
complete is the invention 073 refused and 406 punished.

**Unmapped code ⇒ `mute`.** `warn` was considered and rejected: an unrecognised code is the UI's
ignorance, not the document's problem, and amber would make the rail cry wolf every time the server
adds a code. 073's "blank ⇒ mute with an em dash" is retired — under D-3 a blank status produces no
pill.

**Lives at `features/oms/document/status-severity.ts`** — feature-local, not
`core/constants/oms-codes.ts`. One screen consumes it; shared code moves up when a *second* consumer
appears, not in anticipation of one. Keeping it out of `oms-codes.ts` also keeps it away from that
file's standing deletion warning.

**This paragraph goes in the file header**, not only in the spec:

> The map never supplies a word. The pill's label always comes from the server's `*Description`
> companion; this map supplies only a **colour**. A missing entry costs a colour and nothing else —
> the pill still renders and still reads correctly, just in grey. The 406 maps were deleted because a
> missing entry rendered a **raw code to the operator**, and because the server already resolved what
> they were resolving. Severity is not on the payload and no server field carries it; it cannot be
> resolved server-side. Different failure mode, different justification.

The severity → class mapping itself is **not** re-declared here: it comes from 082's
`core/ui/severity.ts`, and the pill renders through 082's `StatusBadge` where the shape fits.

### D-5 · The emptiness test, stated once for the whole rail

Live data emits `null` and `''` for the same field on different documents, and every unset date is the
.NET `DateTime.MinValue` sentinel.

| Kind | Empty when | Note |
|---|---|---|
| Text | `null`, `undefined`, or `''` after `.trim()` | Must cover `null` — the model types many of these `string`, the wire sends `null`. `fields.ts`'s existing `text()` already collapses both. |
| Date | empty text **or** `year <= 1` | **Already implemented**: `isBlankDate` in `core/util/date-format.ts`. It is module-private — **export it** rather than reinventing the sentinel test at the card. |
| Money / boolean | never — `0.00` and `No` are answers | |

Inside a rendered card: **money and boolean rows always render; blank text rows are omitted.** No em
dashes. This replaces today's `FieldGroup` behaviour, which em-dashes everything.

### D-6 · The five rail cards

| Card | Accent | Rows | Emptiness |
|---|---|---|---|
| **Customer** | `--primary` | `customerName` · `customerPhone` · `customerId` · `shippingAddress?.cityName` · address line | **Always renders** — the identity anchor; an empty one is itself the finding. |
| **Prescription (e-Rx)** | `--prescription` | `approvalNumber` · `patientId` · `clinicianName` · `referenceErx` · link `prescriptionUrl` | **Collapses** when all five are blank. |
| **Fulfilment** | `--primary` | `deliveryType` · `storeCode` · **Delivery window** (D-7) · `note` | **Always renders.** |
| **Driver & tracking** | `--fam-fulfilment` | `courierCode` · `courierDriverName` · `courierDriverPhone` · `courierDriverApproved` · link `trackingUrl`+`trackingId` | **Collapses** when `courierDriverName`, `courierCode` and `trackingId` are all blank — i.e. every pick-in-store order. |
| **Payment** | `--primary` | **Instrument** (D-8) · `deliveryFees` · `paidAmount` · `amountDue` · `netTotal` | **Always renders.** |

**Address fallback:** `shortAddress` → `street1`/`street2` → `districtName`, with `cityName` alongside.
`shippingAddress` is already typed `| null` in `sd-document.ts`, so every dereference is
optional-chained or `tsc` fails — the null case cannot be forgotten at build time. When the address is
absent the card shows **name · mobile · loyalty ID and nothing else**, and there is **no
missing-address marker**: the one null-address document is a pickup, where having no delivery address
is correct. An address object whose every field is `''` takes the identical path by D-5, so the card
needs one code path rather than two. (Corpus coverage: `shortAddress` 1/5, `street1` 1/5,
`districtName` 2/5, `cityName` 3/5 — every step of the chain is the only thing present on some
document.)

**The e-Rx card stands as drawn, and is two rows on today's data.** `approvalId` is deliberately
**not** added — a system identifier, not something an operator reads or quotes. `clinicianContact`,
`diagnosis` and `payerCode` are not added either. The five-field collapse test is effectively
`approvalNumber || patientId`, which is correct: it renders on `2000000551` and collapses on the other
four. Recorded so nobody reads the drawn five rows as a promise.

**`courierDriverMasterPinCode` is never rendered.** It is genuinely populated (`"1234"`); a delivery
PIN does not belong on a back-office screen.

**`deliveryType`** renders through a **two-entry** map (`D` Delivery, `P` Pick In Store) — the model's
comments verify exactly two values. `courierCode` renders raw (`FREY`, `DAWA`, no descriptions, no map
worth writing).

### D-7 · One "Delivery window" row, schedule wins

073 rendered the slot and the schedule adjacently; on live data that shows a contradiction
(`8000000174`: slot `"8am - 12 am"`, schedule `20:00`–`22:00`) and a zero-length window
(`8000000121`: From == To == `23:56:36.389`, a capture timestamp). Neither source is reliable alone —
the pair is a usable window on 1/5, the slot text present on 2/5 and malformed on one of those.

One row, three-step resolution:

1. `deliveryScheduleFromTime`–`ToTime` when **both are non-sentinel and From `<` To**. Strict `<`, so
   the equal-timestamp case falls through rather than rendering a zero-length window.
2. Otherwise `timeSlotDay` + `timeSlotDescription` when non-blank.
3. Otherwise **omit the row** (text row, D-5 applies).

Against the corpus: `8000000174` → `20:00 - 22:00`, `8000000121` → `Monday, 8pm - 10 pm`, the other
three omitted. The malformed slot text and its disagreement with its own schedule are **data findings,
not UI findings** — the resolution order means the rail never displays the disagreement, and this map
does not chase which is correct.

### D-8 · The Payment card's instrument row reads the header condition

Coded `paymentType` is `"C"` on all five documents — one value, no companion, no map worth writing.
The real instrument rides on a **header-level condition** (`condDocumentLine: 0`) carrying `cardType:
"Visa"` and `paymentMethod: "ApplePay"` — server-resolved, human-readable, no map needed.

1. The **first condition with a non-blank `cardType` or `paymentMethod`** → render
   `paymentMethod · cardType` (`"ApplePay · Visa"`).
2. Otherwise the raw `paymentType`.
3. Text row — omitted when both are blank.

**Do not key on `condType`.** On both captures the payment fields ride on the `DFEE` (Delivery Fees)
condition, which is plainly incidental; a lookup keyed on `DFEE` breaks the first time it moves. Scan
for the **fields**, not the type. `referenceNumber` is **not** added to the card — a support-desk
lookup key, not a glance value, and already visible on the Header Conditions tab.

### D-9 · Four tabs, and the items table

`Items` (`lines`) · `Header Conditions` (`conditions` where `condDocumentLine === 0`) · `Log` · `Jobs`.
The **Status tab is removed** — its content is the rail plus the All-statuses disclosure. Log stays a
tab: it is the forensic record of the unhappy path this screen exists to work. **Jobs' tab count shows
*failed* jobs in `--danger` when any exist**, total otherwise. Deferred loading and the mounted-hidden
panels are unchanged — unmounting an AG Grid throws away the operator's column widths, sort and
filters (D-23).

Items table treatments:

| Treatment | Verdict |
|---|---|
| Right-aligned tabular figures | **Already ships** — `type:'numericColumn'` sets `.ag-right-aligned-cell`, which 082's theme gives `tabular-nums`. No per-column work. |
| Selected row + inset accent bar | **Theme (082)** — `rowSelection:'single'` here; the bar is 082's `.ag-row-selected::after` with `inset-inline-start`. **Not** `box-shadow`, whose offsets are physical and do not mirror. |
| Totals footer | **Config + pure helper** — `pinnedBottomRowData`, one row computed from `lines` (count, Σ quantity, Σ grossAmount, Σ vatAmount, Σ netAmount). Pure function beside `columns.ts`. |
| Discount flag | **Renderer** — `cellClassRules` → `--attention-800` when `discount !== 0` (**not** `> 0`), and the value renders **as the payload carries it, sign included** (`-1.500`). The only non-zero discount in the corpus is negative; suppressing the sign would put the grid in disagreement with both the API and the Header Conditions tab one tab away. |
| Deleted line | **Renderer** — `deleted === true` ⇒ muted + struck. A deleted line indistinguishable from a live one is a real reading hazard. |
| Description first | **Config** — the eye should land on a name, not a number. |
| Rx / OTC tag | **Removed, not deferred** — `referenceErxLine` is `""` on the one real prescription and `itemCategory` is `"STND"`. No field carries it. The description renders plain. |
| Stock column | **Dropped** — no stock field exists. Its slot goes to `needTransaction`. |
| Zebra striping | **Not ours** — 082 rules row banding off for every grid; `rowBorder` on `--divider` carries the rhythm. |

The totals footer's `4 lines · 7 units` text is a **bidi hazard** (D-12) and takes the grid `cellClass`
082's theme declares.

**Known and out of scope:** line `vatAmount` disagrees with the `VATF` condition on `8000000121`, so
the pinned footer will agree with the grid and disagree with the conditions tab. That is a data
correctness question, not an arrangement one.

### D-10 · The action bar: clusters, a terminal tier, nothing hidden

**There are no state gates in the code to drive a promotion table off, by design.** `documentCategory`
picks the endpoint and never decides whether a command is *offered*; `deliveryType` gates nothing;
`status` is read only by the rail. Inventing the missing matrix would re-implement server rules in the
client — which the code deliberately refuses and this map lists as out of scope.

**The ruling is evidence-only gating:** contextual solely where live data proves a contradiction,
static everywhere else. The server remains the authority on legality and says so in its `400`.

| Gate | Condition | Effect |
|---|---|---|
| Cancellation request open | `closeStatus === 'R'` (1/5 live docs) | **Request Cancellation** disabled + reason. Its inverse, **Withdraw Request**, is thereby the cluster's only enabled member — *that is the promotion*. Nothing grows, moves or changes colour. |
| BeyondBorder only | `deliveryDocumentType !== 'BB'` | **Return Document** disabled + reason. Unchanged from today. |

The clusters, in order of increasing consequence, which is also reading order:

| Order | Cluster | Label | Commands | Treatment |
|---|---|---|---|---|
| 1 | Fulfilment | shown | Reschedule · Change Store | `--fam-fulfilment` |
| 2 | Cancellation request | shown | Request Cancellation · Withdraw Request | `--fam-cancel-request` |
| 3 | Notes & docs | shown | Add Note… · Return Document | ghost |
| — | *terminal tier* | **none** | Force Cancel · Cancel Order | `--danger` outlined · `--danger` filled |

Every cluster holds exactly two commands, so the single-command-label case never arises. The terminal
tier is deliberately unlabelled — a label would make it read as a fourth family rather than as the
edge of the bar.

**The escape slot stays empty.** Back is the band chevron; a page is not a modal. This settles the
safety requirement structurally rather than by warning: Back top-start, Cancel Order bottom-end.

**The promoted-commit slot is permanently empty.** The terminal pair is a **tier, not a commit** — same
button height as the cluster buttons, distinguished by colour and position alone, **never enlarged**.
No command on this screen is a positive outcome, so there is no next step to promote; enlarging Cancel
Order would put a destructive mutation in the Save/Submit position. 073's prototype drew the
reference's large commit button — **that is the one thing the build must not copy.**

**Nothing is ever hidden.**

| Cause | Treatment |
|---|---|
| state-invalid / type-invalid | **disabled + a reason** on hover and focus |
| transiently busy (`commandBusy`) | **disabled, no reason** — the spinner already reports it |

A command that vanishes is a command an operator cannot discover, and a bar whose contents shift
between visits cannot be learned. Hiding is also this map's scope boundary — a hidden command cannot be
invoked at all, which is behaviour.

**No `More ▾`.** Designed for ~30 POS commands; at eight it hides a quarter of the bar to save nothing.
Below the width where three clusters fit, the cluster group **wraps** and the terminal pair stays
pinned to the end.

**View-only is recorded as having no trigger, not as unbuilt** — there is no permission gating anywhere
in `features/oms/document/` and Deliveries carries no `accessProbe`, so minting one to satisfy a
borrowed grammar would be behaviour.

### D-11 · The note moves into the dialogs, and `pendingNote` dies

The standing textarea is removed. Every command that posts a note captures it **inside its own confirm
dialog**, exactly as `RequestCloseDialog` already does for the cancellation reason. `Add Note…` becomes
a dialog-opening command, **always enabled**, whose dialog's confirm is disabled until the text is
non-empty — preserving today's real rule (an empty note is meaningless in an append-only log) at the
place that can now enforce it.

Concretely, the build deletes:

- **`pendingNote`** — it exists solely because Change Store had to snapshot the standing textarea when
  the picker opened. With no textarea there is nothing to snapshot, and the ambiguity goes with it.
- **The `!hasNote` gate** on `add-note` — its input is gone; the rule moves into the dialog.
- **The `CheckCircle2` icon on `close`** — a check mark on Cancel Order is the exact confusion this
  grammar exists to remove.

Endpoints, `actionType` codes and request bodies are untouched. Only where the text is typed moves.

### D-12 · RTL: the fixes and the bidi wrappers land now; the `dir` switch does not

The mirroring audit verified eleven mechanisms and found eight faults, five of which are one-line
respellings **byte-identical under LTR** — they are simply the correct spelling of rules already
written, so they land in this build with no `dir` switch in existence and no visual change to the
shipping screen.

In scope now:

- **`margin-inline-start: auto`** for the identity band's customer block (and its media-query reset).
  Latent today — inert while the sub-ids column grows — and bites the moment the band wraps.
- **The selected-row bar as a pseudo-element** with `inset-inline-start`, never `box-shadow` (whose
  offsets are physical and have no logical form). 082's theme already specifies it correctly.
- **`border-start-start-radius: 0`** on the work-area frame, so the square notch that meets the active
  tab follows the tab strip when it mirrors.
- **Bidi isolation on six fields** via a small `core/ui/Ltr` wrapper: the three phone numbers, the two
  band date/time values, and the grid's totals footer text. The rule for reviewers is deliberately
  dumb — **a server value that mixes digits and spaces gets wrapped** — because a value breaks only
  when it contains a **space** and begins or ends with a digit. Measured safe and untouched:
  `ERX-77120934`, `1180-4471`, `240.70`, `1000000393`. Over-application is free; **wrap a whole value,
  never a fragment** — isolating an id inside `↗ Track SMSA-91180442` *created* a fault by splitting an
  all-Latin run.
- **Icons:** the back chevron **mirrors** and the external-link `↗` **mirrors to `↖`**, both as explicit
  flips on SVG. Refresh `↻`, the disclosure `▾` and `⚡` do not mirror. The transferable rule: **if an
  icon must mirror, ship it as an SVG and flip it explicitly — never let a punctuation character be an
  icon.** `‹` (U+2039) is `Bidi_Mirrored`, so it flips itself, hides the fault, and double-mirrors the
  obvious fix.

**Out of scope now** (recorded so the next effort knows where they live): the `dir` switch itself, and
`enableRtl` as a single derived value exported beside the grid theme — today's lone call site reads a
`dir` nothing in the app ever sets. Everything *inside* AG Grid mirrors itself via its own
`.ag-ltr`/`.ag-rtl` guards. Arabic **copy and font metrics** stay out with the translation effort;
Arabic is taller and often wider and will pressure the 340px rail and the uppercase card headings when
it arrives.

### D-13 · i18n

Namespace stays `document`; every string below is a new or changed key in
`src/locales/en/document.json`, added in the same change that uses it.

- **Renames:** `closeStatus` → "Cancellation"; the four command labels take 072's cancel-wording
  (Cancel Order · Force Cancel · Request Cancellation · Withdraw Request).
- **New:** the three cluster labels; the two disabled reasons (cancellation-request-already-open,
  BeyondBorder-only); the Add Note dialog's title, label and placeholder; the five card titles; the
  "Delivery window" label; the "All statuses" disclosure label; the rail's "Last action" label; the
  identity band's sub-id labels; the totals-footer labels.
- **Retired:** `command.note` / `command.notePlaceholder` (the standing textarea), `groups.status` and
  the Status tab label, `auth.json`'s dead `subtitle: "OMS Portal"` if 082 has not already taken it.
- The severity map and `StatusBadge` add **no** `t()` call: labels are children and keys, never
  produced by the lookup — which is what keeps zero-literal a caller concern.

### D-14 · Where the logic lives

Pure and testable, in `features/oms/document/`:

- **`status-severity.ts`** — the per-status map (D-4) and the echo test (D-3).
- **`rail.ts`** — rail composition: `(status) → RailEntry[]`, the anchor plus one entry per described
  status carrying a value.
- **`fields.ts`** (re-cut) — the five cards' row builders, the address fallback, the delivery-window
  resolution (D-7), the payment-instrument scan (D-8). Keeps its `(document, t)` pure signature.
- **`columns.ts`** + a sibling totals reducer — the pinned footer row and the corrected discount rule.

The severity **class** strings, the `Severity` type and `StatusBadge` come from 082's `core/ui`. This
spec adds nothing to `core/` except the `isBlankDate` export (D-5) and the `Ltr` wrapper (D-12).

## Testing Decisions

**This spec bootstraps vitest.** 082 correctly declined it — declarative CSS and mechanical
substitution have almost nothing to exercise. This spec is the opposite: the rail composition, the
per-status severity lookup, the delivery-window resolution, the payment-instrument scan, the address
fallback chain and the totals reducer are **real rules derived from evidence**, and their regressions
are silent — a wrong severity still renders a pill, a broken window resolution still renders a row.
The five payloads in `assets/078-document-payloads/` are a ready-made fixture corpus that already
encodes every edge the rules were written against.

**What makes a good test here:** assert the *output* of a pure function against a real payload —
"`8000000174` produces a three-entry rail whose Cancellation entry is `warn`" — never the shape of the
lookup table. A test that asserts the map equals a literal restates the implementation and fails only
when someone deliberately changes it. Every assertion below is phrased against a captured document.

**Seams, highest first:**

| Seam | Tier | What it proves |
|---|---|---|
| `rail.ts` + `status-severity.ts` | pure, in-memory | The composition rule and the severity table: the 2·0·2·2·0 pill counts, `lastAction` always present, `'R'` resolving differently on `readyStatus` and `closeStatus`, the monospace echo on `9000000003`, unmapped ⇒ `mute`. |
| `fields.ts` card builders | pure, in-memory | D-5's emptiness test on `null` vs `''` vs sentinel dates; the address chain including the null parent on `2000000551` and the all-blank object on `8000000253`; the window resolution across all five (schedule · slot · omitted×3); the instrument scan finding `ApplePay · Visa` without keying on `DFEE`; the e-Rx collapse. |
| the totals reducer | pure, in-memory | The pinned footer sums, including the negative discount on `2000000551`. |
| `npm run typecheck` | compiler | `Severity` exhaustiveness, and the `shippingAddress: … \| null` chain — the compiler is the null-address test, so no runtime test duplicates it. |
| Driving the app | manual + Playwright | The part no unit test reaches: that the arrangement *reads* right, in both themes, and that the action bar's disabled-with-reason states behave. |

**Runner scope is deliberately narrow: vitest only, no RTL.** The pure modules are where the evidence
lives and where regression is silent; the components are thin renderers of their output. Adding React
Testing Library here would spend most of this spec's testing weight on setup rather than on the rules,
and the component seam is genuinely covered by driving the app. RTL remains available to the hardening
ticket, and `StatusBadge` (082's) plus these components are its natural first subjects.

**Fixtures are the payloads themselves**, imported from `assets/078-document-payloads/*.json` and
typed as `SdDocumentHeaderModel` — not hand-written objects. That is the whole point: every rule in
this spec was derived from those five files, and a fixture that drifts from them is a rule tested
against a hypothesis. The redactions (`courierDriverMasterPinCode`, `customer.nationalIdNumber`) are
already applied and each file's `_capture` block says so.

**The Playwright drive** is `tools/document-detail-drive.mjs`, modelled directly on
`tools/screen1-smoke.mjs` and `tools/bby-inquiry-drive.mjs`: open a real document, assert the identity
band's big line, count the rail's pills, switch all four tabs, confirm the summary rail collapses
below 900px, and confirm the terminal pair renders at the end of the bar disabled-when-busy. It needs
SIS.Api on `:5111`, so it stays a manual-run tool like its prior art rather than a CI gate.

**Manual verification covers**, in both themes: the identity band's dark ground against 082's dark
page, the five cards on each of the five documents (which exercises every collapse), the pill rail's
colours, the items grid's selected row and pinned footer, and the action bar at a width that forces the
cluster group to wrap.

**Prior art:** `tools/screen1-smoke.mjs`, `tools/bby-inquiry-drive.mjs` (Playwright drives of a real
screen), `tools/check-boundaries.mjs` (the static-gate shape 082 extends).

## Out of Scope

- **The design system itself.** Tokens, the severity class strings, `StatusBadge`, `severity.ts`, the
  AG Grid theme and the raw-palette sweep are [082](082-pos-design-system-spec.md). This spec consumes
  them and must not re-declare a value.
- **Any change to document command behaviour** — endpoints, the `actionType` matrix, request bodies,
  and the Reschedule / Change Store / Request Close dialog flows. The bar only triggers them. D-11
  moves *where the note is typed*, not what is posted.
- **Sourcing the true command-legality matrix** from the WPF `DocumentDetailsController` or the
  server. Offered and rejected: the client deliberately does not gate on status, and reproducing the
  server's rules here is command behaviour. A real matrix would need its own effort, with the drift
  risk in view.
- **A view-only / permission-gated state.** No permission gating exists on this screen; minting one to
  satisfy a borrowed grammar would be behaviour. Recorded as having no trigger, not as unbuilt.
- **The RTL `dir` switch** and `enableRtl`'s derived value. D-12 lands the fixes and the bidi wrappers
  and names where the rest will live.
- **Arabic copy and font metrics.** Arabic will pressure the 340px rail and the uppercase card
  headings; that belongs to whatever effort ships the translation.
- **The `vatAmount` disagreement** between line values and the `VATF` condition, and the
  `timeSlotDescription` / schedule contradiction. Both are data-correctness questions. D-7 ensures the
  screen never *displays* the second one.
- **Model drift** — `isBondedZone`, `promotionCouponDiscount`, `promotionCouponCode` are returned by
  the API and undeclared in `sd-document.ts`. Harmless at runtime; nothing on this screen reads them.
  Recorded so the build does not rediscover it.
- **An Rx / OTC line tag.** Removed rather than deferred — no field on the payload carries it. It
  returns only if a field is identified, which is a new question.
- **React Testing Library.** See Testing Decisions.

## Further Notes

**Why the pill rail changed shape between 073 and here.** 073 chose six promoted statuses against a
**synthetic** payload in which all six were populated — SIS.Api was down that session, and the ticket
was explicit that its values were invented. When 078 captured five real documents, that rail rendered
2·0·2·2·0 pills and two of the six chosen statuses (`availabilityStatus`, `paymentStatus`) turned out
to be populated on **none** of them, while the two 073 demoted carried the state. The layout, the
cards, the tabs, the note ruling and the chrome all survived unchanged; only the rail's contents fell.
That is the sequence to keep in view when reading 073's prototype — **it is still the approved device,
and its pill rail is the one region this spec supersedes.**

**On writing a code map at all.** This repo deleted a set of client-side code maps under issue 406
because they never once fired on live data and the server already resolved what they resolved. The
severity map looks like the same thing and is not, for one reason worth repeating in review: it maps to
**severity**, which no server field carries and which therefore cannot be resolved server-side — and a
missing entry costs a *colour*, never a word, because the label always comes from the server's
`*Description`. If a future reader reaches for the delete key, that paragraph in the file header is the
answer.

**Four rows is the deliverable, not a shortfall.** The severity table's honesty is load-bearing: `go`
and `bad` are defined and unowned on this rail, and the temptation to fill them so the table looks
complete is exactly what 406 punished. `bad` waits for an *executed* cancellation; `go` waits for a
mid-flight delivery. Both will arrive from a capture, not from a guess.

**The one thing the build must not copy.** 073's prototype renders the reference's large commit button
in the bottom-end slot with `Cancel Order` in it. 076 ruled that slot permanently empty on this screen,
because 072 established that no command here is a positive outcome. If the build reproduces the
prototype faithfully it will ship a destructive mutation in the Save position — the single most
consequential detail on which the picture and the spec disagree.

**Sequencing within the build.** 082 lands first, entirely — tokens, `@theme inline` bridge, grid
theme, `severity.ts`, `StatusBadge`, sweep. Then, on this spec: the pure modules and their tests
(`status-severity`, `rail`, the re-cut `fields`, the totals reducer) before the components that render
them; the identity band and pill rail before the cards, since the rail is what makes the Status tab
removable; the action bar last, because it is the only region whose change deletes state
(`pendingNote`) elsewhere in the page.

**The `isExpressDelivery` check is a grep, not a ticket.** No express document exists in the corpus and
the owner reports the source flag is `IsDeliveryExpress`. One check against the API contract during
D-2's build settles whether the Dawaa Now tag can ever render; if it cannot, that is a contract bug to
file rather than a reason to redesign the band.
