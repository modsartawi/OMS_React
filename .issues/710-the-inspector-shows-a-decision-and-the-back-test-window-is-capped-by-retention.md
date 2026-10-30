---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 710 — The inspector shows a decision, and the back-test window is capped by retention

## What to build

Story 68; R1, R4–R6, R10; door 3298. An inspector opens any decision of any age and sees its rule and version, each
fact's key, path and typed value (or unknown / unparsed), and the replay result. **Show message** tries the kept copy,
then a re-fetch from the Nphies service, and says which: matches the hash, differs from it, or not found. In the last
case the typed values still stand and the page says so.

The back-test never offers a window longer than the door's limit (the shortest retention setting it reads, minus 30
days). The brief has no row for this cap, so it rides here.

## Spine reach

model/api (decision view, message reply, window limit) · store/logic (hash outcome reading, window cap) ·
component (inspector, back-test window) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] each hash outcome and fact state reads in words — pure
- [ ] the window offered is capped by the door's limit — pure
- [ ] an old decision with no kept copy still explains itself; each of match, differs and not found shows — flow

## Boundaries

A re-fetched message is shown and never stored: no browser storage, no query cache kept past the view. Behind the
decision-log read grant; the door logs it. Synthetic bundles only in stubs and screenshots. Doors stubbed; 711 reconciles.

## Done when

Every decision can be explained without its kept copy, and the back-test cannot ask for data already purged.

## Blocked by

None (can start immediately).

## Open questions

- Where the inspector is entered from. Default: from the Review list's decision rows and the rule's metrics. Settle it
  against what 3298 builds.

## Comments
