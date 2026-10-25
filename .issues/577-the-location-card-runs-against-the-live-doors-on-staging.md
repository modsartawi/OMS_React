---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\2482-the-call-centre-texts-the-customer-a-location-link-spec.md
blocked-by: 574, 575, 576 (live: BackOffice 2492's staging deploy)
---

# 577 — The location card runs against the live doors on staging

## What to build

HITL. 574–576 are proven against stubs. This ticket points the console at a **staging** SIS.Api that has
the location link configured, and walks it with a real phone. It is the web seat's half of BackOffice
2492's staging walk, so record the results there too.

Before it can run (BackOffice 2492 and `Services/SIS.LocationLink.Web/DEPLOY.md`):
- SQL `005` + `006` run on the staging OMS POS DB;
- the staging SIS.Api deployed from pricing2 with `CallCenter:LocationLink:PublicBaseUrl` and
  `PublicCallers` set;
- the public app running on Nutanix staging (ADR 0109), with its key.

## Spine reach

UI → app → staging SIS.Api → OMS DB, and a real phone → the public app → staging SIS.Api

## Proof

- [ ] `tools/callcenter-location-drive.mjs` re-run against **live** staging (the stub switch off): send,
  status, apply, discard, retire
- [ ] a real-phone walk on iOS Safari and Android Chrome, in Arabic and English:
  - Send, capture, Apply, Discard, Resend, lapse;
  - save-to-customer, and Create address from this location;
  - an address change after Apply.
- [ ] the submitted order's address carries the pin, Short Address and Street2 (OMS document)
- [ ] screenshots under `.issues/assets/577-*`

## Boundaries

No code unless the live doors disagree with the contract. In that case, fix the client or raise it against
BackOffice. Never paper over a contract gap client-side.

## Done when

The walk passes on staging, and BackOffice 2492's web-seat items are ticked.

## Blocked by

574, 575, 576; BackOffice 2492's staging deploy.
