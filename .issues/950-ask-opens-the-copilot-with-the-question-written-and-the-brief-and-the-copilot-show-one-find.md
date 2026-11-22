---
status: open
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

- [ ] Ask opens the panel with the written question and the finding's id · vitest
- [ ] a further question continues in the same panel · vitest
- [ ] the button is absent when the tool is not offered · vitest
- [ ] the brief and the copilot draw a finding through the same card · vitest

## Boundaries

Front end only. Depends on `Copilot:Findings` on the server.

## Done when

The tests are green, and on dev a line's Ask opens the copilot and gets an answer from the stored finding.

## Blocked by

[946](946-the-command-center-home-shows-the-morning-brief-the-status-line-and-the-language-switch.md),
BackOffice 4179
(`E:\Projects\BackOffice\.issues\4179-the-copilot-answers-from-stored-findings-and-gives-a-profile-summary-with-a-link.md`)
