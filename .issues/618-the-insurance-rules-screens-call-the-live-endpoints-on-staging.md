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

## Comments

### 2026-10-29 — reconcile against the BackOffice code (branch `impl/3126-618-reconcile`)

Every door of 607-617 compared with `Services/SIS.Api/Endpoints/Insurance/**` and the InsuranceRules services; the
frontend adapted in the api layer (the components keep their model), the stubs and the eleven drives moved to the
built shapes (all green on the stubs). An unauthenticated probe of local SIS.Api :5111 answers 401 for every door the
screens call (route exists) and 404 for the guessed `Guards/Approval` (removed) and for any `…/Access` probe.

Reconciled:
- **Guard document (607/608/609/610/611/612)**: `GET/PUT …/Draft` answer the DRAFT `{ revision, state, origin,
  requestedBy/At, requestNote, reviewedBy, reviewNote, document, warnings }`; one cache entry, `guardDraftQuery`
  selects the document. The document is SIS.Rules' spelling, read/written by the new `core/insurance-rules/guard-wire`
  codec: no rule `filters` (aliases resolved to list ids), a `fact` block is `{ check: patient|request|eligibility|line,
  field, … }`, formula text ↔ `expr` array, line `below` ↔ `under`, an audience holds only the keys it sets (none =
  every channel / store). Stale code `GUARDS_DRAFT_STALE`. A `pending` draft opens the editor read-only with a notice.
  Sentence: no channel reads "on every channel" (the "on on no channel" bug).
- **607 Guards/Folders**: `{ folders: [{ path, rules }] }`; move is `{ ruleId, folder }`.
- **609 Templates**: `origin`, blanks as path strings, `updatedBy/At`; Create `{ revision, ruleId, folder, values }`
  answers the draft; save-as names an `id` (`team-<rule id>`); blank candidates use the wire paths (no `filters[…]`);
  a `match: list:<id>` blank is a list picker.
- **610 Lists/Fields**: Preview `{ count, unknown, items: [{ item, description }], warnings, errors }` (HQ's words shown);
  field types `text|number|date|flag`, scope `line`, HQ's key shape; item fields are not offered as facts (list filters only).
- **611 Approvals**: no Approval door — `approvalOf(draft)`; Submit/Approve send `revision`; versions `{ versionNo,
  publishedAt, publishedBy, requestedBy, action, note }`; restore answers the draft; built refusal codes.
- **612 Simulator**: trace `value` is the text `"true"|"false"|"unknown"`, `why` one English line.
- **613 Editions**: `state: pending|published` + `live` → pending/live/retired; `rows` object; gaps `{ id, counts, rows }`,
  `junkCode`, `description`/`detail` as HQ's words; upload answers the edition; `EDITIONS_SELF_PUBLISH` (403).
- **614 Review/Exceptions**: review rows `{ patient, item (codes), mark: {…} }`, kind `refused`; exceptions are listed
  per patient key (the page asks for it), `{ exceptionId, scope (three keys), active }`; revoke sends a required note
  (new dialog); log `{ action, note, … }`.
- **615 Metrics**: `daily=false` per key, the day view sums the per-day rule rows; outcomes `acknowledged | overridden |
  exception | unanswered`; rule names from the draft; flags without name; thresholds = HQ's seven integers.
- **616 Order guards**: the detail's `guards.state` (no detail `guardState`); Reasons `{ rules, capped }` → accepts/caps
  per check; Recheck/Release answer the guard row; a released order reads `unchecked`.
- **617 Coverage**: documents ride the same codec; fact pickers offer line facts, not item fields.

Left (BackOffice gaps / odd shapes, for the coordinator):
1. No insurance-rules grant probe (`…/Access` is 404): 611 offers author and approver actions to everyone and HQ refuses.
2. `Guards/Reasons` and `Guards/{checkId}/Answer` are api-key only (`GuardEndpoints.cs` 31-39, no `AllowCookieSession`):
   616's dialog (and 614's reason list) get a bare 403 in a browser.
3. The answer has no "apply the suggestion" (`change`) form; 616's Apply sends one HQ does not read.
4. `GET InsuranceRules/Exceptions` requires `patientKey` (`InsuranceGuardExceptionService.ListAsync`): no HQ-wide list.
   The list carries no use count (log only).
5. The registry seeds none of the engine's patient / request / line fields (age, gender, payer, daysSupply, …): the
   palettes built from `Fields` cannot offer them. Item fields are list attributes only, so 617's item conditions need
   the category / coverage documents' own `lists` + `line inList` (not built on the 617 screens).
6. `GuardDraftReply` has no review time (`reviewedAt`); a send-back shows who, not when.
7. Review rows carry item codes only (no name); `newlyUnmatched` rows carry no item description.
8. A trace step's `value` is a string, not a boolean (`GuardTraceStep.Value`).
9. `POST …/Fields` refusal text says "scope is item, request, patient or eligibility" though `line` is accepted.

Still open (Done-when): the drives re-run against staging.
