---
status: done
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

- [x] the old-against-new summary, including zero changes — pure
- [x] a changed alias lists an affected ruleset; open the draft, read the back-test, approve it as another user — flow (stubbed; RTL direction with English words, see Comments)

## Boundaries

Patient keys stay masked on the back-test view. Labels-only drafts are 708, on the same list. Doors stubbed; 711
reconciles.

## Done when

A published rule changes what it reads only through a draft someone else approved after seeing the difference.

## Blocked by

704.

## Comments

**2026-10-30, built on stubs (`tools/insurance-fhir-705-drive.mjs`, `tools/fhir-rules-stubs-705.mjs`).** A "Re-pin drafts"
section on `/insurance-rules/aliases`, in `aliases/RepinDrafts.tsx` + `aliases/repin.ts`, group `repin` of `insurance-aliases`.

Door shapes guessed from 3294, which spells none (711 reconciles):

- `GET InsuranceRules/RepinDrafts/Affected` → `[{ changeId, kind: 'path' | 'alias', rulesetId, rulesetName, rulesetVersion, subject, before, after, draftId }]`. `subject` is one machine string (field key, or `payer · wrong URL`); `before` / `after` are the pinned form, null when nothing was pinned.
- `POST InsuranceRules/RepinDrafts { rulesetId, changeId }` → the draft, its back-test started.
- `GET InsuranceRules/RepinDrafts/{id}` → `{ id, kind, rulesetId, rulesetName, rulesetVersion, subject, before, after, state: 'open' | 'approved', createdBy, createdAt, approvedBy, approvedAt, backtest }`, polled while the back-test runs.
- `backtest` → `{ status (as the guard back-test), error, bundles, changedTotal, changes: [{ bundleId, on, payer, ruleId, maskedKey, before, after }] }`; `changes` may hold only the first lines.
- Decisions `PASS | WARN | OVERRIDE | REFUSE | NOT_EVALUATED`; another value is shown as sent.
- `POST InsuranceRules/RepinDrafts/{id}/Approve {}` → the draft. Refusal codes `INSREPIN_SELF_APPROVAL`, `INSREPIN_NOT_FOUND`.
- An approved draft's ruleset drops off `Affected`.

Overrulable decisions:

- The list lives on the aliases screen, as the caller's scope says, though it also carries registry path changes. No path screen links to it yet.
- Approve needs a finished back-test: a running, failed or missing one offers no Approve. A failed one shows HQ's words and has no re-run, since the door names none.
- A zero-change draft can still be approved: the ruleset still moves to the new form.
- No confirmation dialog on Approve: the draft itself is the thing read. No reject or discard, since the door names neither.
- A line whose decision did not move is not a change, and is taken off HQ's total.
- The breakdown groups the lines that arrived, and says so when HQ sent fewer than it counted.
- Counts are label + figure, never a counted sentence, so `ar` needs no plural forms.

⚠ `core/i18n.ts` pins `lng` to `en`, so the flow's RTL pass flips direction with English words. The Arabic file is proved only as
mirroring the English keys: its words await an Arabic sign-off.
