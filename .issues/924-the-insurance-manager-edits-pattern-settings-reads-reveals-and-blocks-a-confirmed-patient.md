---
status: open
spec: BackOffice 4050
blocked-by: BO 4055, BO 4056, 922
---

# 924 — The insurance manager edits pattern settings, reads reveals, and blocks a confirmed patient

## What to build

- **`/insurance/patterns/settings`** (manager):
  - the seven thresholds with their ranges, validated client-side as the server does;
  - "applies from the next run" copy;
  - the change log below.
- **`/insurance/patterns/reveals`** (manager): who revealed which case, when, and why, with filters. It links to the
  case. It shows no identity.
- **"Add to blocked-patient list"** on a confirmed case:
  - visible only with both the investigator grant and `INSURANCE_PATIENT_BLOCK` Change;
  - asks for `ReasonKind` (abuse or fraud), an optional payer, start and end;
  - calls `POST …/{id}/Block`.

## Spine reach

UI (two pages + one case-screen action).

## Proof (→ `tdd` red-green cycles)

- [ ] An out-of-range setting is refused before the call
- [ ] The reveal log renders with no identity column
- [ ] The block action is hidden unless the case is confirmed and both grants are held, and `ReasonKind` is required
- [ ] Lint + build clean

## Done when

Proof is green, and there is a live walk on BO 4055 and 4056.

## Blocked by

- BackOffice 4055
- BackOffice 4056
- 922

## Comments
