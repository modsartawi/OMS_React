---
type: wayfinder-ticket
wayfinder: prototype
map: 068
status: done
blocked-by: 070
---

# 073 — The reworked layout, filled with our real fields

## Question

The prototype is filled with invented POS content. Replicate its layout with **our** data and settle
every place the two don't line up. This is the ticket that turns a picture into a buildable screen.

Settle:

- **The four rail cards → our fields.** `SdDocumentHeaderModel` carries almost all of it — Customer
  (`customer.customerName` / `customerPhone`, `shippingAddress.cityName` / `shortAddress`),
  Prescription (`approvalNumber`, `patientId`, `clinicianName`, `prescriptionUrl`), Fulfilment
  (`deliveryType`, `isExpressDelivery`, `timeSlotDescription`, `deliveryScheduleFromTime`/`ToTime`,
  `note`), Payment (`paymentType`, `deliveryFees`, `amountDue`, `netTotal`). Confirm each mapping,
  and decide what fills the gaps. Note the prototype's cards **collapse when unpopulated** — state
  the emptiness rule per card (and note the Driver card the prototype's annotations mention but
  don't render; we have `courierDriver*`, so decide whether a fifth card exists).
- **The identity band.** Which of `documentNo` / `orderNo` / `documentTypeDescription` /
  `deliveryDocumentTypeDescription` / `documentDate` / `entryTime` occupy the big line vs the sub-ids,
  and where the express-delivery ("Dawaa Now") tag goes — today it's a pill above the title.
- **The pill rail.** `SdDocumentHeaderStatusModel` has 13+ coded statuses. Pick the **6** promoted to
  pills, and note that three of them (`consignmentStatus`, `controlStatus`, `notificationStatus`)
  have **no description companion** and render as raw codes — which either disqualifies them from
  the rail or requires a code→label map. Severity mapping (ok / go / warn / mute) can stay fog if the
  code values aren't all known yet; say so rather than guessing.
- **Tabs: 5 into 3.** The prototype shows Items / Header Conditions / Status; we also have **Log**
  and **Jobs**. Decide: five tabs (deviating from the prototype), or Log/Jobs move somewhere else.
  Note the Status *tab* survives in the prototype even though statuses are also pills — pills are the
  summary, the tab is the record.
- **The note field.** Our `CommandPanel` owns a note textarea that several commands post. The
  prototype's action bar has no text input at all. Where does it go? (This one is shared with 076 —
  resolve the *placement*, leave the action grammar to 076.)
- **The items table.** AG Grid renders it, but the prototype's look is specific: right-aligned tabular
  figures, `Rx`/`OTC` inline tags, a highlighted selected row with an inset accent bar, a totals
  footer row. Decide which are AG Grid config, which are cell renderers, and which we drop.
- **Refresh / back.** Today the page has a back link and a Refresh button above the title. Place them
  in the new chrome.

Deliver `073-detail-layout.PROTOTYPE.html` — the device rebuilt against a real document payload
(use `Document/1000000393` or delivery `9000000003` as the shape reference), on the 070 tokens,
responsive rather than fixed-1024, with any field that has no source clearly marked as such.

## Comments

**From [072 — The command-family taxonomy](072-command-family-taxonomy.md) (done):** two facts land
on this ticket.

1. **Pill severities are fixed at five** — the POS four (ok / go / warn / mute) plus `bad`
   (`--danger`), for a cancelled order. Picking the six promoted statuses stays yours; inventing a
   sixth severity is not.
2. **"Close" means cancel** in this system (`request-close` picks from `CANCEL_REASONS`). 072 renamed
   the four *command* labels accordingly (Cancel Order · Force Cancel · Request Cancellation ·
   Withdraw Request). The same confusion sits in the **field** labels this ticket owns — `closeStatus`
   currently renders as "Close Status", which reads as *completion*. Decide the field-label wording
   as part of the pill rail; the underlying field names and codes do not change.

**From [070 — The POS token remap (light)](070-pos-token-remap-light.md) (done):** two things land on
this ticket.

1. **The prescription / e-Rx accent `#0B7C8C`** (POS `--fam-insurance`) — 072 ruled its *value*
   survives, 070 deliberately did **not** declare it, so **this ticket names it**.
2. **The pill rail is now a lookup, not a design.** All five severities have full tokens —
   `--success*` (ok), `--primary*` (go), `--attention*` (warn), `--danger*` (bad) and
   `--muted` / `--ink-3` (mute) — each with a `-050` ground, a `-border` and an `-800` ink. What
   remains is only which coded status maps to which severity.

Also relevant to the layout: 070 rejected a dark sidebar band precisely so that **the one dark band on
the page belongs to this screen's identity header**, as the POS reference draws it.

## Answer

Approved by the owner, 2026-07-24, against
[assets/073-detail-layout.PROTOTYPE.html](assets/073-detail-layout.PROTOTYPE.html) — the reference
device rebuilt on the 070 light tokens, responsive (rail unstacks below 900px), every slot bound to a
real `SdDocumentHeaderModel` path, with nine mapping sections under it.

⚠ **The payload is synthetic.** SIS.Api (:5111) was unreachable this session, so values are hand-built
to the model's shape and to the codes its comments verify on `Document/1000000393`. Shapes are real;
values are not. That is why the severity mapping below is left unresolved rather than guessed — and it
is why ticket **078** exists.

### The owner ruling that reshaped the ticket

**The Status tab is removed.** The ticket assumed the reference's split — pills are the summary, the
tab is the record. The owner overruled it mid-session: *"remove the status, we now put them on top, no
need the tab."* So the screen has **four** tabs, not five and not the reference's three. The seven
statuses the rail does not promote keep their record in a quiet **All statuses (13)** disclosure at the
end of the pill rail, rendering exactly what `statusBreakdownRows` renders today. The tab is gone; the
data is not.

### 1 · The identity band

| Slot | Source | Ruling |
|---|---|---|
| Big line | `documentNo` | The route key, the Screen 1 link target, the id an operator quotes. |
| Overall lozenge | `status.overallStatus` (raw) | No `*Description` companion. Rendered as a labelled **monospace** code — owning that it is a code beats a hand-maintained map (the 406 precedent). Omitted when blank. |
| Dawaa Now tag | `isExpressDelivery` | Moves off the toolbar into the band. An **attribute**, not a status — so a squared amber tag, never a rail pill. |
| Sub-ids | `orderNo` · `documentTypeDescription` · `deliveryDocumentTypeDescription` · `documentDate`+`entryTime` · `storeCode` | Descriptions fall back to their codes. "Placed" is one field built from two. `storeCode` is promoted out of today's Document group — it is identity, not detail. |
| Right block | `customer.customerName`, `customer.customerPhone`, `shippingAddress.cityName` | Duplicated with the Customer rail card **by design** — the band answers "whose is this" without a read of the rail. |
| Back chevron | — | See §8. |

Demoted to the disclosure: `refDocumentNo`, `documentSourceDescription`, `entryUser`.
`documentCategory` is machinery (it picks the mutation endpoint) and is never operator-facing.

### 2 · The pill rail — the six promoted

**Ready** (`readyStatusDescription`) · **Availability** (`availabilityStatusDescription`) ·
**Approval** (`approvalStatusDescription`) · **Payment** (`paymentStatusDescription`) ·
**Delivery** (`deliveryStatusDescription`) · **Cancellation** (`closeStatusDescription`).

All six have a description companion, so **no pill ever renders a raw code**. They are the document's
lifecycle: prepared → in stock → cleared → paid → in the field → asked to stop.

**Cancellation is a relabel.** 072 established close ≡ cancel; "Close Status" reads as *completion*.
Copy only, in `src/locales/en/document.json` — the field name and the codes do not change.

**Disqualified, and why.** `consignmentStatus`, `controlStatus`, `notificationStatus` carry **no
description companion** — a rail of raw codes is a rail nobody reads, and 406 (deleted client-side code
maps that never once fired on live data) says do not invent one. `lastAction`, `clearStatus`,
`acceptanceStatus` are described but **not lifecycle** — last action is history (the Log tab is its
home), clear and acceptance are accounting/consent sub-states. All six keep their rows in the
disclosure.

**Severity mapping stays fog, deliberately.** 072 fixed the palette at five and 070 gave all five full
token tiers, so the rail is a lookup — but the *coded value sets* behind the six statuses are unknown
with the API down, and any table written here would be invention. Interim rule: **unknown code ⇒
`mute`**, blank ⇒ mute with an em dash. Narrowed from thirteen statuses to six and handed to **079**.

### 3 · The rail cards — five, two collapsible

| Card | Rows → source | Emptiness |
|---|---|---|
| **Customer** (`--primary`) | `customer.customerName` · `customer.customerPhone` · `customer.customerId` · `shippingAddress.cityName` · `shippingAddress.shortAddress` → falls back to `street1`/`street2` + `districtName` | **Always renders** — the identity anchor; an empty one is itself the finding. |
| **Prescription (e-Rx)** (`--prescription`) | `approvalNumber` · `patientId` · `clinicianName` · `referenceErx` · link `prescriptionUrl` | **Collapses** when all five are blank. An OTC counter sale has no e-Rx and should not show an empty frame. |
| **Fulfilment** (`--primary`) | `deliveryType` · `storeCode` · `timeSlotDay`+`timeSlotDescription` · `deliveryScheduleFromTime`–`ToTime` · `note` | **Always renders.** |
| **Driver & tracking** (`--fam-fulfilment`) | `courierCode` · `courierDriverName` · `courierDriverPhone` · `courierDriverApproved` · link `trackingUrl`+`trackingId` | **Collapses** when `courierDriverName`, `courierCode` and `trackingId` are all blank — i.e. on every pick-in-store order. |
| **Payment** (`--primary`) | `paymentType` · `deliveryFees` · `paidAmount` · `amountDue` · **`netTotal`** | **Always renders.** |

**The row rule, stated once:** inside a rendered card, **money and boolean rows always render** (`0.00`
and `No` are answers); **text rows are omitted when blank** — no em-dash graveyard. This replaces
today's `FieldGroup` behaviour, which em-dashes everything.

**The fifth card exists.** The reference's annotations mention a Driver card it never draws; we have
`courierDriver*` + `tracking*`, and on a Dawaa Now delivery it is the most-wanted block on the screen.
**`courierDriverMasterPinCode` is never rendered** — a delivery PIN does not belong on a back-office
screen.

### 4 · The unnamed accent, now named

070 left `#0B7C8C` for this ticket. It cannot be `--accent` (070 spent that name on a hover ground) and
it is not a command family (072 ruled it off the bar). Named for what it marks:

| Token | Value | Source | Used by |
|---|---|---|---|
| `--prescription` | `#0B7C8C` | POS `--fam-insurance` | e-Rx card accent bar · "View prescription" link |
| `--prescription-050` | `#E3F0F2` | derived | Ground of the **Rx** item tag |
| `--prescription-800` | `#085C68` | derived | Ink on the `-050` ground |

Same `-050`/`-800` tiering as 070's four severity families, so 071's dark rule (*roles, not lightness
levels — they swap sides*) applies unchanged. It is a **marker, never a control**: no button, no pill,
no focus ring is ever this teal.

### 5 · Tabs — four

`Items` (`lines`) · `Header Conditions` (`conditions` where `condDocumentLine === 0`) · `Log` · `Jobs`.

Log stays a tab: it is the forensic record of the unhappy path this screen exists to work, and burying
it costs a click on every investigation. **Jobs' tab count shows *failed* jobs in `--danger` when any
exist**, total otherwise — a failed outbox job is the one thing here that demands attention unprompted.
Deferred loading is unchanged (Log and Jobs fetch after the document renders, never blocking), and
panels stay mounted and hide with CSS — unmounting an AG Grid throws away the operator's column widths,
sort and filters (D-23).

### 6 · The note field — retired from the surface

The standing note textarea is **removed**. `Add Note…` opens a small dialog; every other note-posting
command carries an **optional note field inside its own confirm dialog** — exactly what
`RequestCloseDialog` already does for the cancellation reason.

Not only fidelity to an input-free action bar. Today the note is coupled to the commands invisibly, and
that coupling has already cost a workaround: `DocumentDetailsPage` keeps a `pendingNote` state *solely*
because Change Store must post the note as it read when the picker opened, not as it reads when the
operator finishes picking. Capturing at commit **deletes that state and the ambiguity under it**.
Endpoints, `actionType` codes and request bodies are untouched — only where the text is typed moves, so
this stays inside map 068's scope. The *displayed* last note (`note`) keeps its home: the Fulfilment
card's last row.

### 7 · The items table

| Treatment | Verdict | How |
|---|---|---|
| Right-aligned tabular figures | **Config** | Already there via `columnKit.money/number` → `type:'numericColumn'`. Add `font-variant-numeric:tabular-nums` once in the grid theme (→ 074), not per column. |
| Selected row + inset accent bar | **Config** | `rowSelection:'single'`, `--primary-050` ground, `inset-inline-start` box-shadow in `--primary`. Logical, so it mirrors in RTL for free. Theme-level (→ 074). |
| Totals footer | **Config + helper** | `pinnedBottomRowData`, one row computed from `lines` (count, Σ quantity, Σ grossAmount, Σ vatAmount, Σ netAmount). Pure function beside `columns.ts`. |
| Rx / OTC tag | **Renderer — gated** | **No Rx/OTC field exists.** Candidates: `referenceErxLine` non-empty, or a coded `itemCategory` value. Build the renderer; **do not ship the tag** until a live e-Rx document confirms which. Absent that, the description renders plain and nothing is lost. (→ 078) |
| Discount in amber | **Renderer** | `cellClassRules` → `--attention-800` when `discount > 0`. It is the column operators scan for. |
| Deleted line | **Renderer (ours)** | `deleted === true` ⇒ muted + struck. We have the field, the till did not; a deleted line indistinguishable from a live one is a real reading hazard. |
| Stock column | **Dropped** | No stock field on `SdDocumentLineModel`. Availability is answered by the rail pill at document level. Its slot goes to `needTransaction`. |
| Zebra striping | **Deferred to 074** | Genuine collision — the reference stripes `nth-child(even)`, our restyle (map 463) went zebra-less. The grid theme owns row banding for *every* grid in the app, so one screen must not settle it. |

Column set is otherwise today's `documentColumns.items()` unchanged, with **description promoted to
first** so the tag has a home and the eye lands on a name, not a number.

### 8 · Back, Refresh, responsive

- **Back** — chevron at the **start of the identity band**. It is navigation and must stay put whether
  or not any command is available. Today's separate toolbar row above the title disappears entirely.
  Consequence for 076: **072's escape-left slot has no occupant on this screen.** A page is not a modal.
- **Refresh** — **end of the pill rail**, quiet outlined button, spinner in place. Refresh's most
  visible effect *is* the pill rail; anywhere else makes the operator look in two places. Success stays
  silent, only failure toasts (unchanged).
- **< 900 px** — the rail unstacks **above** the work area as a `repeat(auto-fit, minmax(250px, 1fr))`
  card grid, **not a drawer**. The summary is the context you read the grid *with*; hiding it behind a
  toggle on the viewport that most needs orientation is backwards. Pill rail wraps, tab strip scrolls
  horizontally, items grid scrolls inside its own frame. **This closes the map's narrow-viewport fog.**

### 9 · Fields with no source — the honest list

| Wanted | Status |
|---|---|
| Rx / OTC per line | No field. Renderer built, tag gated on 078. |
| Per-line stock | No field. Column dropped. |
| `deliveryType` label | Code, no companion. Model comments verify exactly two values (`'D'` Delivery, `'P'` Pick In Store) so a **two-entry** map is safe. Anything larger repeats what 406 deleted. |
| `paymentType` label | Code, no companion, **no known value set**. Renders raw until the server's list is in hand. Do not invent a map. |
| `courierCode` label | Same. Renders raw. |
| `status.overallStatus` label | Same — hence the monospace lozenge that admits it is a code. |
| Value → severity per pill | Six code sets unknown. Unknown ⇒ `mute`. → 079, blocked on 078. |

The bottom five rows are all answered by **one live document**, which is why 078 is a task ticket rather
than five separate unknowns.

### What this hands on

- **076** — the escape-left slot is empty on this screen (Back lives in the band); the action bar renders
  three clusters (Fulfilment · Cancellation request · Notes & docs) with the terminal pair at the end,
  and `Add Note…` now opens a dialog rather than reading a standing textarea.
- **074** — zebra/row-banding, tabular-nums, and the selected-row inset bar are grid-theme decisions,
  not screen decisions.
- **077** — `--prescription` joins the token set as a marker family with the same three tiers, but is
  **not** a severity and never colours a control.
- **078 / 079** — the live-payload capture and the value→severity mapping it unblocks.

**From [080 — RTL mirroring of the reworked layout](080-rtl-mirroring-of-the-reworked-layout.md)
(done): one factual correction, and two physical rules to respell.**

§7 of this ticket says the selected-row treatment "is logical, so it mirrors in RTL for free." That
describes `inset-inline-start`, but the prototype implements
`box-shadow: inset 3px 0 0 var(--primary)` — and **`box-shadow` offsets are physical; there is no
logical form of them.** Measured under `dir="rtl"`: the bar stays on the left while the row reads from
the right, marking the trailing edge. Use the pseudo-element form
[074](074-ag-grid-theme-mapping.md) already specified — `::after` with `inset-inline-start:0` +
`inset-block:0`. **074's spec was already correct; only this ticket's prototype and prose were wrong.**

Two more physical rules in the same prototype, both one-line respellings that are byte-identical
under LTR:

- `.hdr .cust{ margin-left:auto }` → `margin-inline-start:auto` (and `:0` in the `max-width:900px`
  query). **Latent**, not visible today: `.ids` has `flex:1 1 320px` so it absorbs the free space and
  the auto margin is inert — it bites the moment the band wraps.
- `.gridwrap{ border-radius:0 9px 9px 9px }` → `border-radius:9px; border-start-start-radius:0`. The
  square notch exists to meet the active tab; the tab strip mirrors and the notch does not follow.

Also from 080: the **totals footer text `4 lines · 7 units` is a bidi hazard** (it begins with a digit
followed by a space, so the `4` detaches and lands at the far end under RTL) — the fix is a grid
`cellClass`, so it is logged on 074 rather than here. And the **Rx/OTC tag is already removed by
[078](078-live-document-payload-capture.md)**, so §7's gated renderer is moot.
