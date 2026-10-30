---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: —
---

# 702 — The review list shows monitor and not-evaluated items

## What to build

Stories 39, 46; A2, A13; door 3290. The existing review list gains two item kinds. A **monitor** item shows its rule, its
severity (info / action), its EN or AR text and the message's (source, id). A **not-evaluated** item names the answer
that a watcher or monitor failure left unread. Both can be filtered by kind and cleared with a note. Existing kinds and
their marks behave as before.

This is the first of the new kinds: 703 and 708 add theirs on the same shape, so an unknown kind must render, not throw.

## Spine reach

model/api (`reviewIn` for the new kinds) · store/logic (filter, clear) · component (rows) · i18n (en + ar) ·
test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the wire row reads into each kind, and an unknown kind reads as a generic row — pure
- [ ] filter to monitor items, open one, clear it with a note; a not-evaluated item reads as a failure, not a fire; the
      existing review drive stays green — flow

## Boundaries

No e-mail or push: the list is the inbox. Item text is `<bdi>`, and (source, id) is `Ltr`. Doors stubbed; 711 reconciles.

## Done when

The team reads payer outcomes and failed evaluations in one list and can clear them.

## Blocked by

None (can start immediately).

## Open questions

- The brief says "with clearing notes", while door 3293 only states a note on drift. Assume every new kind clears with a
  note and list it for 711.

## Comments
