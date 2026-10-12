---
status: open
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

- [ ] `storeState`: a `null` location reads as onboarded-not-linked, a location as linked (vitest)
- [ ] `reasonField`: 1–200 characters, unicode kept; DLV-00009 is shown inline (vitest)
- [ ] `tools/deliverect-stores-drive.mjs`, against stubs, LTR and RTL:
  - onboard, move and remove;
  - the warning path;
  - the refusals;
  - the menu entry hidden when `canManageStores` is false.
- [ ] `npm run typecheck`, `npm run lint` (boundaries), `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green, and the page renders from stubs.

## Blocked by

None. It can start immediately (live: BackOffice 2616).
