---
status: done
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

- [x] `exceptionValidUntil_capsAt90LocalDays` — pure
- [x] drive (stubbed)

## Boundaries

— Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Comments

**2026-10-27 — built on `impl/3126-614`.** Feature `src/features/insurance-rules/review/` (one feature, two pages):
`/insurance-rules/review` (ReviewPage) and `/insurance-rules/exceptions` (ExceptionsPage), namespace `insurance-review`
(en + ar, mirror-tested), two menu leaves in the area group. Proof: `exception.test.ts`
(exceptionValidUntil_capsAt90LocalDays), `i18n-keys.test.ts`, `menu-insurance-rules.test.ts`; drive
`tools/insurance-review-drive.mjs` 100/100 STUBBED (LTR + RTL). Typecheck, lint, vitest green.

**Stubs:** `tools/insurance-rules-stubs.mjs` section `// --- 614 ---`: `GUARD_REASONS`, `REVIEW_ROWS`, `EXCEPTIONS`,
`EXCEPTION_LOGS`, stateful `createReviewStubs({ deny, writes, refuse, reads })`. `Guards/Reasons` (3134) is read by
`reasonsQuery()` in the feature's `api.ts`; 616 reads the same door — if both need it, it graduates to core.

**Guesses where the brief is silent (618 reconciles):**
- Review row shape (`GET InsuranceRules/Review`): `{ id, kind: override|exception|unchecked, at, store, pharmacist,
  patientKey (masked as sent), ruleId|null, item {code,name}|null, reason, note, exceptionId, mark, markNote, markedBy,
  markedAt }`. Filters sent as `pharmacist, store, rule, reason, kind` query params; `kind` is a guessed extra filter.
- A Questioned mark needs a note; OK may go with an empty note.
- `GET InsuranceRules/Exceptions` (list door) and its row shape are guesses: `{ id, patientKey, ruleId|null, scope,
  validUntil, reason, note, issuedBy, issuedAt, revokedBy, revokedAt, uses }`. Revoke posts an empty body `{}`.
- Scope wire: exactly one of `{ item: <item code> }`, `{ sameKind: <item code> }`, `{ list: <list id> }`.
- "Valid until ≤ 90 days" is inclusive in local days: today is allowed, today + 90 is the last day; a date before
  today is refused. Status: revoked > expired (the day after `validUntil`) > active; only active can be revoked.
- Log entry: `{ at, kind: issue|revoke|use, by, store, ruleId, sourceRef }`.
- Retired (inactive) reason codes are not offered when issuing an exception; the Review filter still lists them (old rows carry them) and rows render their words.
- No access probe; a bare 403 on either read is "You do not have access".
