---
type: wayfinder-ticket
wayfinder: grilling
map: 068
status: done
blocked-by: 079
---

# 081 — The rail cards' field rules against live data

## Question

[073](073-detail-layout-with-our-data.md) drew five rail cards and gave them one emptiness rule
(*money and booleans always render; blank text rows are omitted*) against a **synthetic** payload.
[078](078-live-document-payload-capture.md) then captured five real documents and showed several of
those rows are thinner, contradictory, or differently-shaped than drawn.

[079](079-status-severity-mapping.md) took the one card row that was really a mapping question — the
Payment card's instrument row, now read from the header condition's `cardType`/`paymentMethod`. What
is left is a set of **small field-level rules**, each individually trivial and none of them a mapping.
This ticket settles them together so the spec does not carry five loose ends.

Settle:

- **The e-Rx card is two rows on live data.** On `2000000551`, the one real prescription,
  `clinicianName`, `clinicianContact`, `diagnosis`, `payerCode`, `referenceErx` and `prescriptionUrl`
  are **all empty strings**. Only `approvalNumber`, `patientId` and `approvalId` carry values — and
  `approvalId` (`103778401`) is **not on 073's card**. Does the card gain `approvalId`, drop the rows
  that are never populated, or keep them against a future document that fills them? Note its collapse
  rule is keyed on five fields, three of which are always blank.
- **`timeSlotDescription` contradicts the schedule pair.** `8000000174` reads slot `"8am - 12 am"` with
  `deliveryScheduleFromTime`/`ToTime` of `20:00`–`22:00`; `8000000121` reads slot `"8pm - 10 pm"` with
  a schedule where **From equals To** (`23:56:36.389` both). 073's Fulfilment card renders both rows
  adjacently, so on real documents it shows a visible contradiction and a zero-length window. Prefer
  one source, or render the schedule only when the pair is non-zero and consistent with the slot?
- **`shippingAddress` can be `null`**, not merely blank (`2000000551`). 073's Customer card falls back
  `shortAddress` → `street1`/`street2` → `districtName`, all of which dereference the address, and the
  card **always renders**. Confirm the fallback survives a null parent and state what the card shows
  when it does (name / mobile / loyalty ID only — which is correct, and should be said rather than
  discovered).
- **The discount rule has the wrong sign test.** 073 marks a line amber when `discount > 0`.
  `2000000551` line 1 has `discount: -1.500` — a real promotion (`DSPF` "Promotion Discount FX").
  The rule must be `!== 0` and the sign must render. This is an items-table rule rather than a card
  rule, but it is the same class of correction and has no better home.

Evidence is the five payloads in [assets/078-document-payloads/](assets/078-document-payloads/);
078's `## Answer` findings 1–4 are the source of every bullet above.

Out of this ticket: the **line `vatAmount` vs condition disagreement** (078 finding 6). That is a data
correctness question about which number is right, not an arrangement question, and map 068 is
arrangement and colour only.

## Answer

Four rules, settled with the owner against the five payloads. Three of the four leave 073 standing;
the corrections are narrow. **Two of the four need no new code at all** — the repo already implements
them, which is the ticket's most useful finding.

### 0 · The emptiness test, stated once (precondition for all four)

073's row rule said "blank text rows are omitted" against a synthetic payload where every unset string
was `''`. Live data emits **both**: on `2000000551` the unset e-Rx fields are `''`; on the four non-Rx
documents the *same fields* are `null`. And every unset **date** is `0001-01-01T00:00:00`, not blank.

So the test the whole rail uses is:

| Kind | Empty when | Note |
|---|---|---|
| Text | `null`, `undefined`, or `''` after `.trim()` | Must cover `null` — the model types many of these as `string`, but the wire sends `null`. |
| Date | empty text **or** the .NET `DateTime.MinValue` sentinel (`year <= 1`) | **Already implemented**: `isBlankDate` in [`src/core/util/date-format.ts`](../src/core/util/date-format.ts) tests `Number.isNaN(t) \|\| getFullYear() <= 1`, and all three formatters return `''` for it. It is currently module-private — **export it** (or a thin `isUsableInstant`) rather than reinventing the sentinel test at the card. |
| Money / boolean | never — `0.00` and `No` are answers (073's rule, unchanged) | |

### 1 · The e-Rx card — 073 stands, unchanged

**Owner ruling: keep the card exactly as 073 drew it.** Five rows (`approvalNumber` · `patientId` ·
`clinicianName` · `referenceErx` · link `prescriptionUrl`), collapse when all five are blank.
**`approvalId` is not added** — it is a system identifier, not something an operator reads or quotes,
and the card is a summary rather than a field dump. It exists on the model
(`sd-document.ts:240`), so this is a deliberate omission, not a gap.

The collapse rule survives its own thinness. Keyed on five fields of which three are always blank, it
is *effectively* `approvalNumber || patientId` — and those two carry on the one real e-Rx document and
are `null` on all four others. So it renders a two-row card on `2000000551` and collapses on the rest,
which is exactly right. The three inert fields cost nothing (rule 0 omits them) and cost nothing in the
OR either. **No change; the spec simply records that the card is two rows on today's data** so nobody
reads the drawn five as a promise.

`clinicianContact`, `diagnosis` and `payerCode` — named in the question as candidates — are **not**
added. They were never on 073's card and are empty on the only document that could have carried them.

### 2 · The delivery window — two rows collapse into one, schedule wins

073's Fulfilment card rendered `timeSlotDay`+`timeSlotDescription` and
`deliveryScheduleFromTime`–`ToTime` as adjacent rows. On live data that is a visible contradiction
(`8000000174`: slot `"8am - 12 am"`, schedule `20:00`–`22:00`) and a zero-length window
(`8000000121`: From == To == `23:56:36.389`, a capture timestamp rather than a window). Neither source
is reliable alone: the pair is a usable window on **1 of 5**, the slot text is present on **2 of 5** and
malformed on one of those two.

**One row, "Delivery window", with a three-step resolution:**

1. `deliveryScheduleFromTime`–`ToTime` when **both are non-sentinel and From < To**. Strict `<`, so the
   equal-timestamp case falls through rather than rendering a zero-length window.
2. Otherwise `timeSlotDay` + `timeSlotDescription` when non-blank.
3. Otherwise **omit the row** (it is a text row; rule 0 applies).

Schedule wins because it is the only source that was ever a real window; slot text is retained as
fallback because it is the customer-facing promise and is the only thing present on `8000000121`.
Against the corpus: `8000000174` → `20:00 - 22:00`, `8000000121` → `Monday, 8pm - 10 pm`, the other
three → row omitted.

The malformed `"8am - 12 am"` text and the fact that it disagrees with its own schedule are **data
findings, not UI findings** — the resolution order means the rail never displays the disagreement, and
this map does not chase which of the two is correct (same reasoning that put 078's `vatAmount`
disagreement out of scope).

### 3 · Null `shippingAddress` — confirmed, and the compiler already enforces it

The fallback survives, and **not by luck**: `SdDocumentHeaderModel` already declares
`shippingAddress: SdDocumentAddressModel | null` (`sd-document.ts:215`), so every dereference in
073's chain (`cityName`, `shortAddress` → `street1`/`street2` → `districtName`) is already
optional-chained or `tsc` fails. The null case cannot be forgotten at build time.

**What the card shows when the address is absent, stated so it is not discovered:** name · mobile ·
loyalty ID, and nothing else. The card still **always renders** — 073's ruling stands.

**No missing-address marker.** The one null-address document (`2000000551`) is a **pickup**
(`deliveryType: 'P'`), where having no delivery address is correct, not a finding. A marker gated on
`deliveryType === 'D'` was considered and rejected: no live document exhibits that case, so it would be
a rule written against a hypothesis. Note `8000000253` (also `'P'`) carries an address *object* whose
every field is `''` — rule 0 makes that render identically to null, which is the desired outcome and
means the card needs one code path, not two.

Address coverage across the corpus, for the spec's expectations: `shortAddress` populated **1/5**,
`street1` **1/5**, `districtName` **2/5**, `cityName` **3/5**. The full fallback chain earns its
keep — each step is the only thing present on some document.

### 4 · The discount rule — sign test corrected, sign rendered

073's `discount > 0` never fires on real data: the only non-zero discount in the corpus is
`-1.500` on `2000000551` line 1 (a `DSPF` "Promotion Discount FX"), and the other four documents are
all `0`. **No positive discount exists anywhere in the corpus.**

- **Test:** `discount !== 0` (not `> 0`). Amber `--attention-800` via `cellClassRules`, as 073 had it.
- **Render:** the value **as the payload carries it, sign included** — `-1.500`. The minus is
  information (the amount reduces the line) and suppressing it would put the grid in disagreement with
  both the API and the Header Conditions tab sitting one tab away, where the same `DSPF` condition is
  visible with its sign.

This is the one items-table rule in the ticket; it changes `columns.ts` only, not a card.

### What this does not settle

Nothing new goes to the fog. Rule 0's `isBlankDate` export is a build detail for the spec, not a
decision. The `"8am - 12 am"` / schedule disagreement and the `IsDeliveryExpress` vs
`isExpressDelivery` binding (078's open note) are both data-correctness questions and stay out of
scope, with the `vatAmount` disagreement.
