---
status: done
spec: C:\Work\DMSCO\BackOffice\.issues\2615-deliverect-delivery-platforms-spec.md
blocked-by: 477 (live: BackOffice 2625)
---

# 481 — An ops user sets a Deliverect store busy, closed or reopened, and re-pushes its hours

## What to build

The store status on the Stores page (477):

- A **status** column: open, busy or closed, with since-when and the reason.
- **Actions**:
  - busy, with a preparation delay in minutes;
  - close for now;
  - reopen.

  Each carries a mandatory reason. The DLV-00010 (not linked) and DLV-00011 (Deliverect answer)
  refusals show inline.
- **Push hours now** shows the week that was sent, with overnight shifts marked (for example
  "08:00 → 02:00 next day").
- **History drawer**: action, delay, reason, by, at, and Deliverect's answer.

Wire shapes: `C:\Work\DMSCO\BackOffice\.issues\assets\2615-deliverect-web-door-contract.md` (Stores `status` block, Store status).

## Spine reach

UI → app (BackOffice doors, stubbed until 483)

## Proof (→ `tdd` red-green cycles)

- [x] `hoursLabel`: an overnight row reads "next day" in EN and AR (vitest — `store-status.test.ts`, 31 cases incl. `parseDelay`, `statusBody` busy-only delay, `actionOffered`)
- [x] `tools/deliverect-stores-drive.mjs` status section, against stubs: busy, close, reopen, hours, history, refusals (sections 16–20, LTR + RTL; whole drive **167/167**, 477/480 sections unchanged)
- [x] typecheck, lint, test green (vitest 4844; build green)

## Boundaries

oms-react only. No feature flag: the access probe gates the menu, and the server grant is the real boundary. The BackOffice doors are built in parallel; until they are deployed, prove the page against stubs of the contract (real envelope `errors[]` shape, fixtures emitting **exactly** the contract's fields).

## Done when

The helpers and the drive are green.

## Blocked by

- [477](477-an-hq-user-onboards-a-store-on-a-deliverect-account-and-sees-its-link.md)

(live: BackOffice 2625)

## Comments

**2026-10-12 — built (AFK).** Status column + since + reason; Set status dialog (busy with a positive whole-number delay, close for now, reopen; none preselected; closed store offered reopen only; DLV-00009 at the reason, DLV-00010/11 inline with our lead + the server's words); Push hours (POSTs `{}`, shows the week sent, overnight "next day"; DLV-00010/11 inline); Status history drawer (take=50: action, delay, reason, by, at, Deliverect's answer). en + ar keys. Rulings and contract gaps in `.afk/HITL-481.md` — notably the overnight label renders in `<bdi>` (range one `fsi` isolate) rather than the briefing's `Ltr`, per the bidi rule.

Outstanding (not AFK's): owner sign-off on the HITL-481 rulings; owner's eye on the Arabic rendering; live doors on staging (483, BackOffice 2625).
