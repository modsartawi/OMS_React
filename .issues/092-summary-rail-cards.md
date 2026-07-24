---
status: open
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

- [ ] `addressFallback` — the chain resolves on each corpus document including the `null` parent on
      `2000000551` and the all-blank address object on `8000000253`, both landing on name · mobile ·
      loyalty ID with no marker · pure (vitest)
- [ ] `deliveryWindow` — all five payloads: schedule on `8000000174`, slot on `8000000121`, omitted on
      the other three; the equal-timestamp window never renders · pure (vitest)
- [ ] `paymentInstrument` — the scan finds `ApplePay · Visa` **without keying on `DFEE`**, falls back
      to raw `paymentType`, and omits when both are blank · pure (vitest)
- [ ] `cardCollapse` — e-Rx renders only on `2000000551`; Driver & tracking collapses on every
      pick-in-store document; money and boolean rows render at `0.00` / `No` while blank text rows
      are omitted · pure (vitest)

Verify the layout and the 900px unstack by driving `npm run dev` across all five documents in both
themes, plus `npm run typecheck` (which is the null-address test).

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
