---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 614 — A reviewer marks overrides OK or Questioned, and an insurance-team user issues and revokes an HQ guard exception

## What to build

**Review**: overrides, exceptions used and UNCHECKED requests, filtered by pharmacist, store, rule and reason;
mark each OK or Questioned with a note. **Exceptions**: issue one (patient key, one rule or all guards, item / same
kind / list, valid until ≤ 90 days in local days, reason, note), list, revoke, and read its log of uses.

**HQ contract:** the brief's sections for BackOffice 3134, BackOffice 3135, BackOffice 3141. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · logic (validity window) · test

## Proof (→ `tdd` red-green cycles)

- [ ] `exceptionValidUntil_capsAt90LocalDays` — pure
- [ ] drive (stubbed)

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)
