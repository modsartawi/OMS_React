---
status: done
spec: 180
blocked-by: —
---

# 190 — theCallerWhoIsNotAMemberYetGetsEnrolledOnTheCall

## What to build

A caller the lookup cannot find is enrolled without leaving the console. ✅ **Both routes have been
on the door since [137](137-callcenter-web-door.md)** — `CallCenterWeb/SignUpByBranch` and
`ConfirmSignUpByBranch`, mounted and gated — so the console cannot find a caller it cannot create.
`SignupPanel` and `signup-view` already exist and are proved by `coupon-159-drive.mjs`;
`ConsoleShell` already accepts `signup`. `CallCenterConsolePage` supplies nothing.

**Inline in the caller rail, never a modal** — the one arrangement decision here, and it has a reason
rather than a preference: the wait between *Send code* and the code arriving is **spoken**, the
caller is on the line reading digits back, and a modal would take the basket away for the length of a
conversation the agent is having anyway. Unlike the coupon, nothing about a signup is a fact of the
**order** — it belongs to the caller, and the caller has a column.

- It hangs off the **not-found** lookup as the ordinary next thing, on ordinary ground: a miss is not
  a failure.
- It carries the number already typed.
- It collects **two fields and no more** ([132](132-header-capture-inventory.md)'s ruling kept whole).
- Four steps: `closed → details → otp → created`.
- **No resend and no countdown.** CC2 has neither, and a countdown the console invented would promise
  an expiry only the loyalty service knows.
- It ends at a member the agent still has to **attach** — [165](165-attach-caller-fills-the-rail.md)'s
  two steps, which a freshly enrolled caller does not get to skip.

🚩 **Two things this client must deliberately NOT implement:**

1. **`BranchId` never leaves the browser.** It is written to `CreatedByBranchId` **permanently**, the
   validator does not require it, and the routes are verbatim pass-throughs today — so as things
   stand any console-granted agent could credit **any pharmacy in the estate** with an enrolment. The
   owner ruled the call centre's own store code, which means the **server stamps it**. The console
   sends no branch.
2. **The mobile is not normalised here.** CC2 builds the enrolled number itself out of a country list
   compiled into the WPF client. Reimplementing that would put one rule in two clients over the value
   the loyalty base **keys on** — [156](156-delivery-fee-shared-rule.md)'s exact failure. The
   console's dialling-code line is a **display preview the agent reads back**; the wire carries
   `{ countryCode, mobile }` as typed and the server builds the number.

## Spine reach

api (the two signup routes) · logic (`signup-view`, already built) · component (rail wiring) ·
i18n (already present) · test

## Proof (→ `tdd` red-green cycles)

- [x] `signup-view` — the step machine's legal transitions; `beginSignup` carries the typed number;
      `canSendCode` / `canConfirmOtp` predicates · pure — `signup-view.test.ts`, 14 green. `codeSent`
      and `signupCreated` are the two transitions, each legal from exactly one step and returning the
      state **untouched** from any other (an enrolled caller is never put back in front of a code box)
- [x] `mobilePreview` — display only and SA-only; a test asserting the previewed string is **never**
      what goes on the wire · pure — the wire is `signupCapture` / `signupConfirmCapture`, and the
      test asserts `capture.mobile !== preview`, carries no `+`, carries no dialling code, and that
      the body's keys are exactly `countryCode` + `mobile` (+ `otp`) — no branch to omit, because
      `LoyaltySignupCapture` cannot express one
- [x] `coupon-159-drive.mjs` signup section, **re-pointed at the wired console** — a not-found lookup
      offers enrolment on ordinary ground, the panel opens **inline** with the basket still visible,
      and the flow ends at an Attach button rather than an attached caller · flow (Playwright) —
      29 green against `/callcenter` with only the wire stubbed, including the two rules that are
      observable **only on the wire**: no `branchId` on either body, and `mobile: '0501234567'` going
      out while the preview read `+966501234567`. Screenshots `wired-signup-{details,otp,created,attached}.png`

## Boundaries

**Server:** BackOffice [879](C:\Work\DMSCO\BackOffice\.issues\879-cc-coupon-projection-removal-and-signup-branch.md)
§4 — **implementing now**. ✅ Routes already shipped and gated; what 879 adds is taking `BranchId` off
the wire and (recommended) moving normalisation server-side.
**i18n:** ✅ `signup.*` already exists from the prototype.
⚠ If the server has not yet moved, the console still must not implement either rule locally — a
temporarily-wrong branch on the server is one bug; a second normalisation rule in a second client is
a permanent one.

## Done when

In the running app a not-found lookup offers enrolment, the panel runs inline in the rail through all
four steps without covering the basket, and the request body contains **no** `BranchId` and an
un-normalised mobile.

## Blocked by

None — can start immediately.

## Built

`signup-view.ts` grew the two transitions and the two capture builders; the bodies are typed by
`LoyaltySignupCapture` / `LoyaltySignupConfirmCapture` in `core/models/callcenter.ts`, which is where
both omissions become structural rather than remembered. `api.ts` gained `signUpByBranch` and
`confirmSignUpByBranch` — **not session verbs**: no `transactionId`, no `withBusyRetry` (the signup
precedes attach, so there is no claim to collide with), but a `requestId` each, minted once.
`CallCenterConsolePage` holds the four-step state and the two mutations, and passes the `signup` prop
`ConsoleShell` and `CustomerRail` have accepted since 159.

Two things the wiring decided that the ticket did not spell:

- **The step moves on the server's answer, never on the press.** A code that was never sent must not
  put the agent in front of a box asking for it.
- **The panel's own *Attach* failure lands in the panel.** The rail draws an attach failure beside the
  LOOKUP's card, which is not on screen on this path — without folding `customerFailure` into the
  panel's error at `step: 'created'`, a failed attach would re-enable the button and say nothing.

⚠ Server side: BackOffice 879 §4 (`branchId` off the wire, normalisation server-side) is the half
still landing. The console is correct either way — it never sends a branch and never normalises — but
until 879 ships, a server still reading `BranchId` simply receives none.
