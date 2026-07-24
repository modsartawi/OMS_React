---
type: wayfinder-ticket
wayfinder: task
map: 068
status: done
blocked-by: —
---

# 078 — Capture live document payloads

## Question

Nothing to decide — but five decisions are blocked until this is done.

073 built the reworked layout against a **synthetic** payload: SIS.Api on `:5111` was unreachable that
session, so every coded value on the screen is invented. Five separate unknowns all collapse into one
missing artifact — **a handful of real `SdDocumentHeaderModel` responses**:

1. **The coded value sets behind the six promoted statuses** — `readyStatus`, `availabilityStatus`,
   `approvalStatus`, `paymentStatus`, `deliveryStatus`, `closeStatus`. Needed by 079 to map value →
   severity. Their `*Description` companions come back too, which is the label half.
2. **`paymentType`** — coded, no `*Description` companion, value set unknown. Renders raw until this
   lands.
3. **`courierCode`** — same.
4. **`status.overallStatus`** — same; 073 renders it as a monospace code precisely because nobody knows
   the set.
5. **What separates an Rx line from an OTC line** on `SdDocumentLineModel` — 073 built the tag renderer
   but gated it. Candidates are `referenceErxLine` being non-empty or a value of coded `itemCategory`.
   One live e-Rx document settles it.

## What to capture

Enough documents to see variety, not a census. At minimum:

- **`Document/1000000393`** — the order `sd-document.ts` already documents (`documentCategory 'O'`,
  `deliveryType 'P'`, `documentType 'CLCN'`).
- **`Delivery/9000000003`** — the delivery whose `documentCategory` is `T`, the live proof that
  `openedAs` and `documentCategory` diverge (D-17/D-19).
- **One e-Rx document** — non-empty `approvalNumber` / `referenceErx`, with at least one prescription
  line and one OTC line. This is the one that answers unknown 5.
- **One express delivery** (`isExpressDelivery: true`) with a driver assigned — exercises the Driver &
  tracking card and gives `courierCode` a real value.
- **One cancelled or cancellation-requested document** — the only way to see `closeStatus`'s non-empty
  codes, and the reason 072 minted the `bad` severity.

Save the raw envelopes as `assets/078-document-payloads/*.json` (pretty-printed, one file per
document). **Redact before committing**: `customer.nationalIdNumber`, `customer.dateOfBirth`,
`customer.email`, `courierDriverMasterPinCode`, and the `zatcaQR` blob. Names, phones and addresses are
already all over the existing test fixtures — but replace them anyway if the capture is from
production rather than a test store.

The answer records: where the files landed, which of the five unknowns each one resolved, and — for
anything still unresolved — what document shape would resolve it.

## Blocked on

**SIS.Api must be running on `:5111`** (and the session authenticated). That makes this **HITL**: the
agent cannot start the backend. If the owner brings the API up, the capture itself is a handful of
`api.get` calls and is fully AFK from there.

## Progress — 2026-07-24, two of five captured

SIS.Api came up. Two payloads filed under
[assets/078-document-payloads/](assets/078-document-payloads/):

- [`8000000253-delivery.json`](assets/078-document-payloads/8000000253-delivery.json) — delivered
  ecommerce delivery, `documentCategory 'D'`, OTC single line, no e-Rx, no driver.
- [`9000000003-delivery-return.json`](assets/078-document-payloads/9000000003-delivery-return.json) —
  the D-17/D-19 delivery return, `documentCategory 'T'`, real Arabic street address, usable GPS,
  `trackingId` without `trackingUrl`.

Still wanted: an **e-Rx document**, an **express delivery with a driver assigned**, and a
**cancelled / cancellation-requested document**. Until those land, unknowns 2–5 stay open.

### The finding that outranks the ticket

**The six promoted statuses are mostly empty on live data.**

| Status | `8000000253` (delivered) | `9000000003` (return) |
|---|---|---|
| `readyStatus` | `R` → "Ready" | `""` |
| `availabilityStatus` | `null` | `null` |
| `approvalStatus` | `""` | `""` |
| `paymentStatus` | `""` | `""` |
| `deliveryStatus` | `D` → "Delivered" | `""` |
| `closeStatus` | `""` | `""` |

073 chose those six against a **synthetic** payload in which all six were populated. On the first two
real documents the rail renders **two pills** and then **none at all** — a delivered order shows no
payment status, and a delivery return shows nothing whatsoever, including `overallStatus`, which is
`""`. This is not a data gap to wait out; it is the rail's premise.

Two related observations from the same payloads:

1. **A `*Description` companion can exist and still echo the code.** `lastActionDescription: "TRDY"`
   and `documentTypeDescription: "ORRT"` both come back as the raw code. 073 used "has a companion" as
   the test for promoting a status to a pill; that test is weaker than it looked — the companion may be
   present and unresolved.
2. **`lastAction` is the one status populated on both documents** (`DDLR` → "Delivered", `TRDY` →
   "TRDY"). 073 demoted it as "history, not lifecycle". On this evidence it is the most reliable single
   signal the payload carries. `statusHistory` is not a substitute — it came back `["T","T","R","D"]`
   on one and `[null, null]` on the other.

Handed to **079**, which now owns the rail's *composition* as well as its severity mapping.

### Model drift — three fields the API returns that `sd-document.ts` does not declare

- `SdDocumentHeaderModel.isBondedZone: boolean`
- `SdDocumentLineModel.promotionCouponDiscount: number`, `.promotionCouponCode: string`
- `TransactionConditionModel.promotionCouponCode: string`

Extra fields are ignored at runtime, so nothing is broken — but the model is behind the contract and
anything reading coupon discounts would have to widen it first. Not this map's business (068 is
arrangement and colour); recorded so the build ticket does not rediscover it.

### Confirmed non-problems

- **`0001-01-01` sentinel dates** are everywhere (`deliveryDateTime`, `validTo`, the schedule pair,
  `estimateDeliveryTime`, `dispensedDate`, `nextRefillDate`). `date-format.ts`'s `isBlankDate` already
  treats `getFullYear() <= 1` as blank, so 073's Fulfilment card renders nothing rather than
  "January 1, 1". No change needed.
- **`null` vs `""`** — the API mixes both freely for the same field across documents
  (`consignmentStatus` is `"D"`, then `null`). `fields.ts`'s `text()` already collapses them, and
  073's emptiness rules must be read as "null or blank", which they are.
- **`gpsLat/Lon` of exactly `0`** on `8000000253` — `mapsLink` already returns `null` for that pair, so
  no "open in maps" row pointing at the Gulf of Guinea.

### Codes observed so far

`documentCategory` `D` · `T` — `deliveryType` `P` · `D` — `paymentType` `C` (both) —
`courierCode` `FREY` (both) — `overallStatus` `C` · `""` — `readyStatus` `R` —
`deliveryStatus` `D` — `consignmentStatus` `D` · `null` — `lastAction` `DDLR` · `TRDY` —
`documentType` `CMRC` · `ORRT` — `deliveryDocumentType` `DL` · `DLR` — `condType` `UPRC` · `VATF`.

Nowhere near a value set for `paymentType` or `courierCode` — one observed value each is not a map.

## Answer

Five payloads captured 2026-07-24 and filed under
[assets/078-document-payloads/](assets/078-document-payloads/). Owner supplied them directly (SIS.Api
auth is an HttpOnly `sis_session` cookie the agent cannot mint).

| File | Shape | What it uniquely proves |
|---|---|---|
| [`8000000253-delivery.json`](assets/078-document-payloads/8000000253-delivery.json) | delivered ecommerce delivery, cat `D` | the only `deliveryStatus` value seen (`D` → "Delivered") |
| [`9000000003-delivery-return.json`](assets/078-document-payloads/9000000003-delivery-return.json) | delivery return, cat `T` (D-17/D-19) | real Arabic street + usable GPS; **all six pill statuses empty** |
| [`8000000174-cancellation-requested.json`](assets/078-document-payloads/8000000174-cancellation-requested.json) | cancellation outstanding, cat `D` | the only `closeStatus` value (`R` → "Close Requested"); the only **header-level** conditions |
| [`2000000551-erx.json`](assets/078-document-payloads/2000000551-erx.json) | e-Rx, cat `X` | the only `approvalStatus` (`A`), `controlStatus` (`S`), non-null `itemCategory`, negative discount, `null` shippingAddress |
| [`8000000121-driver-assigned.json`](assets/078-document-payloads/8000000121-driver-assigned.json) | driver assigned, cat `D` | the only populated `courierDriver*` + `trackingUrl` — and the only non-empty `courierDriverMasterPinCode` |

Redacted before filing: `courierDriverMasterPinCode` (`8000000121`) and `customer.nationalIdNumber`
(`2000000551`, `8000000121`). Both files say so in their `_capture` block.

**No express document exists to capture** — `isExpressDelivery` is `false` on all five. The owner notes
the source flag is named **`IsDeliveryExpress`**, which is *not* `isExpressDelivery`. Whether our field
binds it at all is unverified, so **the Dawaa Now tag is unproven on live data**. Recorded as a build-time
check rather than a fresh ticket: it is one grep against the API contract, not a decision.

---

### Unknown 1 — the coded status values. Answered, and the answer kills the rail as specified.

| Status | `8000000253` | `9000000003` | `8000000174` | `2000000551` | `8000000121` | populated |
|---|---|---|---|---|---|---|
| `readyStatus` | `R` Ready | `""` | `R` Ready | `R` Ready | `""` | **3/5** |
| `availabilityStatus` | `null` | `null` | `null` | `null` | `null` | **0/5** |
| `approvalStatus` | `""` | `""` | `""` | `A` Approved | `""` | **1/5** |
| `paymentStatus` | `""` | `""` | `""` | `""` | `""` | **0/5** |
| `deliveryStatus` | `D` Delivered | `""` | `""` | `""` | `""` | **1/5** |
| `closeStatus` | `""` | `""` | `R` Close Requested | `""` | `""` | **1/5** |
| — | | | | | | |
| `lastAction` | `DDLR` Delivered | `TRDY` *(raw)* | `DRCL` Close Requested | `XRDY` Prescription Ready | `DRSC` Rescheduled | **5/5** |
| `overallStatus` | `C` | `""` | `""` | `C` | `""` | 2/5 |
| `consignmentStatus` | `D` | `null` | `C` | `R` | `S` | **4/5** *(no companion)* |
| `controlStatus` | `""` | `""` | `""` | `S` | `""` | 1/5 |

073 promoted six statuses on the strength of each having a `*Description` companion. On five real
documents that rail renders **2, 0, 2, 2 and 0 pills**. Two of the six — `availabilityStatus` and
`paymentStatus` — **are never populated at all**; the availability pill was justified as "the single
most common cause of the unhappy path this screen exists for", and the field behind it is `null` on
every document in the estate.

Meanwhile the two fields 073 explicitly demoted are the two that actually carry the state:

- **`lastAction` is populated 5/5** and resolves 4/5 (`TRDY` echoes its code). It is the only field that
  answers "what happened to this document" on every capture.
- **`consignmentStatus` is populated 4/5** — but has no companion, which is exactly why 073 disqualified
  it. Its values (`D` · `C` · `R` · `S`) look like a real lifecycle, not noise.

**This does not reopen 073.** The layout, the five cards, the four tabs, the note ruling, the token name
and the chrome placement all stand — none of them depended on which statuses are populated. What falls
is the rail's *contents*, which is 079's, now widened to own composition as well as severity.

### Unknown 5 — Rx / OTC. Answered: **there is no source. Drop the tag.**

The e-Rx document `2000000551` is the test case, and it fails both candidates:

- `referenceErxLine` is `""` on its line — **empty on the one document that is a prescription**. It is
  not the discriminator.
- `itemCategory` is `"STND"` there and `null` on all seven lines of the other four documents. One
  observed value, and that value is "standard".

073 built the renderer and gated it on this capture. The gate does not open. **The Rx/OTC tag is
removed from the items table** — not deferred, removed — until some field is identified that actually
carries it. The description column renders plain, exactly as 073's fallback said it would.

### Unknowns 2–4 — `paymentType`, `courierCode`, `overallStatus`. Not answerable; and one is now moot.

- **`paymentType`** is `"C"` on all five. One observed value is not a value set, so no map. **But the
  capture found a better source:** `8000000174` and `8000000121` carry a **header-level condition**
  (`condDocumentLine: 0`) with `cardType: "Visa"`, `paymentMethod: "ApplePay"`,
  `referenceNumber: "ref_892347873643"`. That is the real payment instrument, resolved server-side,
  with no code map needed. 073's Payment card should read its "Payment type" row from the header
  condition and fall back to raw `paymentType` — **handed to 079** alongside the rail.
- **`courierCode`** — `FREY` (×3) and `DAWA` (×2). Two values, no descriptions. Still renders raw.
- **`overallStatus`** — `C` (×2) and `""` (×3). Populated on fewer documents than `lastAction`.
  073's monospace lozenge stands, and it is empty more often than not.

---

### Findings the ticket did not ask for

1. **Negative discounts are real.** `2000000551` line 1 has `discount: -1.500` (a promotion, condType
   `DSPF` "Promotion Discount FX"). 073's rule was *amber when `discount > 0`* — which silently skips
   every promotional discount in the estate. The rule must be `!== 0`, and the sign must render.
2. **The time-slot fields contradict the schedule fields.** `8000000174`: `timeSlotDescription`
   `"8am - 12 am"` but `deliveryScheduleFromTime`/`ToTime` `20:00`–`22:00`. `8000000121`: slot
   `"8pm - 10 pm"`, schedule `23:56:36.389`–`23:56:36.389` — **From equals To**. 073's Fulfilment card
   renders both rows adjacently and would show a visible contradiction and a zero-length window. Needs
   a rule: prefer one, or render the schedule only when the two are consistent and the span is non-zero.
3. **`shippingAddress` can be `null`** (`2000000551`), not merely blank. 073's Customer card falls back
   through `shortAddress` → `street1`/`street2` → `districtName`; all of those dereference the address.
   The fallback chain must survive a null parent, and the card's "always renders" rule then leaves it
   showing name / mobile / loyalty ID only — which is correct, and worth stating.
4. **The e-Rx card is thinner than 073 drew it.** On the one real e-Rx document, `clinicianName`,
   `clinicianContact`, `diagnosis`, `payerCode`, `referenceErx` and `prescriptionUrl` are **all empty
   strings**. Only `approvalNumber`, `patientId` and `approvalId` carry values. 073's card has five
   rows plus a link; on live data it has two rows and no link. `approvalId` (`103778401`) is populated
   and is *not* on the card — it should be.
5. **`vatPercent` is unreliable.** `0.00` on every line of every document, including lines with a
   non-zero `vatAmount`. Only the `MWST` condition carries the real 15%. Nothing on 073's screen reads
   `vatPercent`, so this is a note, not a change.
6. **Line `vatAmount` disagrees with the conditions.** `8000000121` line 1 says `vatAmount: 23.760`
   while its `VATF` condition says `11.880`, and `netAmount 102.980 = 79.220 + 23.760`. Whichever is
   right, 073's pinned totals row sums the **line** values, so the footer will agree with the grid and
   disagree with the conditions tab. Out of scope for 068 (arrangement and colour) — flagged for the
   build.
7. **`statusHistory` is unusable.** `["T","T","R","D"]` · `[null,null]` · `["T","T","R","R","R","C","C"]`
   · `[]` · `["T","T","S"]`. Repeated values, nulls, empty. Not a progress narrative.
8. **Model drift, confirmed on all five.** `isBondedZone` (header), `promotionCouponDiscount` /
   `promotionCouponCode` (line), `promotionCouponCode` (condition) are returned and not declared in
   `sd-document.ts`. Harmless at runtime; the model is behind the contract.
9. **`documentCategory: 'X'` is real** (`2000000551`) — and `actions.ts` already handles it as
   `ERX_CATEGORY`. No gap. All four categories seen: `D` · `T` · `X`, plus `O` from the model comments.

### Confirmed non-problems

- **`0001-01-01` sentinels** — everywhere; `date-format.ts`'s `isBlankDate` (`getFullYear() <= 1`)
  already blanks them.
- **`null` vs `""`** — the API mixes both for the same field across documents (`consignmentStatus` is
  `"D"`, then `null`). `fields.ts`'s `text()` already collapses them; 073's emptiness rules read as
  "null or blank", which is what they say.
- **`gpsLat/Lon` of exactly `0`** (4/5 documents) — `mapsLink` already returns `null` for that pair.
- **`courierDriverMasterPinCode` is genuinely populated** (`"1234"`) on the driver document. 073's
  never-render ruling was not theoretical.

### Codes observed

`documentCategory` `D`·`T`·`X` — `deliveryType` `P`·`D` — `paymentType` `C` — `courierCode`
`FREY`·`DAWA` — `documentType` `CMRC`·`ORRT`·`CASH`·`NUPP` — `deliveryDocumentType` `DL`·`DLR`·`null` —
`documentSource` `CCHT`·`CLCN`·`HYBS`·`BKOF` — `lastAction` `DDLR`·`TRDY`·`DRCL`·`XRDY`·`DRSC` —
`overallStatus` `C` — `readyStatus` `R` — `deliveryStatus` `D` — `closeStatus` `R` — `approvalStatus`
`A` — `consignmentStatus` `D`·`C`·`R`·`S` — `controlStatus` `S` — `lastMileControl` `D` — `condType`
`UPRC`·`VATF`·`DFEE`·`PTPA`·`DSPF`·`VKP0`·`MWST`·`VAT1` — `condCategory` `F`·`P` — `originOfCond`
`M`·`H`·`A` — `calculationType` `Q`·`F`·`P`.
