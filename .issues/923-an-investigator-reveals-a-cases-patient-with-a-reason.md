---
status: open
spec: BackOffice 4050
blocked-by: BO 4053, 922
---

# 923 — An investigator reveals a case's patient with a reason

## What to build

- **"Show patient" on the case screen**, visible only with `INSURANCE_PATTERN_INVESTIGATOR`.
- **The dialog asks for a reason** (at least 10 characters, EN and AR copy saying the reveal is logged), then calls
  `POST …/{id}/Reveal`.
- **The patient key and member ID** show in the dialog only. They are held in component state, never cached by the
  query client, never written to the URL, local storage or logs, and cleared when the dialog closes.

## Spine reach

UI (case screen dialog).

## Proof (→ `tdd` red-green cycles)

- [ ] The button is hidden without the grant
- [ ] Submit is disabled under 10 characters
- [ ] The identity is shown after the call and gone after closing (no query-cache entry, nothing in storage)
- [ ] An error from the call shows the error and no identity
- [ ] Lint + build clean

## Done when

Proof is green, and there is a live walk with a seeded investigator: the reveal row is in `InsurancePatternReveal`.

## Blocked by

- BackOffice 4053
- 922

## Comments
