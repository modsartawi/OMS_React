---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 665 (live: BackOffice 3214)
---

# 669 — A promotion HungerStation partly refused shows what did not take, per store, and a part is resent

## What to build

- The detail shows each part's **refusals** from HungerStation's answer:
  - stores HungerStation called invalid (our store code + vendor id);
  - materials HungerStation could not find, per store;
  - materials whose promo price HungerStation found above list, per store.

  Each list is copyable and filterable by store.
- A promotion with any refusal reads **Live with refusals**, with a list filter for it.
- **Resend** on a part, with a reason, re-sends it unchanged, for example after the next stock sync has
  listed a missing material. It is disabled while the part is Sending.
- A part HungerStation never answered within 24 hours shows as "no answer from HungerStation", with
  Refresh.
- HungerStation's own timestamps are shown in local time, as the server sends them.

The status follows on its own (the server polls every minute). The page re-reads the detail while any
part is Sending (a light poll, e.g. every 15 s, only while the detail is open).

Wire shapes: the contract's read (refusals) and Resend sections (added by BackOffice 3214).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [x] `refusalsByStore`: groups the three lists per store and counts them; empty → no section (vitest)
- [x] drive (LTR + RTL), against stubs: partly refused detail renders all three lists; Resend body with reason; disabled while Sending; the Sending → Live re-read
- [x] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The page's light poll runs only while a detail with a Sending part is open.

## Done when

A partly refused promotion reads clearly from stubs and a part resends.

## Blocked by

[665](665-an-hq-user-lists-hungerstation-promotions-and-reads-one-with-its-parts-stores-items-and-sends.md)

## Comments

- 2026-10-29 (built, `impl/669`): **done against stubs only. No BackOffice door exists, and the
  contract asset has no read (refusals) or Resend section yet (BackOffice 3214).** So "done" here means
  vitest + typecheck + lint + the drive green against stubbed envelopes (real `errors[]` shape). Nothing
  was called live.
  - **Refusals:** `part-refusals.ts` `refusalsByStore` regroups a part's `invalidVendors`,
    `missingSkus` and `invalidDiscountedSkus` per store. Stores sort by code; a vendor id that no
    longer resolves goes last as `vendor:<id>`. Each list is counted, and an empty or `null` result
    returns `null`, so no section is drawn. `PartRefusals.tsx` shows one block per refused part: a store
    filter that narrows all three lists, and a Copy per list. Copy writes tab-separated store, vendor,
    material and SKU, as filtered, with no isolates.
  - **Live with refusals:** the status word and list chip came with 665 (`livePartlyRefused`). The drive
    now proves the chip sends `status=livePartlyRefused`.
  - **Resend:** `promotionsApi.resend` sends `POST …/Parts/{partId}/Resend { reason }` through
    `ResendDialog`, the area's reason dialog. The returned detail is put into the sheet's cache straight
    away. DHS-00017 stays in the dialog and re-reads the detail. Resend appears on a part that is sent
    and active, and is disabled while that part is Sending (`QUEUED` and not `unanswered`).
  - **24 hours:** the job word is now "No answer from HungerStation" (was "Unanswered"), with a hint
    pointing to Refresh. **The Refresh button itself is 666's** and is not built here.
  - **HS timestamps:** the sends table gains "HungerStation received / updated" (`hsCreatedAt` /
    `hsUpdatedAt`), shown as sent (already local).
  - **Light poll:** the detail query's `refetchInterval` is `promotionPollInterval`: 15 s while any part
    is Sending, otherwise off. It lives only while the sheet is open. An unanswered part does not poll,
    because the server has stopped polling it.
  - **Drive** 133/133 (665’s 82 + 669’s), § 6 (its own section, door overrides only, the `DOORS` table is untouched), LTR + RTL.
    Two 665 checks were updated for the renamed word and the two new send columns.
  - **Open questions:** (1) spec 3201 § Doors refuses *any* write while *any* part is Sending, but this
    ticket and BO 3214 say "while **that** part is Sending". I built it per part, and the server's
    DHS-00017 covers the wider rule. (2) Should Resend be offered on an *unanswered* part, or only
    Refresh? It is offered now. (3) Wire spelling of the three refusal lists and of `unanswered` waits
    on 3214's contract section.
