---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: — (contract + live: BackOffice 3211)
---

# 665 — An HQ user lists HungerStation promotions and reads one with its parts, stores, items and sends

## What to build

**Slice 0 of HungerStation promotions** (BackOffice spec 3201, ADR 0114). Use the glossary words
**HungerStation promotion** and **HungerStation promotion part** (BackOffice `CONTEXT.md`). Never say
"deal", "offer", "campaign" or bare "bundle"; those belong to the rule engine. A promotion is made here
and **sent** to HungerStation, and our pricing never applies it.

- **Registration**
  - A new feature `features/hungerstation/promotions`, namespace `hungerstation-promotions` in EN and
    AR, route `/hungerstation/promotions`.
  - A **Promotions** entry in the existing HungerStation menu group, shown when the Access probe's new
    `canManagePromotions` flag is true.
- **Shared, in core:** extend `core/models/hungerstation.ts` with types for **every** promotion door of
  the contract, field for field. Later tickets fill in their sections as BackOffice adds them.
- **List page** (AG Grid, server-paged): name, chain, type (strikethrough / same-item bundle), status,
  window (local start and end), store count, SKU count, last sent at/by. Filters (chain, status, type,
  name text) round-trip through the URL.
  - Status words: Draft, Sending, Live, Live with refusals (BackOffice: "Live, partly refused"),
    Failed, Switched off, Replaced, Scheduled, Ended. Scheduled and Ended come from the window, as the
    server sends them.
- **Detail** (side sheet or page, `?promotion=` in the URL), read-only in this ticket:
  - the header (name, EN/AR display names, HS reason, limits, window);
  - its **parts**, each with the name sent to HungerStation and its latest job status;
  - its stores (code, name, vendor id as sent);
  - its items (material, SKU, subtype, value, max quantity, part);
  - every send (when, who, reason, HTTP status, job status).

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md`
(written by BackOffice 3211). **It does not exist yet.** Until it lands, build against the doors spec
3201 lists (Implementation Decisions → Doors) and re-check every field against the contract before
closing.

## Spine reach

UI → app (BackOffice doors, stubbed until BackOffice 3218's walk)

## Proof (→ `tdd` red-green cycles)

- [ ] `promotionStatusLabel`: every status word, EN and AR, and an unknown status shown as itself, never blank (vitest)
- [ ] `layout/menu-hungerstation.test.ts`: the Promotions entry hidden when `canManagePromotions` is false, shown when true; fail closed on a 403 (vitest)
- [ ] `tools/hungerstation-promotions-drive.mjs`, against stubs, LTR and RTL: list, filters ⇄ URL ⇄ door, detail opens from the URL, parts/stores/items/sends render with the contract's fields exactly
- [ ] `npm run typecheck`, `npm run lint` (boundaries), `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant
(`HungerStationPromotions`) is the real boundary. Stubs use the real envelope `errors[]` shape and emit
**exactly** the contract's fields.

## Done when

The helpers and the drive are green, the page renders from stubs, and the types match the contract
asset once BackOffice 3211 has written it.

## Blocked by

None for building against stubs. The contract asset arrives with BackOffice 3211.
