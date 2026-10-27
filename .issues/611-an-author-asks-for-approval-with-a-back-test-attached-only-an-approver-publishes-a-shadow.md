---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 608
---

# 611 — An author asks for approval with a back-test attached, only an approver publishes, a shadow rule is promoted, and a version restores as a draft

## What to build

The approval panel by role: an author **asks for approval** (disabled until a back-test of the current
revision exists); an approver approves or sends back. A shadow rule shows its shadow figures and days in shadow;
the approver **promotes** it (or skips shadow with a reason). **Versions**: who, when, note; restore as a new draft.

**HQ contract:** the brief's sections for BackOffice 3139, BackOffice 3140. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

logic (pure actionsFor / gates) · components · test

## Proof (→ `tdd` red-green cycles)

- [x] `actionsFor_roleStateAndBacktest` — pure
- [x] `promoteGate_14DaysOrReason` — pure, local days
- [x] drive (stubbed)

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[608](608-an-author-edits-a-guard-from-a-palette-with-nested-all-of-any-of-groups-and-not-severity-e.md)

## Open questions

- **Layout follows the insurance team's walk** of the prototype (https://claude.ai/code/artifact/91vLtKjq47zeaDritTwyJS, BackOffice map ticket 3096, still open). Reactions recorded there before this is built amend this ticket.

## Comments

**2026-10-27 — built on `impl/3126-611`.** A feature of its own, `features/insurance-rules/approvals/`
(`/insurance-rules/approvals`, menu leaf Approvals, namespace `insurance-approvals` en + ar mirrored) — kept out of the
guards feature so 609 / 612 / 617's edits there stay clean. Proof: `approvals/approval.test.ts`
(actionsFor_roleStateAndBacktest, promoteGate_14DaysOrReason with local days), `approvals/i18n-keys.test.ts`; drive
`tools/insurance-approvals-drive.mjs` 114/114 STUBBED (LTR + RTL): no / stale / running back-test blocks Ask, the
running one is polled to done, a server refusal shows its words, ask with a note, own submission cannot be approved,
send back with a note, ask again, approve (draft rules into shadow, a new version), promote G-003 at 15 days with no
reason, G-008 at 10 days only with a reason, restore version 3 as a NEW draft revision (its back-test then out of
date), bare 403. 607 86/86, 608 88/88, 612 92/92 still green. Typecheck, lint and vitest green.

**Shared pieces:** `core/insurance-rules/backtest.ts` is 612's (`GuardBacktest`, `backtestIsCurrent`, …); 611 appended
`backtestStanding(bt, revision)` (`none | running | failed | stale | current`) and `draftBacktestQuery(id)` (same door
and query key as the simulator's, polled while running). 608's `checksVerdict` gates Ask (errors block, warnings
never do). Stubs `// --- 611 ---`: `newApprovalStore()`, `approvalStub(…, { store, user, viewer, now })`,
`GUARD_VERSIONS`, `BACKTEST_DONE(_ID)`; call it first, then `insuranceMetricsStub`, then `insuranceRulesStub`.

**Guesses where the brief is silent (618 reconciles):**
- No door says where the draft stands nor who the viewer is: guessed `GET InsuranceRules/Guards/Approval` →
  `{ revision, state: draft | waiting, submittedBy, submittedAt, note, sentBack: { by, at, note } | null, backtestId,
  viewer: { author, approver } }`. `viewer` stands in for the authoring / approving grants until 618's probe.
- **How 611 finds the draft's back-test:** no door lists back-tests, so the Approval read carries `backtestId` — the
  draft's latest back-test, which HQ records when 612's `POST …/Backtests` starts one — read through
  `GET …/Backtests/{id}`. Current = done and `revision` equals the draft's (612's `backtestIsCurrent`).
- Submit / Approve / SendBack answer the Approval shape above; Approve and SendBack take `{ note }` (optional).
  Approve turns waiting rules shadow (shadowSince = today) and publishes a version; SendBack turns them draft.
  Only an approver promotes; restore is offered to an author.
- Promote body `{}` at 14+ days, `{ skipReason }` under 14 (or an unknown shadow day); days are whole LOCAL calendar
  days from `shadowSince`'s day to today.
- Versions: `[{ version, by, at, note }]`, newest first; `by` = the approver. Restore answers the NEW draft document
  with its new revision (so the back-test goes stale and Ask waits for a new one).
- Shadow figures read 615's door `GET InsuranceRules/Metrics?by=rule&from=<shadowSince>&to=<today>` (row
  `shadowFires`); no row = 0.
- Refusal codes in the stub (`BACKTEST_REQUIRED`, `OWN_SUBMISSION`, `NOT_APPROVER`, `SHADOW_TOO_SHORT`, `NOT_DRAFT`,
  `NOT_WAITING`) are guessed spellings; the screen shows the server's message, it never branches on them.
- Layout is a page of its own (draft panel, In shadow, Versions), not the prototype's Publish card in the editor;
  the insurance team's walk (BackOffice 3096) has not amended it.

**2026-10-28 — 612's realignment changed the Submit gate's source.** The draft's back-test is now found through
`GET InsuranceRules/Guards/Backtests` (3140, core `draftBacktestsQuery` + `draftBacktest`), not the guessed
`backtestId` on the Approval read (removed from `DraftApproval`). Submit's 409 `GUARDS_BACKTEST_MISSING` is shown in
words with a link to run one, and re-reads the back-tests. Stub code renamed from `BACKTEST_REQUIRED`. Approvals
drive 126/126 (new step 1b). Details under 612.
