---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: — (live: BackOffice 2616)
---

# 477 — An HQ user onboards a store on a Deliverect account and sees its link

## What to build

**Slice 0 of the Deliverect area** (BackOffice spec 2615). Use the glossary words **Deliverect
account**, **Deliverect store** and **delivery platform**, never "channel" or "chain".

- **Registration**
  - A new area `features/deliverect/` with the feature `stores`.
  - The namespace `deliverect-stores` in EN and AR.
  - The route `/deliverect/stores`.
  - A **Deliverect** menu group gated by `accessProbe` on `DeliverectWeb/Access`. It holds an entry
    for each probe flag (`canManageStores`, `canManageCatalog`, `canViewOrders`,
    `canManageTerms`), with placeholders that 478–482 fill in.
- **Shared, in core:** `core/models/deliverect.ts`, with types for **every** contract door, field
  for field. The probe call also lives in core.
- **Stores page** (AG Grid):
  - Columns: store, name, account, Deliverect location, onboarded at/by, linked at, and the
    direct-HungerStation badge.
  - The state reads **Linked** or **Onboarded, not linked**.
  - Filters: account, linked (any / yes / no) and text.
  - The `sync` and `status` columns are rendered when present and hidden when `null`. 480 and 481
    fill them in.
- **Onboard** dialog: store and account, with a mandatory reason.
  - The DLV-00002 and DLV-00003 refusals show inline.
  - The direct-HungerStation warning is shown as a **warning**, not an error.
- **Move** to another account, and **remove** onboarding, each with a reason and a confirmation
  that says the link will be cleared.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md` (Common, Access, Stores).

## Spine reach

UI → app (BackOffice doors, stubbed until 483)

## Proof (→ `tdd` red-green cycles)

- [x] `storeState`: a `null` location reads as onboarded-not-linked, a location as linked (vitest)
- [x] `reasonField`: 1–200 characters, unicode kept; DLV-00009 is shown inline (vitest)
- [x] `tools/deliverect-stores-drive.mjs`, against stubs, LTR and RTL:
  - onboard, move and remove;
  - the warning path;
  - the refusals;
  - the menu entry hidden when `canManageStores` is false.
- [x] `npm run typecheck`, `npm run lint` (boundaries), `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green, and the page renders from stubs.

## Blocked by

None. It can start immediately (live: BackOffice 2616).

## Comments

**2026-10-12 — built AFK (done).** Proof, all green and all against STUBS of the contract (no door is deployed):

- vitest: `features/deliverect/stores/store-state.test.ts` (`storeState`, optional columns, URL ⇄ query, account choices, onboard warning), `core/deliverect/reason.test.ts` (`reasonField` 1–200 trimmed, unicode kept, UTF-16 count; DLV-00009 / field refusals), `core/deliverect/access.test.ts` (four flags, fail closed), `layout/menu-deliverect.test.ts` (group last, one key), `features/deliverect/stores/i18n-keys.test.ts` (en ⇄ ar mirror, six Arabic plural forms), `core/api.test.ts` (`api.postEnvelope`). Full suite 271 files / 4787 tests.
- `DRIVE_PORT=5196 node tools/deliverect-stores-drive.mjs` — **67/67**, LTR and RTL: menu (last, one leaf, one probe call, hidden without `canManageStores`, denied card), list + state labels, sync/status hidden on null and shown on populated fixtures, filters ⇄ URL ⇄ door, onboard / move / remove bodies, the warning path, DLV-00001/2/3/9 inline, the Accounts-403 fallback.
- `npm run typecheck`, `npm run lint` (4 gates), `npm run build` green.

Shared pieces in core for 478–482: `core/models/deliverect.ts` (every door), `core/deliverect/api.ts` (probe, Accounts, Platforms), `access.ts`, `reason.ts`, `ReasonDialog.tsx` (+ `InlineRefusal`); `api.postEnvelope` added to `core/api.ts`.

**Outstanding (not AFK's):** the live doors on staging (483); an owner's eye on the Arabic rendering (the app's `lng` is still `en`, so the RTL pass proves direction and isolation only); owner sign-off on the rulings logged in `.afk/HITL-477.md` (menu labels-not-leaves — the ticket's "an entry for each probe flag" was ruled to mean labels; Arabic for the namespace; the Accounts-403 fallback; the persistent warning banner; the UTF-16 reason count). Contract gaps (Accounts behind `canManageTerms`; move/remove refusals and answer shapes) are logged there under `## Contract gap`.
