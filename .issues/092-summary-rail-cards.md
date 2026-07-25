---
status: done
spec: 083
blocked-by: 091
---

# 092 — theScatteredFieldsBecomeFiveCardsOnASummaryRail

## What to build

The three equal-weight field groups and the standalone address panel become a **340px summary rail of
five cards** beside the work area. Above 900px the page grid is `[340px 1fr]`; below it the rail
unstacks **above** the work area as `repeat(auto-fit, minmax(250px, 1fr))` — a card grid, **not a
drawer**. The summary is the context the grid is read with, and hiding it on the viewport that most
needs orientation is backwards.

`FieldGroup.tsx` and `ShippingAddress.tsx` are superseded and retire (nothing else uses `FieldGroup`
once 090 removed the Status tab). `fields.ts` keeps its pure-builder shape and its `(document, t)`
signature; its exports are re-cut to these cards.

| Card | Accent | Rows | Emptiness |
|---|---|---|---|
| **Customer** | `--primary` | `customerName` · `customerPhone` · `customerId` · `shippingAddress?.cityName` · address line | **Always renders** — the identity anchor; an empty one is itself the finding. |
| **Prescription (e-Rx)** | `--prescription` | `approvalNumber` · `patientId` · `clinicianName` · `referenceErx` · link `prescriptionUrl` | **Collapses** when all five are blank. |
| **Fulfilment** | `--primary` | `deliveryType` · `storeCode` · **Delivery window** · `note` | **Always renders.** |
| **Driver & tracking** | `--fam-fulfilment` | `courierCode` · `courierDriverName` · `courierDriverPhone` · `courierDriverApproved` · link `trackingUrl`+`trackingId` | **Collapses** when `courierDriverName`, `courierCode` and `trackingId` are all blank — i.e. every pick-in-store order. |
| **Payment** | `--primary` | **Instrument** · `deliveryFees` · `paidAmount` · `amountDue` · `netTotal` | **Always renders.** |

**The emptiness test, stated once for the whole rail.** Live data emits `null` and `''` for the same
field on different documents, and every unset date is the .NET `DateTime.MinValue` sentinel.

| Kind | Empty when |
|---|---|
| Text | `null`, `undefined`, or `''` after `.trim()` — must cover `null`; the model types many of these `string` and the wire sends `null` |
| Date | empty text **or** `year <= 1` — **already implemented** as `isBlankDate` in `core/util/date-format.ts`; **export it** rather than reinventing the sentinel test at the card |
| Money / boolean | never — `0.00` and `No` are answers |

Inside a rendered card: **money and boolean rows always render; blank text rows are omitted.** No em
dashes anywhere — that is today's `FieldGroup` behaviour and it goes with it.

**Address fallback:** `shortAddress` → `street1`/`street2` → `districtName`, with `cityName`
alongside. Every step is the only thing present on some corpus document (`shortAddress` 1/5,
`street1` 1/5, `districtName` 2/5, `cityName` 3/5). `shippingAddress` is already typed `| null`, so
every dereference is optional-chained or `tsc` fails — the compiler is the null-address test. When
the address is absent the card shows **name · mobile · loyalty ID and nothing else**, with **no
missing-address marker**: the one null-address document is a pickup, where having no delivery address
is correct. An address object whose every field is `''` takes the identical path, so the card needs
one code path rather than two.

**One "Delivery window" row, schedule wins.** Rendering the slot and the schedule adjacently shows a
contradiction on `8000000174` (slot `"8am - 12 am"` against a schedule of `20:00`–`22:00`) and a
zero-length window on `8000000121` (From == To == a capture timestamp). Three-step resolution:

1. `deliveryScheduleFromTime`–`ToTime` when **both are non-sentinel and From `<` To** — strict `<`,
   so the equal-timestamp case falls through rather than rendering a zero-length window.
2. Otherwise `timeSlotDay` + `timeSlotDescription` when non-blank.
3. Otherwise **omit the row**.

Against the corpus: `8000000174` → `20:00 - 22:00`, `8000000121` → `Monday, 8pm - 10 pm`, the other
three omitted. The malformed slot text and its disagreement with its own schedule are **data
findings, not UI findings** — the resolution order means the rail never displays the disagreement.

**The Payment card's instrument row reads the header condition.** Coded `paymentType` is `"C"` on all
five documents — one value, no companion, no map worth writing. The real instrument rides on a
header-level condition (`condDocumentLine: 0`) carrying `cardType: "Visa"` and `paymentMethod:
"ApplePay"` — server-resolved and human-readable. Take the **first condition with a non-blank
`cardType` or `paymentMethod`** → render `paymentMethod · cardType`; otherwise the raw `paymentType`;
otherwise omit. **Do not key on `condType`** — on both captures these fields ride the `DFEE`
condition, which is plainly incidental and will move. Scan for the **fields**, not the type.
`referenceNumber` is **not** added — a support-desk lookup key, already on the Header Conditions tab.

**The e-Rx card stands as drawn and is two rows on today's data.** `approvalId` is deliberately not
added (a system identifier, not something an operator reads or quotes), nor are `clinicianContact`,
`diagnosis` or `payerCode`. The five-field collapse test is effectively `approvalNumber || patientId`
— it renders on `2000000551` and collapses on the other four. Recorded so nobody reads the five drawn
rows as a promise.

**`courierDriverMasterPinCode` is never rendered.** It is genuinely populated (`"1234"`); a delivery
credential does not belong on a back-office screen. **`deliveryType`** renders through a two-entry
map (`D` Delivery, `P` Pick In Store) — the model's comments verify exactly two values. `courierCode`
renders raw (`FREY`, `DAWA` — no descriptions, no map worth writing).

## Spine reach

pure (`fields.ts` re-cut, address chain, window resolution, instrument scan) · component (five cards
+ the page's two-column / card-grid layout) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `addressFallback` — the chain resolves on each corpus document including the `null` parent on
      `2000000551` and the all-blank address object on `8000000253`, both landing on name · mobile ·
      loyalty ID with no marker · pure (vitest)
- [x] `deliveryWindow` — all five payloads: schedule on `8000000174`, slot on `8000000121`, omitted on
      the other three; the equal-timestamp window never renders · pure (vitest)
- [x] `paymentInstrument` — the scan finds `ApplePay · Visa` **without keying on `DFEE`**, falls back
      to raw `paymentType`, and omits when both are blank · pure (vitest)
- [x] `cardCollapse` — e-Rx renders only on `2000000551`; Driver & tracking collapses on every
      pick-in-store document; money and boolean rows render at `0.00` / `No` while blank text rows
      are omitted · pure (vitest) *(the pick-in-store gloss is false on live data — see Comments)*

Verify the layout and the 900px unstack by driving `npm run dev` across all five documents in both
themes, plus `npm run typecheck` (which is the null-address test).

Verified: `npm test` 40/40 (23 in `fields.test.ts`), `npm run typecheck` / `npm run lint` /
`npm run build` green, and **`node tools/document-cards-drive.mjs` 45/45** — the new drive replays the
five captured payloads into the real app and asserts every card, every row, both collapses, the 340px
rail beside the work area above 900px, the card grid above it below 900px, the absence of an em dash,
AA ink in both themes, and that `courierDriverMasterPinCode` never reaches the DOM. The two
neighbouring drives stay green (band 32/32, rail 25/25) — both carried one stale assertion this
ticket's change or 091's exposed, corrected in place.

## Boundaries

The **only** `core/` change: **export `isBlankDate`** from `core/util/date-format.ts` (today
module-private). Five card-title keys, the "Delivery window" label and the card row labels are new in
the `document` namespace. No endpoint change; the driver, the tracking link and the real payment
instrument reach the screen for the first time from data already on the payload.

## Done when

The five cards render on a 340px rail beside the work area on all five captured documents, exercising
every collapse and every step of the address chain; the rail becomes a card grid above the work area
below 900px; `FieldGroup.tsx` and `ShippingAddress.tsx` are deleted; and no em dash appears on the
rail.

## Blocked by

[091](091-identity-band.md) — the band settles the page's region composition the rail sits beneath,
and `FieldGroup` retires only once 091 has taken the last of its consumers.

## Comments

### `courierCode` is populated on 5/5 — so the driver card does NOT collapse on a pick-in-store order

The ticket and D-6 state the collapse rule as "`courierDriverName`, `courierCode` and `trackingId`
all blank" and gloss it as "i.e. every pick-in-store order". **The gloss is false against the
corpus**: `courierCode` is set on all five captures (`DAWA`, `DAWA`, `FREY`, `FREY`, `FREY`),
including both `deliveryType: 'P'` documents. The **rule** is implemented exactly as stated — so on
today's data the card renders on every document, as a two-row card (`Courier DAWA` · `Approved No`)
on the pick-in-store ones.

The rule was kept over the gloss deliberately: a courier assigned to a pickup is a fact worth one
row, and dropping `courierCode` from the test to make the gloss true would hide it. Both the vitest
seam and the drive therefore prove the collapse by blanking the three named fields on a real payload,
and assert the corpus renders the card. If the owner wants pick-in-store to collapse, that is a rule
change (test on `courierDriverName` + `trackingId` only), not a bug fix.

### The em dash is gone from the rail, and stays in the disclosure

"No em dash appears on the rail" is enforced on the **summary rail** — the drive asserts it on all
five documents. The pill rail's All-statuses disclosure keeps its dashes: 090 and D-3 put them there
because a disclosure's job is completeness, and a status the server left blank is reported as blank.
`FieldGroup.tsx` is deleted as required; its last consumer, that disclosure, now draws its own
`DisclosureGroup` inside `StatusRail.tsx`, which is where the em-dash rule is local rather than the
screen's.

### One addition outside the ticket's stated boundary: a named `rail:` screen

`isBlankDate` was already exported (091 got there first), so the ticket's stated `core/` change was a
no-op. What the layout did need was the 900px number in two places — the page grid and the rail's own
grid — which is one edit away from disagreeing. It is declared once as `--breakpoint-rail: 900px` in
`src/app/global.css`'s `@theme` block and used as the `rail:` variant. A screen name, not a colour:
the palette and contrast gates are untouched.

### What the retiring address panel took with it

`ShippingAddress.tsx` carried `cityCode` / `districtCode` / GPS lat-lon and a **Google Maps link**
built from the coordinate pair. D-6's Customer card lists none of them, so `gpsText`, `mapsLink` and
their eight i18n keys are deleted rather than relocated. Only `9000000003` carries usable
coordinates (1/5). Recorded because that is a capability leaving the screen, not a formatting change:
if operators want "open in maps" back, it is a new row on the Customer card, not a regression.

### A money row can still be omitted — when the amount is not a number

D-5 says money rows never empty (`0.00` is an answer), and that is what ships: all five amounts are
numeric on 5/5 captures and render, `0.00` included. The one deviation is that a **non-numeric**
amount (the wire sending `null` for a field the model types `number`) formats blank and drops, rather
than rendering a `0.00` the server never sent. Fabricating a zero on a payment card is the worse
failure of the two.
