---
status: open
spec: BackOffice 4050
blocked-by: BO 4053
---

# 922 — The insurance team lists pattern cases and opens one with its route on a map

## What to build

Spec: `C:\Work\DMSCO\BackOffice\.issues\4050-the-insurance-team-sees-patients-who-dispense-across-pharmacies-on-a-map-and-opens-each-case-spec.md`.

- **`/insurance/patterns`:**
  - a case list from `GET Insurance/Patterns/Cases`;
  - filters: store, period, signal, status, severity;
  - columns: case number, stores, dispenses, span, longest leg km, shortest gap, signals, score, status, value;
  - paged, ordered by score.
- **`/insurance/patterns/:caseId`:**
  - **Route map:** the stores on the Google map (ADR 0139, the map chart's loader), joined in time order. Each leg is
    labelled with km and time, and a leg that fired the travel signal is drawn in the warning colour. Delivery
    dispenses show as points without a leg.
  - **Signals:** each signal with its EN and AR words.
  - **Timeline table:** store, time, item, quantity, days' supply, payer, channel, pharmacist.
  - **Marks:** set watching, cleared, confirmed or closed, with a note. A previous clearance of the same patient is
    shown at the top.
  - **Previous cases:** linked.
- **Nav entry** shown only with `INSURANCE_PATTERN_ANALYST`. EN and AR, RTL.

## Spine reach

UI (new `features/insurance-patterns`), API client.

## Proof (→ `tdd` red-green cycles)

- [ ] The list renders the filters and paging against a mocked envelope
- [ ] The route draws legs in time order, a travel leg in the warning colour, and delivery as a point without a leg
- [ ] A mark round-trips, and the previous clearance banner shows
- [ ] Without the grant there is no nav entry and the route shows "no access"
- [ ] Arabic layout (RTL) snapshot
- [ ] Lint + build clean

## Boundaries

- **No reveal here.** That is 923.
- **No patient field exists in the models at all.**

## Done when

Proof is green against mocks, and there is a live walk on BO 4053's local endpoints with seeded cases.

## Blocked by

- BackOffice 4053

## Comments
