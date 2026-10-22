# HITL — 534 (the campaign area opens on the Promotions list)

## Q: Between 534 and 535, New campaign / From a template and the flat campaign list are unreachable. Keep CampaignListPage on another address?
**Decision taken:** No. `/campaigns` is the Promotions list as the ticket says; CampaignListPage stays in the tree, unrouted, for 535 to retire, and 535 moves CreateCampaignDialog / FromTemplate to the no-promotion page.
**Why:** The ticket changes the route's component and gives the rest of the retirement to 535; a temporary second address would be a route nobody asked for. The wave runs 534 → 535 back to back.
**Revisit if:** 534 ships without 535 — then hand-making a campaign has no entry point.

## Q: tools/campaigns-drive.mjs stops at its first flat-list check (`waitRows` on /campaigns times out). Re-cut it in 534?
**Decision taken:** Left for 535, which the ticket and the runner brief name as the re-cut of campaigns-drive "where it read the flat list". Measured: PASS 1 ("the Campaigns leaf is in the rail"), then a TimeoutError at line 414; nothing after runs.
**Why:** 535 retires the list and owns those checks; re-cutting here would be done twice. campaign-uploads-drive (272/272) and the new campaign-promotions-drive (82/82) are green.
**Revisit if:** 535 does not land — then the workspace checks in campaigns-drive are unproven.

## Q: The menu leaf's key — keep `campaign-list:menu.campaigns` reading "Promotions", or rename it?
**Decision taken:** Renamed to `campaign-list:menu.promotions` ("Promotions"), still in `campaign-list` where every leaf of the group lives.
**Why:** A key named campaigns that reads Promotions misleads; moving one leaf into another namespace would split the group's labels.
**Revisit if:** 535 empties features/campaigns/list and wants the group's menu keys moved with it (they would then belong in a namespace the menu owns).

## Q: windowDays / dayOf lived in features/campaigns/uploads/report.ts; the Promotions list needs the same inclusive window.
**Decision taken:** Graduated both to `src/core/rules/wire-days.ts`; the upload screens import it from there; their tests moved to `wire-days.test.ts` (none deleted).
**Why:** A feature may not import a feature; logic two features share goes up to core.
**Revisit if:** never — behaviour unchanged (upload drive 272/272).

## Q: Reserve `promotions` and `no-promotion` as campaign ids?
**Decision taken:** Yes, added to RESERVED_CAMPAIGN_IDS (`/campaigns/no-promotion` shadows a campaign so named; `/campaigns/promotions/:promotionCode` takes the pages of a campaign named `promotions`). `upload` and `uploads` (530/532's leaves) are missing from the list too; not added here.
**Why:** The new static leaves are 534's; 530/532's gap is theirs and the ticket says not to re-decide them. 535 removes the id pre-check anyway (HQ's 409 is the guard), so this list then only guards the client form until it goes.
**Revisit if:** the owner wants upload/uploads reserved too, or an existing campaign already holds one of these ids.

## Q: The promotion state badge's severities.
**Decision taken:** live ok, pending warn, ended mute, disabled warn (an unlisted state renders as disabled, as the ticket rules).
**Why:** Matches the campaign state badge (waiting and disabled need a human); ended is simply over.
**Revisit if:** the owner wants ended to read red like a campaign's expired.

## Q: The list's columns are not sortable.
**Decision taken:** No column sorts; the rows stay in HQ's order (newest first) with the no-promotion row last.
**Why:** The ticket asks for the reply's order and the no-promotion row last; a sort would move it.
**Revisit if:** users ask to sort by window or count — then pin the no-promotion row as a bottom row.

## Q: What does `/campaigns/promotions/:promotionCode` show before 535?
**Decision taken:** A placeholder: the promotion's header from its List row (code, names, kind, state, window, counts, live version), a line saying its campaigns are not listed yet, a stale code's "no such promotion", a bare 403's message, and the way back. Codes are matched in any case.
**Why:** The ticket says "a placeholder until then"; the header is what 535 builds from the list query anyway.
**Revisit if:** 535 wants the header elsewhere.

## Q: The workspace's back link still reads "To campaigns" and goes to /campaigns (now the Promotions list).
**Decision taken:** Untouched.
**Why:** 537 rewrites the way back to name the promotion.
**Revisit if:** 537 does not land.

## Q: The Promotions list query is not refreshed by an upload's Activate (UploadPage invalidates RULE_CAMPAIGNS_KEY only).
**Decision taken:** Untouched in 534; the list refetches on mount (no staleTime), so opening /campaigns reads it fresh.
**Why:** 535 owns re-pointing every RULE_CAMPAIGNS_KEY invalidation to the promotions queries (the key would then need to sit in core for uploads to reach it).
**Revisit if:** 535 misses it.

## Q: CONTEXT.md — add the rule engine's Promotion (539 left it for 534)?
**Decision taken:** Added a **Promotion** (rule engine, on Campaigns ▸ Promotions) entry after Customer session; the bonus-buy Promotion entry and every other bonus-buy line are unchanged.
**Why:** The glossary's only Promotion was the bonus-buy one, which says "_Avoid_: campaign, flyer"; the screens now say promotion for the flyer.
**Revisit if:** /domain-modeling prefers one entry with two senses.

## Q: Port 5199 was already listening (PID not started by this session).
**Decision taken:** Ran this session's vite on 5197 (DRIVE_PORT=5197) and killed only the PID owning 5197.
**Why:** Same as 539: someone else's server.
**Revisit if:** 5199 is the runner's own and leaked.

## Q: Review flagged "weekly flyer" in the list's lede as the banned word "week".
**Decision taken:** The lede now reads "Each flyer or ad-hoc set of campaigns…"; the "Sunscreen week" fixture is "Sunscreen offers". Two code comments and CONTEXT.md keep the brief's own definition ("the weekly flyer").
**Why:** "Week" is banned as a term; quoting the decided definition in a comment or the glossary is not using it as one.
**Revisit if:** the owner wants "weekly" gone from comments too.

## Q: Upload facts (revision, upload state, uploader, approver) — shown for origin upload only, or whenever HQ holds an upload?
**Decision taken:** Whenever `revision` is set, so a hand-made promotion that an upload waits on shows it too.
**Why:** The fields are null without an upload (contract), and the brief says an upload may go into a hand-made promotion's code.
**Revisit if:** the owner wants a hand-made row to stay bare until the upload is activated.

## Q: Graduate the known upload-state list (`UPLOAD_STATES`) to core too?
**Decision taken:** No; PromotionsPage keeps its own three-word list for its own keys (an unlisted one reads as sent, like the upload screens).
**Why:** Different namespaces word them; graduating would touch 532's review.ts for one list.
**Revisit if:** a third screen needs it.
