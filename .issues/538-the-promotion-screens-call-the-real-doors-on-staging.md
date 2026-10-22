---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\assets\2848-oms-react-promotions-brief.md
blocked-by: 534, 535, 536, 537 (live: BackOffice 2846–2847 and 2862 deployed, HQ scripts 017 then 018 run)
---

# 538 — The promotion screens call the real doors on staging

> Rewritten by ticket 539 (2026-10-21) to BackOffice 2862's words: promotion, `promotionCode`, `Rules/Authoring/Promotions/*`,
> `RULES_PROMOTION_*`. No scope changed.

## What to build

The brief's D5: the live walk. No new screen. The stubs come off and the screens meet the real
`Rules/Authoring/Promotions/*` doors.

**Before it can run (owner acts):**
- BackOffice 2846, 2847 and 2862 deployed to the SIS.Api the walk uses (and 2855 for the direct-link crumb and the budget
  tile, when it lands);
- the HQ script `Sartawi.Retail.Data/Modules/Rules/Sql/017_create_rule_promotion.sql` run on that HQ database (after 015
  and 016; it is idempotent and backfills the promotions of existing uploads), then
  `018_rename_rule_deal_to_promotion.sql` (BackOffice 2862; a no-op on a fresh database);
- an author (`RULE_AUTHOR`), and at least one activated upload (533's walk leaves one).

**The walk:**
1. Open `/campaigns`: the activated upload's promotion is `live` with its counts, and the no-promotion row is last.
2. Open that promotion: page through it, narrow it by a mechanic chip and by status, find a campaign by its Arabic name.
3. Open a campaign from the filtered page: the crumb names the promotion; Next across a page boundary; back to the same
   filtered page. The Rules page shows the upload note.
4. Create a hand-made promotion, assign two hand-built campaigns: they leave the no-promotion page.
5. Assign an uploaded campaign to it: `RULES_PROMOTION_OWNED`, nothing changes.
6. Unassign both and delete the promotion.

Record each step's request and reply (status, code) in this ticket. Any mismatch between the contract and the wire
becomes a finding here, and a BackOffice ask when HQ owns it.

## Spine reach

test (live drive + owner walk). Code changes only where the wire differs from the stubs.

## Proof

- [ ] `tools/campaign-promotions-drive.mjs` run against the live doors (no stubs), steps 1–6 green
- [ ] Each step's request and reply recorded here

## Boundaries

- Doors: `Rules/Authoring/Promotions/*` (BackOffice 2846–2847), live. No stubs.
- Writes on staging only: one hand-made promotion, created and deleted by the walk.

## Done when

The walk is green on staging and recorded here.

## Blocked by

[534](534-the-campaign-area-opens-on-the-promotions-list.md), [535](535-a-promotion-s-page-lists-its-campaigns-paged-and-filtered-on-the-server.md),
[536](536-an-author-makes-a-promotion-by-hand-and-assigns-campaigns-to-it.md),
[537](537-the-campaign-workspace-knows-its-promotion-and-steps-through-the-promotion-s-list.md)

## Triage of the wave's reviews and HITLs (2026-10-22)

All five reviews were MINOR (`.afk/REVIEW-534…539.md`, `.afk/HITL-534…539.md`). Fixed on main in one commit:

- 535: "+N pending" no longer drops out while an unfiltered page turn loads (the shown page's total is
  kept, or the cached one-row read's).
- 537: Prev / Next stay shown and disabled (`loading`) while a crossed page is read; they are hidden only
  without a context.
- 536: the success line's joiner is the locale's (`assign.joiner`), not a `", "` inside `movedFrom`;
  `assign.picked` and `unassign.body` format their count like the others ("2,000").
- 536: after Delete, the gone promotion's campaign pages are left out of the refresh (no 404 read).
- 537: one `findRulePromotion` in `core/rules/promotion-query.ts` replaces the two any-case lookups;
  `PromotionQuery.status` is typed by `PROMOTION_CAMPAIGN_STATUSES`.
- 535: the orphaned `campaign-list` namespace is renamed `campaigns` (the area's, as `reports` is).
- 537: drive 143 now walks Coupons too: a coupon search and an opened batch keep the context
  (campaigns-drive 689/689).

Gates: typecheck, lint 4/4, vitest 349 files / 5776 tests, campaigns-drive 689/689,
campaign-promotions-drive 284/284, campaign-uploads-drive 272/272 (all stubbed).

Left as they are (judgement calls, defensible): the upload-state list kept per namespace (HITL-534), the
menu's literal paths (every leaf is a literal), the `PromotionCampaigns` / workspace data clumps, the three
write dialogs' shared shape.

### For this walk to check

- The upload facts show on any promotion HQ reports an upload for (`revision` set), a hand-made one too
  (HITL-534); 535's Re-upload / Its upload stay on `origin: upload` only.
- The coupon page's own URL keys are now `search` / `codeStatus` (were `q` / `status`, 537): old coupon
  bookmarks lose their search.

### Owner rulings open

1. **"No promotion" with Arabic beside it** (brief 2848 line 101): the row and page read the English only;
   the rewritten 534 said EN only. Show a fixed Arabic label, or rule the brief's parenthesis out.
2. **The uploaded note on a direct link** (537): without a context (until BO ask J) an upload's campaign
   shows no "part of the upload" note. Infer it by `<code>-` prefix over `Promotions/List`, or accept the gap.
3. **Pending campaigns cannot be picked in Assign** (536, unasked): keep, or let HQ's OWNED refuse them.
4. **One denial sentence across the campaign area?** Blank Create's and FromTemplate's bare 403 keep their
   older words (HITL-535).
5. **Reserve `upload` / `uploads` as campaign ids** too (HITL-534)?
6. HITL-535's smaller defaults: mechanics shown as HQ's keys, "All" = the sum, a stale mechanic chip at 0.

### BackOffice asks (not filed)

- `Drafts/Save` at revision 0 should refuse an id that already has a campaign row or is live
  (`RULES_CAMPAIGN_EXISTS`), as Copy does (HITL-535); the client no longer pre-checks.
- BO ask J (BackOffice 2855) still unbuilt: the budget tile and the direct-link lookup run on their fallback.

Observation: the coupon search drops an input made in the same moment the previous one's URL lands
(seen only by the drive, with and without a context; the same `set` path since 515). Not fixed here.
