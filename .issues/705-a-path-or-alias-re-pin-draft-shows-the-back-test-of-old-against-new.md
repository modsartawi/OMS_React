---
status: open
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 704
---

# 705 — A path or alias re-pin draft shows the back-test of old against new

## What to build

Stories 22, 23; D8, D11; door 3294. When a registry row or alias changes, the screen lists each published ruleset still
on the old form and offers a **re-pin draft**. The draft shows the path or alias before and after, and a back-test of old
against new over the kept bundles: which decisions would change, and how. It is approved by a separate user, and until
then the published ruleset runs as pinned.

## Spine reach

model/api (affected rulesets, draft, back-test reply) · store/logic (change summary) · component (draft view, approvals)
· i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [ ] the old-against-new summary, including zero changes — pure
- [ ] a changed alias lists an affected ruleset; open the draft, read the back-test, approve it as another user — flow

## Boundaries

Patient keys stay masked on the back-test view. Labels-only drafts are 708, on the same list. Doors stubbed; 711
reconciles.

## Done when

A published rule changes what it reads only through a draft someone else approved after seeing the difference.

## Blocked by

704.

## Comments
