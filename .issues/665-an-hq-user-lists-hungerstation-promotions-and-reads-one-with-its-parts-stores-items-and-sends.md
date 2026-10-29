---
status: done
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

- [x] `promotionStatusLabel`: every status word, EN and AR, and an unknown status shown as itself, never blank (vitest)
- [x] `layout/menu-hungerstation.test.ts`: the Promotions entry hidden when `canManagePromotions` is false, shown when true; fail closed on a 403 (vitest)
- [x] `tools/hungerstation-promotions-drive.mjs`, against stubs, LTR and RTL: list, filters ⇄ URL ⇄ door, detail opens from the URL, parts/stores/items/sends render with the contract's fields exactly
- [x] `npm run typecheck`, `npm run lint` (boundaries), `npm test` green

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant
(`HungerStationPromotions`) is the real boundary. Stubs use the real envelope `errors[]` shape and emit
**exactly** the contract's fields.

## Done when

The helpers and the drive are green, the page renders from stubs, and the types match the contract
asset once BackOffice 3211 has written it.

## Blocked by

None for building against stubs. The contract asset arrives with BackOffice 3211.

## Comments

- 2026-10-29 (built, `impl/665`): **done against stubs only — no BackOffice door exists and the
  contract asset (BackOffice 3211) has not been written**, so "done" here is vitest + typecheck +
  lint + the drive against stubbed envelopes (real `errors[]` shape), never a live call.
  - **Registration:** `features/hungerstation/promotions` at `/hungerstation/promotions`, namespace
    `hungerstation-promotions` EN + AR (6 Arabic plural forms, mirror test), Promotions leaf in the
    HungerStation group on the new `canManagePromotions` flag (`core/hungerstation/access`, fails
    closed like the other three).
  - **Core models** (`core/models/hungerstation.ts` § Promotions, marked PROVISIONAL): every door of
    spec 3201 § Doors — list/query/page, detail (header, parts with refusals, stores, items, sends),
    stores picker, save body (create + PUT edit), Check result (header/row problems, price warning,
    part preview), reason body (Send/SwitchOff/Resend), RemoveItems, Replace — plus the refusal codes
    `DHS-00016…00021` in the order the spec lists them.
  - **List** (server-paged, 100/page) + **read-only detail** side sheet on `?promotion=`.
  - **Drive** `tools/hungerstation-promotions-drive.mjs`: 82/82 (LTR + RTL). Its stub server is a
    `DOORS` table, one entry per door; the write doors answer `501 NOT_STUBBED` until 666–671 fill
    them; scenarios can override a door via `open(dir, { doors })`. § 0 parses the model file and
    proves every fixture emits exactly its interface's fields.
  - **Open questions for the contract (BackOffice 3211):** (1) wire spelling of the status values
    (assumed camelCase `livePartlyRefused` etc.) and of type/subtype/reason/job status (assumed
    HungerStation's upper-case names); (2) EN status word: the ticket says "Live with refusals",
    BackOffice says "Live, partly refused" — built as the ticket says; (3) refusal code numbers
    00016–00021 assumed in spec order (00021 = edit needs Replace, from BO 3215); (4) the detail
    does not carry request/result bodies — assumed kept server-side only; (5) the chain filter uses
    `Chains`, which rides `canManageStores` — a promotions-only user gets the chains seen on rows;
    666's chain picker needs a door its own grant can read.

- 2026-10-29 (reconciled to the contract, `impl/3201-review`): **reconciled to the BackOffice door contract on 2026-10-29** (`C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md`, BO 3211–3216 done). Shapes are now field for field the asset (`core/models/hungerstation.ts`; the drive's § 0 parses the asset's JSON examples and fails on any drift). **Still stubs only — no live SIS.Api call has been made.** Each "decision" below follows the contract over this ticket and is overrulable by the owner.
  - List row: `itemCount`, `updatedAt` / `updatedBy`, `sentAt` (was `skuCount`, `lastSentAt` / `lastSentBy`); columns follow. `take` 50, at most 200 (was 100/500); paging now steps by 50.
  - Detail: `replacesPromotionId` / `replacedByPromotionId`, `currencyKey`; a part is `partNo`, `combination` (`"ALL"` / `"B2G1|PERCENTAGE|50"`, parsed for the buy/get and discount columns), its own `status`, `refusals`; its SKU count is now counted from its active items. A send is `kind` `UPSERT` / `SWITCH_OFF`, `attempts` / `lastAttemptAt`, raw `result`; an item `rowNo`, `subtype` / `value` nullable (as entered); a draft's times may be `null`.
  - **Decision (overrulable): no type filter.** The contract's list door takes no `type`; the Type select is gone and a `type=` URL key is ignored. If the owner wants it, it is a BackOffice ask (`GET Promotions?type=`).
  - **Decision (overrulable): ONE status.** The door takes one `status` (`any` the default): the chips are single-select with an "Any status" chip; an older link with several `status=` keeps the first it names. EN word kept: "Live with refusals".
  - The job status is OPEN (an unlisted one such as `IN_PROGRESS` is shown as sent, in motion). The write lock and the light poll follow the PROMOTION's status `sending` (review B3) — not "some part QUEUED".
  - Review C4: `core/hungerstation/access.ts` says four flags.
