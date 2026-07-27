---
status: open
spec: 160
blocked-by: 162
---

# 165 — attachingTheCallerFillsTheRailAndOpensTheAddressBook

## What to build

The first thing that happens on a call. The caret sits in the **phone field the moment the console
opens**, so the agent's first keystroke is the one the screen expects (CC2 finding 1, never built in
WPF).

Attaching a caller fills the customer rail: a **compact card of six fields maximum** (Salesforce
compact-layout discipline — the seventh field is what turns a rail into a form), pinned at the start
edge where it never moves and never scrolls away.

**Customer-first is shown as intent, not enforcement.** The address book is server-side unreachable
before attach — the five address routes are scoped to the session's attached customer, because the
originals are unscoped ([137](137-callcenter-web-door.md)) — so:

- With no caller, the rail's address block is **not** a disabled control the agent can poke; the next
  step is what the console shows.
- With a caller attached and no address yet, the address block is an **empty dashed slot with its own
  *Pick an address*** — the state 137 added to 135's list.
- 🚩 The agent must never reach a control that answers with a refusal. `canOpenAddressBook` from
  `capabilities` is what decides, not a client-side re-derivation of the same rule.

Removing the caller **clears the address and keeps the derived store** — a subsequent address act
re-derives it through the normal path, so re-attaching a caller never silently re-prices the basket.

## Spine reach

api (`AttachCustomer`, `RemoveCustomer`) · logic (rail field selection; which address state the rail
is in) · component (customer rail, six-field card, empty address slot) · i18n · test (pure + flow)

## Proof (→ `tdd` red-green cycles)

- [ ] `theRailShowsSixFieldsAndTheRightAddressState` — pure: given a header, the rail's fields are
      capped at six in a fixed order, and the address block resolves to one of *no caller* / *caller,
      no address yet* / *address set* — driven off `capabilities`, never a re-derived rule · pure
- [ ] `attachingACallerOpensTheAddressBook` — drive: the caret is in the phone field at open;
      attaching renders the compact card and the empty address slot; removing clears the address and
      **leaves the store chip standing** · flow (Playwright, extends `tools/callcenter-drive.mjs`)

## Boundaries

**Endpoints:** `POST CallCenterWeb/AttachCustomer`, `RemoveCustomer`, plus the loyalty lookup on
137's door (BackOffice [801](C:\Work\DMSCO\BackOffice\.issues\801-callcenter-web-door.md)). Codes:
`NO_CUSTOMER_ATTACHED` must be unreachable through the UI by construction, not merely handled.
⚠ **Loyalty *signup* is out of scope** — a caller who is not in the system is
[159](159-coupon-and-loyalty-signup-drawn.md)'s undrawn surface, and this slice must not invent one.

## Done when

An agent starts typing a phone number without clicking anything, attaches a caller into a six-field
rail, and is offered the address book only once it will actually answer them.

## Blocked by

[162](162-console-opens-an-order.md) — the rail renders from `SessionState`.
