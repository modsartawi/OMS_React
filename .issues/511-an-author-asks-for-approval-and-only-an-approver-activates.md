---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: 508
---

# 511 — An author asks for approval and only an approver activates

## What to build

The dashboard's **pre-activation steps** (named, rules valid, schedule set, budgets considered…) each tick or link
to the page that fixes them. The actions follow the **role split** (BackOffice 2759, Ua):

- an **author** sees **Ask for approval** (with a note), which is disabled while 508's checks hold an error, and
  **Delete draft**, which asks for confirmation;
- an **approver** sees the pending changes and **Activate**, **Send back** (with a note) or **Disable**;
- an author never sees Activate, and the server's refusal is the backstop, shown with its envelope message and code.

The list's state tiles and the dashboard's State follow each transition.

## Spine reach

model/api (ask, activate, send back, disable, delete, the caller's role) · logic (which actions for which role
+ state) · component (dashboard actions, steps) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] `actionsFor_authorNeverActivates_approverCan` — every state × role · pure (`workspace/approval.test.ts`, with `draftGate` + `actionGate`)
- [x] `preActivationSteps_tickFromTheDraft` · pure (`workspace/approval.test.ts`; `pageLanded` in `menu.test.ts`)
- [x] drive: author asks → approver activates; send back; a refused activate shows the envelope message (stubbed) · flow (`tools/campaigns-drive.mjs` §511, checks 62–71; whole drive 325/325)

## Boundaries

Provisional lifecycle endpoints + new Ua permissions (BackOffice 2759; owner grant owed), stubbed. Business
`success:false` codes surface through `apiErrorMessage` / `apiErrorCode`.

## Done when

The drive walks draft → waiting → live as two roles, and an author cannot activate.

## Blocked by

[508](508-the-checks-pill-points-at-the-rule-block-and-field-and-errors-block-approval.md)

## Open questions

- The approval contract's states are fog in BackOffice 2759 / spec 2737. Default: draft → waiting for approval → (sent back →
  draft) | live → disabled.

## As built (2026-10-16)

- `@/core/models/rule-campaign`: `RuleCampaignRoles {author, approver}`, `RuleCampaignTransition {note}`,
  `RuleCampaignNoteStamp`, optional `sentBack` on the campaign. `@/core/rules/api`: PROVISIONAL doors
  `GET RuleCampaign/Roles`, `POST RuleCampaign/Campaigns/{id}/{AskForApproval|Activate|SendBack|Disable}`,
  `DELETE RuleCampaign/Campaigns/{id}`; `rememberTransition` / `forgetDeleted`.
- `workspace/approval.ts` (pure): `actionsFor` (roles × state), `draftGate` (no rule → checks → errors),
  `actionGate`, `preActivationSteps`, `showsSteps`. `ApprovalPanel` (State cell) + `PreActivationSteps`
  (above the cells while never published). Settings steps stay unlinked until 509 lands its pages
  (`pageLanded` in `menu.ts`).
- Ask for approval AND Activate wait for HQ's checks (508) and a rule; refusals show the envelope message
  and code inside the dialog (or under Ask). Decisions logged in `.afk/HITL-511.md`.
- Gates: typecheck, `npm test` 5343/5343, lint (4 gates), build — green.

**Outstanding (not AFK's):** live doors + Ua grant (BackOffice 2759 → ticket 520); owner sign-off on the
Open-questions default and on the HITL decisions (Disable not offered on changes waiting over a live
version; a disabled campaign offers nothing; pending changes list the draft's rules, not a diff vs live).
The server backstop for an author's activate is proved only by what is drawn — no UI path lets an author
call it, so the refusal is driven as the approver's.
