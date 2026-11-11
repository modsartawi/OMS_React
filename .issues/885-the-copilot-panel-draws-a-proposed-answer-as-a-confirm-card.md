---
status: done
spec: BackOffice .issues\3631-the-copilot-proposes-a-personal-schedule-send-me-this-every-monday-spec.md
blocked-by: BackOffice 3663, BackOffice 3664
---

# 885 — The copilot panel draws a `proposed` answer as a card the reader can change, confirm or cancel

## What to build

BackOffice spec 3631, its web half: the card, the confirm sentence and the expired state (S13, S17 to S19, S36, S37).

- A `proposed` answer of kind `schedule` is drawn as a card: the server's lines in the screen's language (what will be
  sent, the days, the time, how the period will be read, the reader's address), and the editable values: days, time,
  title, and the period choice when it is offered.
- **Confirm** sends the proposal's id with the card's values; **Cancel** sends a cancel. Neither re-asks the model.
- The confirm answer shows the server's sentence, the first send date and a link to "My schedules" (886).
- An expired offer shows "This offer has expired. Ask again." and no live button.
- The card is drawn from the server's text only; the panel writes no wording of its own about what was scheduled.

## Proof (→ `tdd` red-green cycles)

- [x] A `proposed` answer draws the card with its lines and its defaults · oms-react tests
- [x] Changing the day, time, title and period sends them on Confirm · oms-react tests
- [x] Cancel sends a cancel; the expired answer shows no button · oms-react tests
- [x] An answer with no `proposal` draws as today · oms-react tests
- [x] Arabic screen: the card is right to left with the Arabic lines · oms-react tests

## Boundaries

Follows the contract written by BackOffice 3663 and 3664. Draws nothing when the field is absent (switch off).

## Done when

The Proof boxes are ticked.

## Blocked by

BackOffice 3663, BackOffice 3664

## Build notes

Built 2026-11-12 on `t885` (from `spec/3631`). Proofs: `src/features/copilot/proposal.test.ts` (12 cases: the pure card
seam `proposal.ts` and the conversation store with `Copilot/Ask` stubbed), one `describe` per Proof box. Full suite, typecheck,
and lint (bar the base boundary failure in `insurance-rules/aliases/door-shapes.test.ts`) green. Not driven in a browser:
no Playwright on this box (`tools/copilot-drive.mjs` has no proposal scenario yet).

- **Contract** in `src/core/models/copilot.ts`, 3663/3664 verbatim: `CopilotAnswer.proposal` / `scheduleRefusal` /
  `confirmed`, the outcomes `proposed`, `confirmed`, `cancelled`, `expired`, `not-confirmed`, and
  `CopilotAskRequest.confirmation` (`CopilotConfirmation`, `CopilotConfirmationValues`). `CopilotProposalKind` already
  carries `pause` | `delete` for 887.
- **The card** (`proposal.ts`): `proposalCard(reply, lang)` draws only an `outcome: 'proposed'` answer whose `proposal`
  is a `schedule` with an id (else null: the answer draws as before). Lines and period labels in the screen's language,
  `dir` from it; `lang` stays the proposal's own and is what a confirmation sends. `cardState(conv, i, inFlight)`: `open` /
  `sending` / `confirmed` / `cancelled` / `expired` (the server's answer, or a newer proposal later in the thread, since
  the server keeps one); `not-confirmed` and a refusal (`COPILOT-440`) leave it `open`. Edit helpers `withCadence`,
  `withDay`, `cardReady`.
- **The store**: `confirm(card, values)` / `cancel(card)` send `{ question: '', conversationId, confirmation }` through
  the same one-in-flight slot as `ask`, ignore the ten-question count (a confirmation takes none), and land the reply as a
  turn marked `confirms: { proposalId, cancel }` (no question bubble; its rule reads Confirm / Cancel). They resolve to
  the reply.
- **The panel**: `ProposalCard.tsx` replaces a proposed answer's text (which repeats the lines) with the card; tables
  that ride on it still draw. A confirmed answer shows the server's sentence, `First send <firstSendAt>` and the link to
  `MY_SCHEDULES_PATH`; a `scheduleRefusal` of `limit` shows the same link. On `confirmed` the card calls
  `rereadMySchedules` - `ANALYTICS_MY_SCHEDULES_KEY` moved to `@/core/analytics-schedules` (re-exported from
  `analytics/boards/api`), since a feature may not import another.
- **For 887**: `proposalCard` returns null for `pause` / `delete`; branch there (a sibling card, or a `kind` switch) and add
  the chosen schedule to `confirmationBody`. `cardState` and the store's `confirm` / `cancel` are kind-agnostic.
