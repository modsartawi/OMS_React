---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 706
---

# 707 — Label overrides are approved by a second person, and the worklist ranks what lacks Arabic

## What to build

Stories 65, 66; L12, L13; door 3297. On the Code labels screen, a member writes an Arabic or corrected English label for
a code, and someone who is not its author approves it. The **curation worklist** lists the codes a ruleset can show that
lack Arabic, then the codes seen but unlabelled, most-used first. Its rows open the override editor, so nobody faces the
full 1,682 error codes.

## Spine reach

model/api (worklist, propose, approve) · store/logic (form rules, who may act) · component (worklist, override editor) ·
i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] the form needs at least one of EN or AR; who may approve — pure
- [x] the order is the door's and the grid keeps it on load — flow
- [x] open a worklist row, write Arabic, approve it as another user, and the row leaves the list — flow

## Boundaries

Never offer a machine translation. A label is `<bdi>`, a code is `Ltr`. Doors stubbed; 711 reconciles.

## Done when

Pharmacists' Arabic comes from checked text, and the team works from the codes that matter.

## Blocked by

706.

## Comments

**2026-10-30, built on stubs (drive `tools/insurance-fhir-707-drive.mjs`, stubs `tools/fhir-rules-stubs-707.mjs`).**

Door shapes guessed from 3297's prose, for 711 to reconcile:

- `GET InsuranceRules/Labels/Worklist` → ranked rows `{ system, code, reason, frequency, current: { en, ar }|null }`, unpaged.
  `reason` is `lacksArabic | unlabelled`; another value is shown as sent.
- `GET InsuranceRules/Labels/Overrides?state=proposed` → `{ id, system, code, en, ar, state: proposed|approved, current,
  proposedBy, proposedAt, approvedBy, approvedAt }`.
- `POST InsuranceRules/Labels/Overrides` `{ system, code, en, ar }` → that row. A language left empty is `null`, read as
  "leave this language's label as it is".
- `POST InsuranceRules/Labels/Overrides/{id}/Approve` with an empty body → that row. A code that gains Arabic leaves the
  worklist on the next read.
- Refusals show the envelope's `message`; the screen does not branch on a code. The stubs use `LABEL_OVERRIDE_EMPTY`,
  `LABEL_CODE_UNKNOWN`, `LABEL_OVERRIDE_PENDING` and `LABEL_OVERRIDE_SELF_APPROVAL`.

Overrulable decisions:

- "The grid" is a plain table, like the rest of this screen, with no sort control at all, so nothing can reorder the door's
  ranking. If the door's list is long enough to need paging, 711 adds it.
- The list has a `Write a label` button and an awaiting-approval table beside the worklist. Story 65's corrected English is
  for codes that already have Arabic, which the worklist never lists, and their approver needs somewhere to find them.
- An English-only approval on a lacks-Arabic row leaves it on the list, because it still lacks Arabic.
- A code with a proposal waiting opens that proposal, with no second one (the stub refuses it as 409). **There is no
  reject or withdraw:** 3297 specifies neither, so a wrong proposal can only be approved or left. This is a gap to raise on 3297.
- Approve has no second confirm, unlike Aliases: the editor already shows today's and the proposed words beside the button.
- The boxes start empty rather than prefilled, so an approver never reads a language nobody touched as a proposal.

Arabic keys are proved mirrored by test only: `lng` stays `en`, so the drive's RTL pass reads English words under `dir=rtl`.
The Arabic wording is unreviewed. No Proof box needs a live door, but all three are proved on stubs only.
