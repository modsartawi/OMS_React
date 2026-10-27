---
status: open
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607, 608, 609, 610, 611, 612, 613, 614, 615, 616, 617
---

# 618 — The insurance-rules screens call the live endpoints on staging

## What to build

Every screen calls the live SIS.Api doors on staging; any shape that drifted from the brief during the
BackOffice build is reconciled here (the brief records each change). The access probe reports the insurance
grants (author, approver, exception, release, `INS_GUARD`, registry) and hides what the user cannot do.

**HQ contract:** the brief's sections for BackOffice 3139, BackOffice 3140, BackOffice 3141, BackOffice 3142, BackOffice 3143, BackOffice 3144, BackOffice 3145, BackOffice 3146. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

api · test

## Proof (→ `tdd` red-green cycles)

- [ ] every drive re-run against staging

## Boundaries

Needs the BackOffice tickets live on staging. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Each drive passes against staging.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md), [608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md), [609](609-an-author-starts-a-guard-from-a-template-saves-any-rule-as-a-team-template-and-files-rules.md), [610](610-the-team-builds-item-lists-from-any-registry-field-adds-a-field-in-the-registry-and-keeps.md), [611](611-an-author-asks-for-approval-with-a-back-test-attached-only-an-approver-publishes-a-shadow.md), [612](612-an-author-simulates-a-draft-on-a-patient-and-reads-the-back-test-report.md), [613](613-the-insurance-team-uploads-an-sfda-or-chi-edition-reads-its-diff-and-gap-report-and-a-seco.md), [614](614-a-reviewer-marks-overrides-ok-or-questioned-and-an-insurance-team-user-issues-and-revokes.md), [615](615-the-insurance-team-reads-metrics-per-rule-store-and-pharmacist-sees-flagged-rules-and-rank.md), [616](616-an-oms-user-answers-the-guards-on-an-insured-order-and-releases-an-order-held-for-a-guard.md), [617](617-the-insurance-team-edits-insurer-settings-category-rules-and-coverage-rules-with-the-payer.md)
