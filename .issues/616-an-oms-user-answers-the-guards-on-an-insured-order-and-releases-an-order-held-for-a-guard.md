---
status: done
spec: BO 3126 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3126-oms-react-insurance-rules-brief.md)
blocked-by: 607
---

# 616 — An OMS user answers the guards on an insured order and releases an order held for a guard check

## What to build

On an insured OMS / delivery order, the same per-line guard dialog as the till: REFUSE → remove or change;
WARN → tick; OVERRIDE → intervention / outcome / reason with the `INS_GUARD` grant. The order list shows "guard
check: action needed" and "guard check pending"; a user with the release grant releases a held order.

**HQ contract:** the brief's sections for BackOffice 3142, BackOffice 3143. Build against those shapes, stubbed in the drive; a shape the
BackOffice ticket changes is recorded in the brief and reconciled in the live-doors ticket.

Reference look: [Insurance Rules Builder](https://claude.ai/code/artifact/5qwrpEcu9o6ThdwsQphb4y)
(`C:\Work\DMSCO\BackOffice\.scratch\proto\3096-insurance-rules\index.html`).

## Spine reach

components (in the existing orders area via a shared core piece) · test

## Proof (→ `tdd` red-green cycles)

- [x] `guardAnswer_requiresTriadForOverride` — pure (`src/core/insurance-rules/guard-answer.test.ts`)
- [x] drive (stubbed) — `tools/insurance-order-guards-drive.mjs` 96/96, LTR + RTL

## Boundaries

Touches the orders feature — the dialog lives in `core/` so features don't import features. Rules: `feature-structure`, `i18n-zero-literal`, `logical-tailwind`, `api-envelope`, `bidi` (patient keys and codes `Ltr`, Arabic text `<bdi>`). Local time only.

## Done when

Gates green; drive passes.

## Blocked by

[607](607-the-insurance-rules-area-lists-guard-rules-by-folder-with-their-flags-and-opens-a-rule-rea.md)

## Comments

**2026-10-27 — built on `impl/3126-616`.** Proof: `src/core/insurance-rules/guard-answer.test.ts`
(guardAnswer_requiresTriadForOverride + REFUSE/WARN/exception/no-grant/cap cases), `order-guards.test.ts` (grants,
held), `order-guards-i18n.test.ts` (en/ar mirror, six Arabic plural forms, every built key); drive
`tools/insurance-order-guards-drive.mjs` 96/96 STUBBED (LTR + RTL). Typecheck, lint, vitest green.

**Where it lives (no feature imports a feature):** `core/insurance-rules/guard-check.ts` (check / reasons / answer
shapes), `guard-answer.ts` (pure form rules), `GuardDialog.tsx`, `OrderGuardPanel.tsx` (state pill, Answer, Check
again, Release), `GuardStateCell.tsx` (list cell), `order-guards-api.ts` (doors), `order-guards.ts` (grants).
Hooks into the OMS features: a "Guard check" column in `features/oms/deliveries/columns.ts` and the panel on
`features/oms/document/DocumentDetailsPage.tsx`. Namespace `insurance-order-guards`. Stubs: `orderGuardsStub`,
`GUARD_REASONS`, `ORDER_GUARDS_HELD` / `_RECHECKED`, `ORDER_GUARD_LINES` in the `// --- 616 ---` section.

**Guesses where the brief is silent (618 reconciles):**
- ~~Order doors spelled `SdDocumentWeb/Document/{no}/Guards/Recheck|Release`~~ — amended by the 3126 review (P1):
  the doors take the brief's spelling `Oms/Orders/{id}/Guards/Recheck|Release`; GUESS: `{id}` is the document
  number. Recheck is read to answer the new `guards`.
- Grants read as two more optional flags of `GET SdDocumentWeb/Access`: `canOverrideGuard` (`INS_GUARD`) and
  `canReleaseGuardHold`. Absent reads as denied. The brief names the grants but no probe.
- The order DETAIL carries `guardState` and `guards` (the brief gives `guardState` to list/find-by-id rows only).
- `GET Guards/Reasons` `accepts` is keyed by RULE id → reason codes it takes (a rule absent asks no reason); `caps`
  keyed by reason code → uses left. A capped code is greyed once other lines' picks use it up.
- A fired rule's `suggestion` takes the template's `suggest` shape (`maxQuantity` / `maxDaysSupply`).
- Release body `{ reason }`, reason required (core `ReasonDialog`). Order states: `none | actionNeeded | pending |
  unchecked`; `unchecked` shown as "Guard check: not checked".
- Without `INS_GUARD` an OVERRIDE reads like a REFUSE ("remove or change this line"); Send stays off.


**2026-10-27 — 3126 review (P1, P2).** Order doors now take the brief's spelling `POST Oms/Orders/{id}/Guards/Recheck`
and `…/Guards/Release` (GUESS: `{id}` is the document number). The guard dialog offers **Apply** on a fired rule
with a suggestion (stories 6 / 35): applied, the rule is answered as a CHANGE — GUESS `{ line, ruleId, change: {
maxQuantity | maxDaysSupply } }`, the fired rule's `suggestion` as sent — with no triad and no `INS_GUARD` (the line is
changed, not overridden); Undo takes it back. Proof: `guard-answer.test.ts`
(guardAnswer_appliedSuggestion_isAChangeAnswer), drive step 7.
**Owner ruling needed:** a REFUSE line still disables Send for the WHOLE order (`guard-answer.ts`: a REFUSE item keeps
the problem `remove`, and `ready` needs no open item), where stories 36 / 49 say "the rest of the request still
going". Left as built (applying a suggestion on a refused line now lets it go on); the owner rules whether the other
lines may be answered and sent while a line is refused.
