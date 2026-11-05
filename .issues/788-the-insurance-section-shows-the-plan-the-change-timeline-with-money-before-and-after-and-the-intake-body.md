---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md
blocked-by: 787 (server: BackOffice 3392, 3393)
---

# 788 — The Insurance section shows the plan, the change timeline with money before and after, and the intake body

## What to build

Backend: BackOffice spec 3389 (`C:\Work\DMSCO\BackOffice\.issues\3389-orders-and-erx-are-searchable-in-oms-react-and-an-insurance-order-shows-everything-it-received-and-how-it-was-priced-spec.md`). SIS.Api minimal APIs, System.Text.Json web defaults (camelCase). Same door as 787, filled by BackOffice 3392 (intake body) and 3393 (money before / after).


Below Money and Lines:

- **Plan**: policy, holder, contract, class, member, eligibility, authorization, diagnosis, visit reason, chief
  complaint, days supply, insurer customer and payer; the deductible groups (% and cap).
- **Changes**: a timeline of accepted acts (pick, swap, quantity, void, restore, ceiling) with who, when, item /
  quantity before and after, reason, and money source / patient / insurer before and after; old acts read
  "not recorded"; the document log merged in.
- **Received**: the intake body as formatted, collapsible JSON with copy; "not kept for orders before <date>" when
  absent.

## Spine reach

UI (oms-react)

## Proof (→ `tdd` red-green cycles)

- [ ] `insurance timeline: an old act reads not recorded, not zero` · vitest
- [ ] `insurance timeline: a CHANNEL → ENGINE act is marked` · vitest
- [ ] `received section: an absent intake body says not kept` · vitest

## Boundaries

Read-only.

## Done when

Proof tests green; a dev BUPA order landed after BackOffice 3392 shows its body, and a changed one its money timeline.

## Blocked by

[787](787-document-details-shows-an-insurance-orders-money-verdict-its-lines-how-each-was-priced-and-the-gap-to-engine-money.md); server: BackOffice [3392](C:\Work\DMSCO\BackOffice\.issues\3392-a-stored-insurance-order-keeps-its-intake-body-byte-for-byte.md), [3393](C:\Work\DMSCO\BackOffice\.issues\3393-each-accepted-order-change-records-its-money-source-and-totals-before-and-after.md)
