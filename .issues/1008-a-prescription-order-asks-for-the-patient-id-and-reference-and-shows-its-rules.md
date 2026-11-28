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

- [ ] vitest: blocker and reason texts (en and ar); the ID input's filtering.
- [ ] Console tests from stubbed states: a missing reference blocks submit with the rail naming it; a forced
  payment chip can't be changed.
- [ ] typecheck, vitest, lint.
