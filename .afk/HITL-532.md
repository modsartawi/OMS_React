# HITL log — ticket 532 (an approver activates or sends back a campaign upload)

## Q: Where the approver's uploads live
**Decision taken:** Own page `/campaigns/uploads` + `/campaigns/uploads/:dealCode`, menu leaf "Campaign uploads" eighth in Campaigns (the ticket's overrulable default).
**Why:** oms-react has no Approvals screen to add a tab to; the ticket settles this default.
**Revisit if:** The owner wants an Approvals page with Drafts and Uploads tabs.

## Q: Next step offered for RULES_NOT_PENDING
**Decision taken:** "Load it again" (as for RULES_UPLOAD_STALE); the page then shows the new state and no buttons.
**Why:** The upload moved since it was loaded (activated or sent back by someone else); reloading is the only useful act.
**Revisit if:** The owner prefers a link back to the list.

## Q: Activate / Send back buttons on an upload that is not pending
**Decision taken:** Shown only on a `pending` upload (by its state, never by a guessed role); otherwise a line "Only a pending upload is activated or sent back."
**Why:** HQ would refuse them with RULES_NOT_PENDING; state is data, not a role guess, so the no-probe rule holds.
**Revisit if:** The owner wants the buttons always visible so HQ's refusal is what is seen.

## Q: Note length
**Decision taken:** 500 characters max on both notes (as draft approval's note).
**Why:** Consistency with the workspace's approval note; the doors name no limit.
**Revisit if:** HQ enforces a different limit.

## Q: List order and the window column
**Decision taken:** Rows in HQ's order (newest upload first, never re-sorted by the client); the window is 530's `windowDays` (inclusive last day as sent, one isolated range).
**Why:** The contract says List answers newest first; the inclusive-day rule is decided.
**Revisit if:** HQ stops ordering the list.

## Q: Brief vs server code
**Decision taken:** No difference found: List/Load/Activate/SendBack bodies and replies (`RuleUploadSummaryReply`, `RuleUploadDetailReply`, `RuleUploadCampaignItemReply`, `RuleUploadActivation`, the stored summary `{ mechanics, skuCount, windowFrom, windowUntil, generatedNames, warnings }`) match `core/models/rule-upload.ts` field for field.
**Why:** Checked against `RuleCampaignUploadWebEndpoints.cs`, `RuleUploadApprovalService.cs`, `RuleCampaignUploadService.SummaryOf`.
**Revisit if:** 533's live walk shows a field differently named.
