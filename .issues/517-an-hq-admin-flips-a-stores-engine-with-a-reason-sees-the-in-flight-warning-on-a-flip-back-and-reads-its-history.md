---
status: open
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

- [ ] `flipForm_requiresReason` · pure
- [ ] drive: flip to Rule with a reason; flip back shows the in-flight list and proceeds; history row (stubbed) · flow

## Boundaries

Provisional endpoints + a new Ua permission (BackOffice 2745; owner grant owed), stubbed. The menu leaf is gated by an
access probe once the permission exists, and until then the server refusal is shown through `apiErrorMessage`.

## Done when

The drive flips a store both ways with a reason and shows its history.

## Blocked by

None — can start immediately.

## Open questions

- The permission name and who holds it are owner decisions after BackOffice 2745 seeds them.
