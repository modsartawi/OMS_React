---
status: done
spec: BO 2737 (brief C:\Work\DMSCO\BackOffice\.issues\assets\2737-oms-react-rule-engine-brief.md)
blocked-by: —
---

# 517 — An HQ admin flips a store's engine with a reason, sees the in-flight warning on a flip back, and reads its history

## What to build

**Admin ▸ Store engine switch** at `/admin/engine-switch` (new feature `features/admin/engine-switch/`)
lists stores with their **engine** (`BonusBuy` or `Rule`, where a missing row reads BonusBuy), changed by and changed at
(local), with a search and an engine filter. **Flip** asks for a **Reason** (required). A line says the flip
takes effect at the store's **next shift open**. **Flipping back to BonusBuy** first shows HQ's **in-flight
warning** (live campaigns, open call-center sessions, store-scope budgets), which **never blocks**. Each store
has its **history** (who, when, from → to, reason).

## Spine reach

model/api (list, flip, history) · logic (flip-back warning step) · component/route (page, dialog,
history pane; router + Admin menu leaf) · i18n (`engine-switch`) · test

## Proof (→ `tdd` red-green cycles)

- [x] `flipForm_requiresReason` · pure — `src/features/admin/engine-switch/helpers.test.ts` (`flipForm` › requires a reason; 9 tests)
- [x] drive: flip to Rule with a reason; flip back shows the in-flight list and proceeds; history row (stubbed) · flow — `tools/engine-switch-drive.mjs` 46/46, every door stubbed

## Boundaries

Provisional endpoints + a new Ua permission (BackOffice 2745; owner grant owed), stubbed. The menu leaf is gated by an
access probe once the permission exists, and until then the server refusal is shown through `apiErrorMessage`.

## Done when

The drive flips a store both ways with a reason and shows its history.

## Blocked by

None — can start immediately.

## Open questions

- The permission name and who holds it are owner decisions after BackOffice 2745 seeds them.

## Comments

**Done 2026-10-17 (AFK).** `features/admin/engine-switch` at `/admin/engine-switch`, leaf last in Admin (ungated
by ruling). Doors PROVISIONAL in the feature's `api.ts` (`StorePromotionEngine/Stores|InFlight|Flip|History`),
types `StoreEngine*` in `rule-campaign.ts`. The flip back reads `InFlight` as its first step, before the reason;
a failed check still lets the admin continue. The flip sends `from` (the engine seen) so HQ can refuse a
flip another admin has overtaken. Gates: typecheck, lint (4/4), vitest 5497/5497, build all green.

Outstanding (not AFK): live doors (520 / BackOffice 2745) and the Ua grant; owner sign-off on the Open
question and on the defaults in `.afk/HITL-517.md` (the warning as a pre-check vs 2745's "flip returns a
warning payload"; no per-row pending marker); an owner eyeball of RTL.
