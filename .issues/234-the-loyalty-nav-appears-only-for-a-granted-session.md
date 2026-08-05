---
status: done
spec: 231
blocked-by: 233
---

# 234 — The Loyalty nav group appears only for a granted session, and fails closed

## What to build

The screen exists but has no way in. This slice adds the **Loyalty** nav group with the member lookup
under it, gated by the screen's own access probe — and makes a deep link by an ungranted user land on
the portal's denied backstop rather than on a PII surface.

One probe, one TanStack Query key, **two consumers**: the menu item's `accessProbe(...)` and the
page's own in-page guard. That is the established shape (`omsAccessApi`, `uaAdminApi`,
`sessionMonitorApi`, `authzAdminApi`) and it exists so the nav and the screen can never disagree
about whether the session is allowed in.

🚩 **Fails closed, and this is the point of the ticket.** Any error, an unseeded grant, a missing
table, an engine fault — all hide the nav item and deny the screen. The failure mode being designed
against is a PII lookup surface left open because a probe threw and the client treated the throw as
"probably fine". Show/hide is hygiene only; the server grant stays authoritative, which is why the
in-page guard exists as well as the menu one.

The nav group is new: `/loy/*` is its own URL prefix and its own menu group, which is exactly the
condition under which [feature-structure](../.claude/rules/feature-structure.md) says a new area
appears.

## Spine reach

api (`LoyWeb/Access`) · logic (the probe's `visible` predicate) · **component/route** (menu model +
the page guard) · i18n · test

## Proof (→ `tdd` red-green cycles)

- [x] the probe's predicate — a granted answer shows the item; a denied answer, a thrown error, and
      a malformed answer each hide it · **pure** — `src/features/loy/member/access.test.ts`
      (`canOpenLoyMember`: `=== true` and nothing looser, so `'true'`, `1`, `{}`, `null` and a
      wrong-named flag are all denials) + `src/layout/menu-loy.test.ts`, which reads the **real**
      `MENU` and drives `resolveMenu` — granted shows the group, and denied / errored / malformed /
      pending each drop the group *and its only child*, so no empty "Loyalty" header is left
      offering a screen that cannot be opened. It also pins that the leaf's probe key **is** the
      exported `LOY_ACCESS_KEY` object the screen guard uses
- [x] `tools/loy-member-drive.mjs` (extended) — granted: the Loyalty group appears and the item
      routes; denied: the group is absent **and** a typed deep link to `/loy/members` lands on the
      denied backstop · **flow (drive, stubbed envelopes)** — **47/47**, scenarios 10–13: granted
      (group appears, item routes, **one** probe call shared by nav and screen), denied, a probe
      that **throws** (500), and a **bare 403**. Each of the three refusals also asserts the member
      read never fires on the way to the backstop

## Boundaries

- **New API dependency:** `GET LoyWeb/Access` — BackOffice, not built. Cookie-only, **not**
  grant-gated, reading the same gate object as the route filter. It is the fifth `LoyWeb` route and
  the only one that is not a read.
- **Nav visibility:** a new top-level menu group. Until this ticket lands, `/loy/members` is reachable
  by URL only — deliberate, so the screen never appears in the nav ungated.
- i18n: the nav group and item labels.

## Done when

A granted stub shows the Loyalty group and opens the screen; a denied stub hides it and turns a deep
link into the denied backstop; a probe that throws behaves exactly like a denial. `npm run typecheck`
and `npm run lint` green.

🚩 Nothing driven against a live SIS.Api.

## Answer

Landed. `GET LoyWeb/Access` → `LoyAccessResult { canOpenLoyMember }` (`core/models/loy.ts`), called
from `features/loy/member/api.ts` with **no 404-tolerant catch** — 224 ruled the bonus-buy
*unknown ⇒ shown* precedent does not transfer to a PII surface, and failing closed here is the
absence of a catch rather than code. The probe stays **with its feature** rather than graduating to
`@/core/`: its two consumers are both this feature's, which is the `uaAdminApi` /
`sessionMonitorApi` shape (the OMS and Nphies probes moved to `core/` only when a *second feature*
needed them, which a feature may never import). One exported `LOY_ACCESS_KEY`, one exported
predicate `canOpenLoyMember`, used verbatim by both the `accessProbe` in `layout/menu-model.ts` and
the in-page guard in `MemberLookupPage` — sharing the *predicate* as well as the key is what makes
"nav and screen can never disagree" structural instead of a convention.

New top-level **Loyalty** group (`Gem`) with **Member lookup** (`UserSearch`) at `/loy/members`,
`activePrefix` covering `/loy/members/:loyId` so the leaf stays lit on a member.

Three things the build settled that the ticket did not spell out:

- 🚩 **The guard needs `staleTime: Infinity` and `retry: false`** — the shell's own two options for
  every nav probe. Without them the drive measured **two** calls on the shared key (the menu filled
  it, the screen's mount refetched it), which is precisely the one-probe-one-call invariant this
  ticket rests on. The drive now asserts `accessCalls === 1` across nav → click → screen.
- 🚩 **A bare 403 is a refusal, not an outage.** The backstop distinguishes *unreachable* (retry)
  from *denied* (ask an administrator), and 224 says an ungranted portal call — or a route that
  forgot `.AllowCookieSession()` — comes back as a bare **403**, which `core/api` classifies as
  `unknown`, not `auth`. Left unbranched it would have told an agent to "try again in a moment"
  at a permanently shut door, so the guard reads `statusCode === 403` as the administrator
  sentence. Both still deny; only the sentence differs.
- The member read is gated on the probe as well as the param (`enabled: !!loyId && allowed`), so an
  ungranted deep link to `/loy/members/:loyId` does not fire a PII read on its way to the backstop.

Reviewed on both axes: standards found no hard violation (the backstop card is the third hand-rolled
copy of the Nphies one — a `core/ui` candidate, logged, not taken here); spec found the ticket
delivered. Two review notes were applied: the predicate's signature now admits `null | undefined`
honestly instead of laundering the proof cases through a cast, and the 403 branch above.

`npm run typecheck`, `npm run lint`, `npm test` (1113 cases) and `npm run build` green.
Copy and shape calls logged in `.afk/HITL-234.md`.

🚩 Nothing driven against a live SIS.Api — the `LoyWeb` door is BackOffice 977–979, and 979 (the
probe) is what this slice consumes.

## Blocked by

[233](233-one-field-resolves-a-member.md) — there is no screen to gate until the route exists.
