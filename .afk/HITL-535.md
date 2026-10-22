# HITL — 535 (a promotion's page lists its campaigns, paged and filtered on the server)

## Q: A blank Create no longer pre-checks a taken id — is HQ really the guard?
**Decision taken:** Followed the ruled default (no pre-check). Read BackOffice: Copy and From a template call `RefuseTakenAsync` (409 `RULES_CAMPAIGN_EXISTS`), but a blank Create is a first `Drafts/Save` at revision 0 (`RuleBuilderService.WriteDraftInAsync`), which HQ takes over a live campaign with NO draft as that campaign's new draft (a campaign that has a draft answers `RULES_DRAFT_STALE`). Nothing reaches a till until an approver activates it, and the approver sees the pending changes against live. The comment on `campaignIdProblem` says this plainly.
**Why:** The runner and the ticket rule the pre-check out ("do not re-litigate"); the old pre-check also missed disabled campaigns with no draft.
**Revisit if:** the owner wants a server guard — **BackOffice ask:** `Drafts/Save` at revision 0 should refuse an id that already has a campaign row or is live (`RULES_CAMPAIGN_EXISTS`), as Copy does. Logged here for the BackOffice owner, not filed.

## Q: Where does the list context go when a row opens its campaign?
**Decision taken:** `/campaigns/:id?promotion=<code>&q=&mechanic=&status=&page=` built by `campaignInPromotionPath` in `core/rules/promotion-query.ts` (beside the URL reader), `promotion=` always written (empty = no promotion), filters only when set, page only past 1.
**Why:** 537 reads it in the workspace (another feature), so the reader/writer sit in core.
**Revisit if:** 537 wants every key written even when empty.

## Q: "+N pending" needs the UNFILTERED total, but the page's `total` is filtered.
**Decision taken:** While a filter is on, one extra read of the promotion's first row (`pageSize: 1`, no filter) gives the unfiltered total; with no filter, the page's own total.
**Why:** Never a guessed number; one tiny read, cached per promotion.
**Revisit if:** HQ adds the unfiltered total to the page reply.

## Q: Mechanic labels — words or HQ's keys?
**Decision taken:** HQ's keys shown as sent (`builder`, `percentOff`, an unknown one too), isolated as machine values, in the chips and the column.
**Why:** The set is open (every key HQ counts must render); words would need a key per mechanic and a fallback anyway.
**Revisit if:** the owner wants words for the known mechanics.

## Q: "All" mechanic chip = the sum of the counted mechanics, which can be below `total`.
**Decision taken:** Kept the sum (the ticket's Proof says "All with the sum"); a campaign uploaded before 2846 (null mechanic) is uncounted by HQ.
**Revisit if:** the owner wants "All" to read the total instead.

## Q: A mechanic filter in the URL that HQ no longer counts (the search/status left none).
**Decision taken:** It stays as a chip at 0 so it can be seen and cleared.
**Why:** Otherwise a filter is on with no visible way off but editing the URL.

## Q: The no-promotion page's two create actions.
**Decision taken:** Two buttons, New campaign (the dialog on its blank tab) and From a template (the same dialog on its template tab, via a new `startOn` prop). The old list had one button with tabs.
**Why:** The brief and ticket name both actions.

## Q: The uploaded promotion's Re-upload / Its upload — origin upload only, or whenever HQ holds an upload?
**Decision taken:** Only when the promotion's kind is Uploaded (`origin: upload`), as the ticket says.
**Revisit if:** a hand-made promotion an upload waits on should link its upload too (534 shows its upload facts).

## Q: `campaignUploadPath` / `CAMPAIGN_UPLOADS_PATH` lived in the uploads feature.
**Decision taken:** Graduated to `core/rules/campaign-state.ts` (beside `CAMPAIGN_UPLOAD_PATH`); 532's three files and its api test import them from there. No behaviour change (upload drive 272/272).
**Why:** The promotion page links an upload; a feature may not import a feature.

## Q: The `campaign-list` namespace now has no feature (it keeps `menu.*` and `states.*`).
**Decision taken:** Left as it is; the create/template keys moved to `campaign-promotions` with the dialogs. Renaming it touches the menu, its test and core's `CampaignStateBadge`.
**Why:** 534 flagged it for "if 535 empties features/campaigns/list"; a rename is not this slice's behaviour.
**Revisit if:** the owner wants a menu-owned namespace (e.g. `campaign-area`).

## Q: FromTemplate's bare-403 words ("You do not have the rule-reader permission (RuleAuthoring 03)…").
**Decision taken:** Unchanged by the move.
**Why:** The "You do not have access to this action" rule is the promotion doors'; the template doors' words are 503/524's and already name the missing grant.
**Revisit if:** the owner wants one denial sentence across the campaign area.

## Q: Port 5199 was in use (PID not this session's).
**Decision taken:** Ran this session's vite on 5197 and killed only the PID owning 5197.

## Q: tools/campaigns-drive.mjs is LTR only.
**Decision taken:** Re-cut where it read the flat list; it stays LTR-only as it was (its locale is fixed to en since 501). 535's own checks run LTR and RTL in tools/campaign-promotions-drive.mjs.
**Revisit if:** the owner wants the workspace drive in RTL too (a hardening ticket).
