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

- [x] `insurance timeline: an old act reads not recorded, not zero` · vitest
- [x] `insurance timeline: a CHANNEL → ENGINE act is marked` · vitest
- [x] `received section: an absent intake body says not kept` · vitest

## Boundaries

Read-only.

## Done when

Proof tests green; a dev BUPA order landed after BackOffice 3392 shows its body, and a changed one its money timeline.

## Blocked by

[787](787-document-details-shows-an-insurance-orders-money-verdict-its-lines-how-each-was-priced-and-the-gap-to-engine-money.md); server: BackOffice [3392](C:\Work\DMSCO\BackOffice\.issues\3392-a-stored-insurance-order-keeps-its-intake-body-byte-for-byte.md), [3393](C:\Work\DMSCO\BackOffice\.issues\3393-each-accepted-order-change-records-its-money-source-and-totals-before-and-after.md)

## Comments

**2026-11-05 — built, stubbed (impl/788).** Plan, Changes and Received sit below Lines in the Insurance section,
from the same 3390 read. Pure models beside 787's: `insurance-plan.ts`, `insurance-timeline.ts`,
`received-section.ts` (+ tests; the three Proof tests live in `insurance-timeline.test.ts` and
`received-section.test.ts`); parts `InsurancePlanPart`, `InsuranceChangesPart`, `InsuranceReceivedPart`. EN + AR
keys under `document:insurance.{plan,changes,received}`, mirrored and checked in `insurance-i18n-keys.test.ts`.

- **Changes:** an act with `moneyBefore/After: null` (or an empty `moneySource`, 3393's open question) reads
  "Not recorded", never 0; a `CHANNEL` → `ENGINE` act is highlighted and says it left the channel's money. The
  document log: used as the read sends it when the timeline carries `kind: 'log'` rows; otherwise the page's own
  `documentApi.getLogs` rows are merged in, oldest first (never both, so no double rows).
- **Received:** the intake body as a folding JSON tree (native `<details>`, values kept byte for byte), one ltr
  island; Copy (`core/ui` Button + `copyText`) takes the verbatim body. A non-JSON body is shown as received.
  Not kept: "Not kept for orders before <date>" (date in `Ltr`), or a dateless sentence while `keptSince` is null.
- Fixtures: `insurance-1006358459.json` now carries a plan, a server-merged timeline and a kept body;
  new `insurance-1006358461-changed.json` (old act not recorded, SWAP CHANNEL → ENGINE, intake not kept since 2026-11-04).
- `tools/insurance-section-drive.mjs` extended (Plan, Changes, Received, copy to clipboard, fold): 58/58 LTR + RTL.
  The 787 "no control" check is now "its one control is Copy".

**Live check waits on BackOffice 3392 / 3393** (and 3390): a dev BUPA order landed after 3392 showing its body,
and a changed one its money timeline. Contract guesses carried from the 3389 notes: the timeline's log merge and
field names, the not-recorded marker, `keptSince`.
