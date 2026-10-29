---
status: open
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

- [ ] `refusalsByStore`: groups the three lists per store and counts them; empty → no section (vitest)
- [ ] drive (LTR + RTL), against stubs: partly refused detail renders all three lists; Resend body with reason; disabled while Sending; the Sending → Live re-read
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only. The page's light poll runs only while a detail with a Sending part is open.

## Done when

A partly refused promotion reads clearly from stubs and a part resends.

## Blocked by

[665](665-an-hq-user-lists-hungerstation-promotions-and-reads-one-with-its-parts-stores-items-and-sends.md)
