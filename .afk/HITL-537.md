# HITL — 537 (the campaign workspace knows its promotion)

## Q: The Coupons page's own URL keys (`?q=&status=&batch=`) collide with the list context's `q` / `status` — which side gives way?
**Decision taken:** The Coupons page's keys became `search` and `codeStatus` (`batch` unchanged); the list context keeps the ticket's `?promotion=&q=&mechanic=&status=&page=`. Coupons' own URL writes now carry the context on. Drive check 112's three URL assertions say the new keys (same meaning).
**Why:** The ticket and 535 fix the context's keys (535's drives assert them); on Coupons with a context, `q=sun` would otherwise have been read as a coupon search.
**Revisit if:** Someone relies on old `/campaigns/:id/coupons?q=…` bookmarks; or the owner prefers prefixing the context keys instead.

## Q: With BO ask J, how does a direct link's found promotion reach the crumb, the back link and Prev / Next?
**Decision taken:** The workspace writes it into the address as `?promotion=<code>` (replace), i.e. a context with no filters at page 1. The crumb stays a pure read of the URL. Prev / Next show only when the campaign sits on that page (the lookup row does not say which page it is on), else hidden.
**Why:** Keeps one source of truth (the URL, as the brief asks for reload/shared links) and the crumb derived in `crumb.ts`, never per screen.
**Revisit if:** The owner wants Prev / Next always hidden on a direct link even after ask J, or HQ's lookup row gains its position/page.

## Q: A failed direct-link lookup (`Promotions/Campaigns { all, q }`): banner or silent?
**Decision taken:** Silent fallback, except a bare 403, which reads "You do not have access to this action." in the side menu. A failure of the context's own reads (its page, a neighbouring page, `Promotions/List`) always shows there.
**Why:** The brief's fallback is silent; the wave rule says a bare 403 on any door is named, never hidden.
**Revisit if:** The lookup's 403 proves noisy for sessions that can read campaigns but not promotions.

## Q: The lookup's page size
**Decision taken:** 200 (HQ's maximum), one page only; the exact-id row beyond 200 matches falls back.
**Why:** `q` matches part of ids and both names; no screen pages `{ all: true }` (brief's ruled default).
**Revisit if:** Ask J lands and ids prove to share long prefixes at scale.

## Q: Where do Prev / Next land?
**Decision taken:** The same workspace page of the neighbour (Rules → Rules, Settings ▸ Budgets → Budgets), with the context at the page the neighbour is on, so Back opens that page. A campaign not on its context's page (moved, refiltered) hides Prev / Next. A neighbouring page that failed to read leaves the step disabled (`data-step-state="failed"`).
**Why:** Stepping through a promotion's rules is the use the brief describes; the page in the URL must be the one the campaign is on.
**Revisit if:** The owner wants every step to land on the Dashboard.

## Q: The crumb's promotion segment: code or name?
**Decision taken:** The code (a machine value, `Ltr`), read off the URL; "No promotion" for `promotion=` empty.
**Why:** The crumb is derived from the menu and URL without a fetch; an uploaded promotion often has no name.
**Revisit if:** The owner wants the English name (would need `Promotions/List` in the top bar).

## Q: The uploaded-campaign note on a direct link without ask J
**Decision taken:** No note without a context (or ask J): the promotion is not known. Not inferred by scanning `Promotions/List` for an upload whose `<code>-` prefixes the id.
**Why:** The ticket ties the note to "its promotion"; a prefix scan would be a guess while ask J is unbuilt.
**Revisit if:** The owner wants the guard on every path — a prefix scan over `Promotions/List` (uploads only) is sound under HQ's unique-prefix rule.

## Q: Back-link and delete wording / target
**Decision taken:** "To promotion <code>" / "To the campaigns in no promotion" / fallback "To promotions" (was "To campaigns", stale since 534's list). Deleting a draft returns to the same back target, not always `/campaigns`.
**Why:** The way back is the list the user came from.
**Revisit if:** Copy owner prefers other words.

## Q: Where do the promotion read doors live now?
**Decision taken:** `features/campaigns/promotions/api.ts` was git-moved to `src/core/rules/promotion-api.ts` (`rulePromotionApi`, `rulePromotionsQuery`, `rulePromotionCampaignsQuery`); the promotions feature has no `api.ts` until 536 adds its write doors.
**Why:** The workspace reads them too; a feature may not import a feature.
**Revisit if:** 536 prefers its writes in core beside the reads.

## Q: Drive port
**Decision taken:** Drives ran on port 5299 (`DRIVE_PORT`): 5199 was held by a vite serving the MAIN checkout (`C:\Playground\oms-react`), not started by this session, so it was left alone.
**Why:** Never kill a server this session did not start.
**Revisit if:** —
