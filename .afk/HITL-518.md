# HITL — 518 (Campaigns ▸ Sessions: support's customer sessions)

I re-read the brief at the start of 518. It still has **no contract section**, and BackOffice 2760 is unbuilt. So the doors are provisional and live in `src/core/rules/api.ts`:
- `GET RuleCampaign/Sessions?store=&date=&status=`
- `GET RuleCampaign/Sessions/{saleId}`
- `GET RuleCampaign/SessionAccess`
- `POST RuleCampaign/Sessions/{saleId}/Cancel`

The shapes are `RuleSession*` in `rule-campaign.ts`. The stubs are in `tools/sessions-drive.mjs`.

## Q: How does the page know the reader may cancel?
**Decision taken:** It reads a separate `RuleCampaign/SessionAccess` door, which answers `{ canCancel }`. It is not under `Sessions/`, because a sale id could be the word `Access`. The door fails closed: if it refuses or errors, no Cancel button is drawn and no message is shown. The cancel door still refuses on its own.
**Why:** 2760 seeds a new Ua permission, and the page must draw Cancel "only to support holding the permission". This copies 511's `RuleCampaign/Roles` pattern.
**Revisit if:** 2760 folds the right into `RuleCampaign/Roles` or onto the session's own answer.

## Q: Which statuses offer Cancel?
**Decision taken:** Every status except `cancelled` and `returned`. A fully returned session has nothing left to roll back. HQ still refuses any cancel it will not do.
**Why:** This is the conservative choice. The prototype hid Cancel only on cancelled sessions.
**Revisit if:** Support must be able to cancel a returned session (for example to undo a wrong return), or should not cancel an `open` or `paying` one.

## Q: Does a cancel ask for a reason?
**Decision taken:** No. It is a confirmation only, as the ticket says ("asks for confirmation") and as the prototype does. The POST body is `{}`.
**Why:** The ticket does not ask for a reason. The engine switch's "Reason required" is a different door.
**Revisit if:** 2760 wants an audit note on a support cancel.

## Q: Is a store required to list sessions?
**Decision taken:** Yes. Nothing is listed or asked for until a store is chosen. The day defaults to the local today and is read on each render, so a page left open past midnight moves to the new day. Lookup by sale id works for any store.
**Why:** One store and one day keeps the list bounded. The ticket says "by store, date and status".
**Revisit if:** Support wants an all-stores day view. That would need paging on the door.

## Q: What happens to the rollback after the cancel?
**Decision taken:** HQ's rollback answer is shown on the page (budgets released, coupon uses refunded, created codes disabled, points reversed) until the reader leaves. After a reload, the Events tab still shows the cancel call and the movements HQ recorded for it. The panel itself is not stored.
**Why:** The ticket says the cancel "then shows the rollback". The movements are the durable record.
**Revisit if:** 2760 answers the rollback on the session read, so it can be redrawn later.

## Q: Which list holds a hold?
**Decision taken:** `holds[]` holds `held` and `released` hold entries. `budgets[]` holds counter events (`committed`, `released`). They share one `RuleSessionBudgetMove` shape, documented on `RuleSession`.
**Why:** 2760 lists "holds" and "budget events" as separate things.
**Revisit if:** 2760 merges them. If HQ put a hold in both lists, Events would show it twice.

## Q: Where does Back from a session go?
**Decision taken:** Back goes to the list as it was left (store, day and status), passed as router state. If the session was opened from a bare link, Back goes to the list of the session's store and its created day.
**Why:** It keeps support's place.

## Not built (prototype only)
- "Load the basket into the simulator": the simulator has no URL basket input yet. A cross-feature jump would need one.
- Under the Arabic UI the screen's chrome is English (an en-only namespace, as ruled). The marketer's EN + AR pairs are both shown; an owner eyeball of the RTL rendering is still outstanding.

## Review notes left open
- `/code-review`: a campaign coded `sessions` is shadowed by the static leaf. This also applies to `priority` and `simulator`; it follows the layout ruling.
- `/code-review`: the access door fails silently, by ruling.
- `/standards-review` judgement calls left as they are:
  - the grid defaults are repeated across three small grids;
  - `<bdi dir="ltr">` Trans slots are used rather than `<Ltr />`, as the simulator does;
  - the feature folder is `sessions` but the namespace is `rule-sessions`. The brief names the namespace, and it follows `rule-simulator`.
- Vocabulary: **Customer session** has been added to CONTEXT.md.
