# HITL — 517 (Admin ▸ Store engine switch)

I re-read the brief at the start of 517. It still has **no contract section**, and BackOffice 2745 is unbuilt. So the doors are provisional and all live in `src/features/admin/engine-switch/api.ts`:
- `GET StorePromotionEngine/Stores`
- `GET StorePromotionEngine/InFlight?storeCode=`
- `POST StorePromotionEngine/Flip`
- `GET StorePromotionEngine/History?storeCode=`

The shapes are `StoreEngine*` and `PromotionEngine` in `rule-campaign.ts`. The stubs are in `tools/engine-switch-drive.mjs`.

## Q: Where does the flip-back warning come from: a check before the flip, or the flip's own answer?
**Decision taken:** A separate read, `GET StorePromotionEngine/InFlight`, is shown as the first step of the flip-back dialog. The flip answers only the store's row.
**Why:** The ticket says the flip back "first shows HQ's in-flight warning", which is before the admin commits. 2745 says the flip "returns a warning payload", which is after. A warning shown after the flip cannot inform the decision.
**Revisit if:** 2745 only puts the warning on the flip's answer. In that case 520 must either get a dry-run door or show the warning after the flip. Today a warning on the flip answer would be dropped.

## Q: Does a failed in-flight check stop a flip back?
**Decision taken:** No. HQ's error message is shown, and Continue stays enabled.
**Why:** The warning "never blocks" (DECIDED).

## Q: Does the flip carry the engine the admin saw?
**Decision taken:** Yes. The body is `{ storeCode, from, engine, reason }`. `from` lets HQ refuse a flip that another admin has already overtaken. Any refusal is shown verbatim with its code.
**Why:** The built-in /code-review flagged a race. Without `from`, a stale screen could record a Rule→Rule "flip" with a reason, and skip the warning the real state needed.
**Revisit if:** 2745 does not want the check. The field is harmless to ignore, and 520 can drop it.

## Q: After a flip, does the row show the new engine or a "pending" state?
**Decision taken:** The row shows the engine HQ now holds. The "takes effect at the next shift open" line appears on the page lede, in the dialog and in the success toast. The row gets no separate pending marker.
**Why:** The client cannot know whether the store has opened a shift since the flip. The prototype's pending note was a local mock.
**Revisit if:** 2745 answers an "effective from" or "pending" field. That would become a per-row note.

## Q: Is the leaf gated?
**Decision taken:** No accessProbe, as ruled for this wave. The page shows the server's refusal through `apiErrorMessage`.
**Why:** 2745's Ua permission is not seeded yet. The permission name and its holders are an owner decision (the ticket's Open question).
**Revisit if:** 520 adds the probe.

## Outstanding (not AFK)
- Live doors (ticket 520 / BackOffice 2745) and the owner's Ua grant.
- Owner sign-off on the defaults above.
- Under the Arabic UI, the screen's chrome is English (an en-only namespace, as ruled). A live campaign's EN + AR names are both shown in the warning. An owner eyeball of the RTL rendering is still owed.
