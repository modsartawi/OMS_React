---
status: done
spec: BackOffice 4165
blocked-by: 946, BO 4179
---

# 950 — "Ask" opens the copilot with the question written, and the brief and the copilot show one finding card

Spec: BackOffice `E:\Projects\BackOffice\.issues\4165-retail-command-center-phase-1-the-overnight-store-scorecard-product-health-and-morning-brief-spec.md`.

## What to build

- **Every line of the brief has an "Ask" button.** It opens the copilot in the side panel with the question the
  server wrote for that line and the finding's id as context. The reader can type a further question there.
- **The scorecard panel's "ask the copilot" button** does the same for the pharmacy.
- **One shared finding card:** a line in "what changed overnight" and the same finding on the copilot's opening
  screen are drawn by one component, with the same words.
- The button is absent when the server does not offer the copilot's findings tool.

## Spine reach

page → copilot panel

## Proof (→ `tdd` red-green cycles)

- [x] Ask opens the panel with the written question and the finding's id · vitest — `src/core/copilot-panel.test.ts`
  (`askAbout` hands the finding over once), `src/core/findings/ask.test.ts` (the pharmacy case: the button's tap opens
  the panel with the question and id), `src/features/copilot/finding.test.ts` (the first `Copilot/Ask` body is
  `{ question, findingId }` in a new conversation). The scorecard panel's button is the same `AskButton`; its
  wiring into 947's panel is pending until 947 merges.
- [x] a further question continues in the same panel · vitest — `finding.test.ts` (the next question carries the
  `conversationId` and no `findingContext`)
- [x] the button is absent when the tool is not offered · vitest — `ask.test.ts` (no `ask`, or no copilot grant → no
  button), `src/features/analytics/command-center/brief-ask.test.ts` (a brief line without `ask` has no Ask)
- [x] the brief and the copilot draw a finding through the same card · vitest — `brief-ask.test.ts` (a brief line's
  markup is exactly `FindingCard`'s) and `finding.test.ts` (the copilot's opening card contains exactly the same
  `FindingCard` markup for the same line, words and links)

## Boundaries

Front end only. Depends on `Copilot:Findings` on the server.

## Done when

The tests are green, and on dev a line's Ask opens the copilot and gets an answer from the stored finding.

## Blocked by

[946](946-the-command-center-home-shows-the-morning-brief-the-status-line-and-the-language-switch.md),
BackOffice 4179
(`E:\Projects\BackOffice\.issues\4179-the-copilot-answers-from-stored-findings-and-gives-a-profile-summary-with-a-link.md`)

## Comments

**2026-11-22 — done, stubbed.** BackOffice 4179 (`Copilot:Findings`) is unbuilt, so every proof runs against a stubbed
`Copilot/Ask` door. The live walk on dev ("a line's Ask opens the copilot and gets an answer from the stored finding")
is still owed and waits for 4179.

- **Built:** `@/core/copilot-panel` `askAbout(finding)` / `takeFinding()` (the hand-over, in core so neither feature
  imports the other); `@/core/findings/AskButton` (one button for every caller: it shows only when the server sent
  `ask` and the reader holds the copilot); `CopilotAskRequest.findingContext { findingId }` ⚠ proposed, sent on the
  first question only, like `sqlItemContext`; the conversation store's `openFinding` (a new conversation, SQL mode off,
  the written question asked with the finding's id); the copilot panel draws the asked line through the shared
  `FindingCard` at the top (`features/copilot/AskedFinding.tsx`); the brief's lines carry Ask. Copy: `command-center`
  `ask.*` (en + ar) and `copilot` `finding.askingAbout` (en + ar).
- **The opening-screen reading needs the owner's OK** (decisions §4): spec 4165 puts the copilot's opening screen in
  the early-warning spec, and 4179 has no "findings for the opening screen" read. 950 reads "the same finding on the
  copilot's opening screen" as the finding the reader asked about, drawn as the shared card at the top of the panel.
- **Wire name ⚠ proposed:** `findingContext: { findingId }` on `POST Copilot/Ask`. 4179 must accept that name, or the
  client changes to whatever 4179 settles.
- **The scorecard panel's "ask the copilot"** (947) uses the same `AskButton` with `ask={scorecard.ask}`, the label
  `ask.pharmacy` and no line. It is wired once 947 merges, because 947 owns that panel.
