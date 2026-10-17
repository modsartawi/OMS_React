# HITL — 512 (versions and restore)

I re-read the brief at the start of 512. It still has **no contract section**, so the doors are provisional: `GET RuleCampaign/Campaigns/{id}/Versions`, `GET …/Versions/{n}`, `POST …/Versions/{n}/Restore` (all in `src/core/rules/api.ts`).

## Q: What does a version carry on the wire?
**Decision taken:** the list row is `{ version, by, at, note }`. One version opened adds `rules` only (`RuleCampaignVersionDetail`). Restore takes no body and answers the whole campaign.
**Why:** the screen needs only these. A snapshot of the schedule, the audience or the budgets would be a guessed field that nothing reads.
**Revisit if:** 2759 snapshots the whole campaign. Then an opened version could read against its own budgets and audience (see the next question).

## Q: Which campaign does an opened version read against?
**Decision taken:** the campaign as it is now (its budgets and audience), for the sentence context. The rules are the version's own.
**Why:** a version carries its rules only (above). The sentence code needs budgets for a budget-left condition and the audience for the currency.
**Revisit if:** a version should read a deleted budget or another currency as it was then. That needs a fuller snapshot from 2759.

## Q: How does the client know "a draft with unsaved work exists"?
**Decision taken:** from the status alone (`restoreGuard`). A `draft` asks first, even when it differs from nothing (for example, a draft that an earlier restore made). `live` restores at once. The dialog's wording hedges: "with any change in it that is not published".
**Why:** in 511's lifecycle, changes over a live version make the campaign a draft again. No contract carries a "draft differs from live" flag, and the client never diffs snapshots.
**Revisit if:** 2759 keeps a live campaign's status `live` while its draft is edited. The 505 stub does exactly that today: a save on a live campaign leaves `status: 'live'`. Then a restore on such a campaign would drop saved, unpublished rule edits without asking. Ask 2759 for a `draftChanged` flag in that case.

## Q: Is Restore offered on the live version?
**Decision taken:** not while the campaign is live, because its draft already is that version. Over a draft it is offered (after asking), because restoring it throws the draft's changes away. The prototype never offers it on the live version.
**Why:** this is the one way back to exactly what tills run without hand-editing the draft.
**Revisit if:** the owner wants the prototype's rule, which never offers it.

## Q: A campaign waiting for approval, or a disabled one?
**Decision taken:** Restore is held on both, with a banner saying why. For waiting: send it back first. For disabled: copy the campaign. A status the client does not know is held as waiting.
**Why:** HQ refuses edits under a waiting request (the 505 save stub does too). 511 ruled "Disabled → nothing". Also, after a restore on a disabled campaign, the dashboard would claim "tills still run version N" when they do not (standards-review spec finding).
**Revisit if:** 2759 lets a disabled campaign take a restored draft to re-enable it.

## Q: Who may restore?
**Decision taken:** not gated by role. Anyone who reaches the page sees Restore, and HQ's refusal (message + code) is the backstop.
**Why:** restore edits the draft, and the builder's Save is not role-gated either. No Ua permission exists yet.
**Revisit if:** 2759 makes restore an author-only act. Then gate it with `ruleCampaignRolesQuery` the way 511 does.

## Q: How is the live version marked?
**Decision taken:** "Live" on `live.version` while tills run it, including under a draft or a waiting request. A disabled campaign's last version reads "Last published, disabled".
**Why:** a disabled campaign is not live. Its `live` field is only the last published version.
**Revisit if:** 2759 clears `live` on disable.

## Q: What does the dashboard say after a restore?
**Decision taken:** a new line under the State for any draft or waiting campaign with a live version: "Tills still run version N, activated … by …, until this draft is activated." This also shows on 511's changes-over-live drafts.
**Why:** the ticket's proof is "the dashboard shows a draft, live version unchanged". 511's draft sentence ("No till sees it…") reads wrong over a live version unless something says what tills do run.
**Revisit if:** the owner wants the draft sentence itself reworded for a draft over a live version.

## Note: the read-only rule card is a copy
`VersionRuleCard.tsx` is 504's read-only `RuleCard` (8fef574), brought back. It reuses `Says`, `Section` and `Pill`, now exported from `RuleCard.tsx`. Both code-review and standards-review flagged the duplication. A `readOnly` mode on the editable card would touch 505–508's builder, so it is left for a hardening pass.
