---
status: done
spec: 734
blocked-by: —
---

# 735 — A permitted user asks the OMS a question and reads the answer

## What to build

This is the copilot's tracer bullet (spec 734 D7, D10, D11). The pieces:
- **The button.** A user granted `canAsk` sees an "Ask the OMS" button in the top bar; anyone else
  sees no button.
- **The panel.** The button opens the copilot panel, which is also routable as a full page at
  `/copilot`.
- **The empty state** shows the two example questions (D12). Clicking one fills the question box.
- **Asking.** Sending a question calls `POST Copilot/Ask` and shows a working state until the answer
  arrives.
- **The answer** is shown as free text (`<bdi>`), with light markdown: paragraphs, bullet lists and
  simple tables.
- **The limit.** The question box enforces and shows the 1,000-character limit.

The probe (`GET Copilot/Access`) **fails closed**: absent or unreachable means no button and no
page. The panel can send data to an external AI service, so this is the OMS-viewer pattern, not
the degrade-to-allowed one.

This slice creates the top-level `features/copilot/` feature (cross-cutting like `auth`, not a nav
area), its i18n namespace `copilot`, and the `/copilot` route.

## Spine reach

model/api (`core/models/copilot`, the feature's `api.ts`) · logic (the answer view model) ·
component/route (top-bar button, panel, `/copilot`) · i18n (`copilot` namespace) · test

## Proof (→ `tdd` red-green cycles)

- [x] `copilotAnswerModel_readsABareAnswerAsEmpty`: a reply missing `trace`, `orderRefs` or
  `answer` builds a view model without throwing · pure
- [x] `copilotAccess_failsClosed`: an absent or failed probe means not allowed · pure
- [x] `copilot-drive: ask-and-answer`: covers all of:
  - no button without the grant;
  - the button opens the panel, which shows the examples;
  - an example fills the box;
  - sending shows the working state and then the stubbed answer;
  - `/copilot` renders the same panel;
  - 1,001 characters cannot be sent;
  · flow (Playwright, stubbed envelopes)

## Boundaries

- New doors `Copilot/Access` and `Copilot/Ask` (BackOffice BO-1, unbuilt). Build against stubs of
  exactly the D10 wire.
- New i18n namespace `copilot`, registered in `core/i18n.ts`.
- Top-bar button in `layout/TopBar.tsx`. `layout` may import a feature.
- Hand-written controls must go through `core/ui`, or be added to `tools/control-baseline.txt` with
  a reason.

## Done when

`copilot-drive` ask-and-answer is green and typecheck, lint and test pass.

## Blocked by

None — can start immediately.

## Resolution

Built 2026-11-03 on `spec/734-ask-the-oms` (commit e8246d0c; review fixes in ed0e3911). All proofs pass against stubbed envelopes; the live walk is [740](740-ask-the-oms-and-the-sourcing-advisor-work-live-on-staging.md). Drives: copilot 177/177, sourcing advisor 100/100; 8,536 unit tests pass; lint shows only the 4 boundary violations already on main (insurance-rules aliases).
