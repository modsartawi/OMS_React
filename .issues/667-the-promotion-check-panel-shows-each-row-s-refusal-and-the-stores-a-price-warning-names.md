---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3201-hungerstation-promotions-are-made-on-oms-react-and-sent-to-hungerstation-spec.md
blocked-by: 666 (live: BackOffice 3212)
---

# 667 — The promotion check panel shows each row's refusal and the stores a price warning names

## What to build

A **Check** panel in the editor (`POST Promotions/{id}/Check`), run on demand and before Send.

- **Refusals** per row and per header field, in words:
  - material not on the HungerStation material list, or disabled or deleted there;
  - a percentage outside 1–100, a non-positive value, more than 3 decimals;
  - start not before end, end already past;
  - EN or AR display name missing;
  - the name already used on this chain;
  - more than 20,000 SKUs;
  - no stores.
- **Warnings** (a different colour; they never block): a final price or amount-off not below our
  price at some stores, naming those stores. Use the words "HungerStation will refuse this material at
  these stores", not "error".
- Send is disabled while Check reports any refusal. Warnings do not disable it.
- The preview grid marks each refused row, and a filter shows refused rows only.

Wire shapes: the contract's Check section (added by BackOffice 3212).

## Spine reach

UI → app (BackOffice doors, stubbed)

## Proof (→ `tdd` red-green cycles)

- [ ] `checkSummary`: refusals block Send, warnings never do; per-row grouping (vitest)
- [ ] drive (LTR + RTL), against stubs: each refusal code renders on its row/field; a price warning lists its stores; Send disabled then enabled after a fix
- [ ] `npm run typecheck`, `npm run lint`, `npm test` green

## Boundaries

oms-react only.

## Done when

Every Check refusal and warning in the contract renders from stubs, and Send follows them.

## Blocked by

[666](666-an-hq-user-makes-a-strikethrough-promotion-pasted-from-excel-and-sends-it-to-hungerstation.md)
