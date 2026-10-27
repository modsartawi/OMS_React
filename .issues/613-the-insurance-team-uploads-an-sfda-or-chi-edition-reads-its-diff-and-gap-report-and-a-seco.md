---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 613 — The insurance team uploads an SFDA or CHI edition, reads its diff and gap report, and a second user publishes it

## What to build

**Editions**: upload the SFDA list or CHI formulary, read the diff against the live edition and the rules
affected with back-test counts; a different user publishes; the gap report lists no-match / junk / GTIN mismatch /
withdrawn and exports for the master-file team; old editions read-only.

**HQ contract:** the brief's sections for BackOffice 3138. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components · test

## Proof (→ `tdd` red-green cycles)

- [ ] drive (stubbed) — upload → diff → uploader cannot publish → approver publishes

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)
