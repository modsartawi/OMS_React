---
status: done
spec: BO 3271 (brief C:\Work\DMSCO\BackOffice\.issues\assets\3271-oms-react-fhir-insurance-rules-brief.md)
blocked-by: 699
---

# 701 — Monitors take the communication and payment scopes

## What to build

Stories 43, 44; A11; doors 3299, 3300. A monitor can choose scope `communicationRequest` (reason, category and a
payload-text-present flag, never its content) or `paymentReconciliation` (per detail: payment, early fee, Nphies fee and
amount). The catalog offers each scope's facts. The editor says that every payment fact reads unknown when a detail
matches no auth, or matches ambiguously.

## Spine reach

model (scopes) · store/logic (facts per scope) · component (scope picker, note) · i18n (en + ar) · test (pure + drive)

## Proof (→ `tdd` red-green cycles)

- [x] each scope offers only its own facts, and no `$previous` where the door has none — pure
- [x] write and save one monitor on each scope — flow

## Boundaries

These scopes ship last in BackOffice, each gated on its own census run, so this ticket may go live after the others.
Doors stubbed; 711 reconciles.

## Done when

An author can watch payer communications and payments, and no screen shows communication content.

## Blocked by

699.

## Comments

**2026-10-30, built, all stubbed (no live SIS.Api).** Pure proofs in `core/insurance-rules/monitor-scopes.test.ts`; drive 62/62 in LTR and RTL (RTL is direction only, the Arabic words are proved against the locale); 699's drive stays 80/80. 3299 and 3300 leave the first catalog fields to the census, so every field below is a guess.

Shape guesses for 711:
- Scope, and the catalog's `moment`, are spelled `communicationRequest` / `paymentReconciliation` as the spec spells them. This renames 692's guessed `communication` / `payment` moments and their locale keys; no stub or row used them.
- Facts: `$communicationRequest.reason` (code), `.category` (code), `.payloadTextPresent` (flag); `$paymentReconciliation.detail.payment`, `.detail.earlyFee`, `.detail.nphiesFee`, `.detail.amount` (all money, SAR). `detail.` is in the key at `level: "message"`, not `level: "line"`.
- Blocks: `{ check: "communicationRequest", field: "payloadTextPresent", is: true }`, `{ check: "paymentReconciliation", field: "detail.payment", under: { amount, currency } }`; a formula writes `$paymentReconciliation.detail.payment`.
- These two scopes send no `uses`. Stubbed FHIRPaths, code systems and channel rates are placeholders.
- The client derives no `$previous` on them, and a guard's catalog drops both moments.

Overrulable decisions:
- Changing scope removes the blocks the new message cannot read (emptied groups too), says so, and Undo brings them back. Returning to the claim response turns both uses on.
- History is off the palette on these two scopes: its fields are one line of one patient. 3273 should say otherwise if it reads there.
- A new fact starts on `reason` / `detail.payment` (below SAR 0). Recipes: "A detail paid less than its amount" and "A request with payload text".
- The unknown wording is on the editor only; the rule page's WHEN says the message and that it reads per detail.
- "No screen shows communication content" holds because the client has no field for it: only the flag. Nothing filters a content row if the door were to serve one, so 3299's catalog must not. The sample tree (697) and the back-test (700) are outside this ticket.
