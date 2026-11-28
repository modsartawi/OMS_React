---
status: open
spec: 1006
blocked-by: 1007, BackOffice 4486, BackOffice 4487
---

# 1008: A prescription order asks for the patient ID and reference, and shows its rules

Client half of spec 1006, decisions **D4**, **D6**, **D8** and **D9**.

## What to build

- **The prescription section**, shown on Wasfaty and Nphies only:
  - two fields, *Patient ID* and *Reference* (Wasfaty: *eRx number*; Nphies: *Approval / PreAuthRef*);
  - committed with `setPrescription` on blur or Enter;
  - the ID field takes digits only, max 10;
  - a refusal (`PATIENT_ID_INVALID`, `REFERENCE_REQUIRED`) shows under its field;
  - once both are set, the section settles into a chip like the other header steps.
- **The step rail** names the `prescription` blocker (*"Patient ID and reference needed"*), and the
  read-back sentence (ticket 988) includes the type and the reference.
- **Payment:** the chip shows *Cash on delivery* locked, with the forced reason (*Prescription orders are
  paid on delivery*). The `paymentTypeForcedReason` path drawn by ticket 155 becomes reachable.
- **Fee and store:** nothing new to draw. Check that the receipt shows no fee, and that an Nphies delivery
  shows the insurance store with its stock, after the store change (ticket 994).
  `NO_INSURANCE_STORE_FOR_DISTRICT` reads like the district-without-store refusal.
- The fields stay filled in when the agent switches back to a phone order. They are hidden, and shown again
  on the next switch.

## Proof

- [x] vitest: blocker and reason texts (en and ar); the ID input's filtering.
- [x] Console tests from stubbed states: a missing reference blocks submit with the rail naming it; a forced
  payment chip can't be changed.
- [x] typecheck, vitest, lint.

## Comments

**2026-11-28, built against the proposed v1.15 with stubs (BackOffice 4486 and 4487 open).** Pure
module `src/features/callcenter/console/prescription.ts` (+ `prescription.test.ts`, en and ar): the ID
filter (digits only, Arabic-Indic digits read as digits, ten at most), the blur/Enter commit rule, the
refusal-to-field table, the per-type reference label and the payment lock. The section is
`PrescriptionForm.tsx` (core/ui `Field`/`Input`/`Button`, no ratchet cost); it settles into a
*Prescription* field at the head of the ledger. The blocker is in `submit-blockers.ts` `BLOCKERS` and
`step-rail.ts` `ROWS`; the read-back opens with a `type` clause. Drive
`tools/callcenter-prescription-drive.mjs`: 56/56 (1007's, the rail's and 176's drives still green).

**Contract guesses to reconcile when BO 4486 / 4487 ship:**
1. **Verb.** `POST CallCenterWeb/SetPrescription { transactionId, requestId, patientId, reference }` →
   the whole `SessionState`. Refusals `PATIENT_ID_INVALID` and `REFERENCE_REQUIRED` as `errorCode`s.
2. **State.** `header.prescription: { patientId: string | null, reference: string | null } | null`, kept on
   every type (D10). Settled means both non-empty.
3. **Blocker spelling.** Both `prescription` (the spec's spelling) and `MISSING_PRESCRIPTION` (the
   UPPER_SNAKE every other code uses) map to one phrase, *enter the patient ID and reference*, owned by
   the prescription field. Drop the loser once 4486 pins it.
4. **A half pair.** A blur sends only when both boxes are filled (so tabbing to an empty reference earns no
   refusal); Enter sends whatever is there and the server answers. Assumes the server refuses a partial
   pair; if it accepts one, a blur could send each field as it is typed.
5. **No fee.** Either shape draws: `deliveryFee.amount: 0` shows *0.00*, `waived: true` with a
   `waivedReason` shows as waived (an unknown reason degrades, as before). Nothing new is drawn.
6. **Forced reason.** The lock is read off both paths: `header.paymentTypeForcedReason` first, then
   `capabilityReasons.canChangePaymentType`, and either one shuts the payment word (also the palette row).
   The reason `orderType` reads *Prescription orders are paid on delivery*. On a Wasfaty / Nphies order the
   generic `PAYMENT_TYPE_FORCED` (or no reason) reads the same, never the *must be paid online* copy.
   ⚠ The palette's disabled-row reason still reads `capabilityReasons` only.
7. **`NO_INSURANCE_STORE_FOR_DISTRICT`** is worded in the address book's refusal table
   (`address.refusedNoInsuranceStore`) and on the order-type picker, since a switch to Nphies with an
   address set can raise it. ⚠ The district greying still knows only the regular store, so such a
   district looks pickable; the server's refusal is the guard.

Rail: on Wasfaty / Nphies an empty basket leaves the Items step green (D2) unless the server lists
`NO_LINES`. The prescription row sits under Review. A switch to a prescription type opens the section
until both fields are held; an uncommitted draft survives a switch away and back (the form stays mounted).
Not driven here: the Nphies insurance store after the 994 store change (nothing new to draw; the walk, 1010).
