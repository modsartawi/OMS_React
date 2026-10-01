---
status: done
spec: 342
blocked-by: —
---

# 343 — An accountant asks to change an untouched entry's amount or description, and the pane shows it waiting

**SLICE 0** of spec 342 (frontend half of BackOffice spec 2190). Builds against the `## Web contract`
of BackOffice 2191 and 2192 (`C:\Work\DMSCO\BackOffice-2149\.issues\`), field for field.

## What to build

An accountant opens an entry in the branch account view and finds a new **change request** pane between
the approval pane and the correction pane (W2). On an untouched `PENDING_APPROVAL` / `OPEN` / `CONSUMED`
shortage or surplus with no request waiting, it offers **Request a change**. The form opens with the
entry's current amount and **Description** filled in, shows "lowest allowed: X" (the History read's
`spentAmount`), and requires a **Reason** (≤ 200, the feature's `ReasonField`). Submit stays disabled
while nothing differs. On an accepted raise the pane draws the **waiting-request card**: kind, old → new
(only what differs), who asked and when, the reason, and the sentence that the entry keeps working at its
current figures until the request is decided.

- **W14 models** in `core/models/settlement.ts`: the History read
  (`{ settlementEntryId, openRequest, requests[], entryNumber, entryStatus, amount, remainingAmount,
  spentAmount }`), the request row (2191's table), the act response (2191's table, plus 2195's
  `businessDay` declared now so later tickets don't reshape it), and the Raise body. Every field as the
  contracts name it; money `number`, dates the local strings the server sends.
- **`api.ts`:** `changeRequestHistory(settlementEntryId)` → `GET Settlement/ChangeRequest/History`,
  `raiseChangeRequest(body)` → `POST Settlement/ChangeRequest/Raise`, through `@/core/api`.
- **The pure offer module (W3)** — one function, one tagged union, never combinable predicates (the
  `correction.ts` discipline). It takes the entry's kind, status, amount, remaining, the History read's
  `openRequest` and `spentAmount`, and the session's grants (`canOpenSettlement`,
  `canSuperviseSettlement`) and `userId`, and returns the **whole** W3 table, including the supervisor's
  `Change now` / `Delete now` cells and the "reduce to the spent figure" cell, so later tickets render
  cells already decided here. Spent is the server's `spentAmount`, never `amount − remaining`. Equality is
  compared at the scale money is held at (`roundMoney`).
- **The change body (W4):** a pure `changeRequestBody(entry, draft)` sends only the fields that differ as
  `newAmount` / `newDescription`; an unchanged field goes `null`. "Nothing differs" is decided at holding
  scale (see Open questions). A figure ≤ 0 or below the floor is refused in the form; the server still
  decides.
- **Redraw, then re-read (W8):** the pane redraws from the act response's figures at once, then History
  and the account (`invalidateSettlement`) are refetched.
- **404 (Boundaries of spec 342):** a History or Raise 404 draws "change requests are not available yet"
  in the pane — never a crash — so the web can ship before SIS.Api does.
- **Words (W13):** "Change request" is the noun; the entry's text is **Description**, the request's is
  **Reason**.

Refusal codes are 344's: in this ticket a refused raise shows `apiErrorMessage`/`message` only.

## Spine reach

model/api · store/logic (offer module, change body) · component (change-request pane in `BranchAccount`)
· i18n (`settlement` namespace) · test

## Proof (→ `tdd` red-green cycles)

- [x] `offerFor` — every status × kind × spent × waiting × grant cell of W3's table, including a BHD
  entry spent by `0.001` (spent, so no delete) and a finished entry's sentence per status · pure
- [x] `changeRequestBody` — only differing fields are sent, unchanged ones `null`; nothing-differs
  detected after rounding to holding scale; below-floor and ≤ 0 refused · pure
- [x] `tools/settlement-change-drive.mjs` (new) — stubbed History + Raise from 2191/2192's samples: pane
  sits between approval and correction, form pre-filled, Submit disabled until something differs, raise
  sends only the changed field, card drawn from the answer before the refetch, 404 says "not available
  yet" · flow (Playwright drive)

## Boundaries

- New doors: `GET Settlement/ChangeRequest/History`, `POST Settlement/ChangeRequest/Raise` (BackOffice
  2191/2192, on unmerged branch `spec2149`). Fixtures built from the contract samples, field for field.
- New keys in the `settlement` namespace only. No new grant, no new probe flag (W1).
- No refusal map (344), no Withdraw/Approve/Reject (345/346), no delete (347), no theft day (349).

## Done when

The three Proof items are green, `npm run typecheck` and `npm test` pass, and the existing settlement
drives pass unmodified.

## Blocked by

None — can start immediately (BackOffice 2191/2192 done on `spec2149`).

## Open questions

- **Branch-currency rounding (W4) is ruled out of this ticket — owner ruling 2026-10-01.** The web has
  no branch currency (`currencyKey` is `''` in `BranchAccount` and `PostEntryDialog` since 274, §B6), so
  it cannot round SAR to whole riyals as the server does. The form compares "nothing differs" at holding
  scale, never claims the rounded figure, and the pane redraws from the act response's `amount`. The
  spec's "rounding for SAR and BHD" proof is dropped; the server's rounding is shown, not shadowed.

## Done — 2026-10-01

- `offerFor` / `changeRequestBody` / `afterRaise` / `raisedRequest` / `cardFor` / `changeRequestFailure`
  in `change-request.ts`, 112 cases in `change-request.test.ts` (fixtures from 2191/2192's samples in
  `change-request-fixture.ts`), including the BHD `0.001`-spent cell and a finished sentence per status.
  Only a Description that differs is checked, so an entry posted blank or over 200 can still have its
  amount changed (spec review).
- `tools/settlement-change-drive.mjs` 77/77 (stubbed). Earlier settlement drives unmodified and green:
  settlement 291/291, approval 42/42, description 41/41, supervision 41/41, theft 62/62.
- typecheck, `npm test` (2912), lint and build green. Nothing driven against a live SIS.Api.
- Decisions taken unattended are in `.afk/HITL-343.md`. Two of them need the owner's sign-off:
  - **`spent-whole`**: a wholly spent entry offers neither delete nor "Reduce it to X". W3/W5 say
    "reduce to the spent figure", but that figure equals the amount, so the server would answer `NO_CHANGE`.
  - **Supervisor "Change now"**: it is drawn already, with a pane-level "applies at once" sentence. The
    form's own sentence stays 348's.
