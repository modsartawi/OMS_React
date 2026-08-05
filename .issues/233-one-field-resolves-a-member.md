---
status: done
spec: 231
blocked-by: —
---

# 233 — One field resolves a member, and a shut door never reads as "no member matches"

## What to build

**Slice 0 — the tracer bullet.** The thinnest complete path from an empty field to a named member,
cutting every layer of the spine, and retiring the wave's biggest unknown: the resolution cascade.

An agent opens `/loy/members` and sees one field, centred, and nothing else. They type a mobile
number **or** a Loy ID — the field never asks which and never guesses — and submit. The screen
resolves the member, navigates to `/loy/members/:loyId`, collapses the field into a slim bar carrying
**the searched key only**, and shows who this is: name, Loy ID, mobile, joined, updated. **Change**
reopens the field pre-filled; **New lookup** returns to the empty field.

The cascade is the risk and it is a **pure module**, which is the only thing provable with SIS.Api
down (spec 231 §3):

```ts
// compaction is NOT normalisation: whitespace, dashes, parens, leading '+'.
// No dialling code, no PadLeft, no country rule — the key-building rule is server-side.
const compact = (typed: string) => typed.replace(/[\s()\-]/g, '').replace(/^\+/, '')

async function resolveMember(typed: string): Promise<Resolution> {
  const key = compact(typed)
  if (!key) return { kind: 'noop' }                       // blank submit is silent
  try {
    return { kind: 'member', member: await loyApi.byMobile(key) }
  } catch (err) {
    // 🚩 ONLY LOY-00100 cascades.
    if (!(apiErrorKind(err) === 'business' && apiErrorCode(err) === 'LOY-00100')) throw err
  }
  try {
    return { kind: 'member', member: await loyApi.byLoyId(key) }
  } catch (err) {
    if (apiErrorKind(err) === 'business' && apiErrorCode(err) === 'LOY-00100') {
      return { kind: 'noMatch', typed }                   // a client sentence, not a server one
    }
    if (apiErrorCode(err) === 'LOY-00101') return { kind: 'archivedRefusal', key }  // defensive
    throw err
  }
}
```

🚩 **Why the cascade condition is the whole ticket.** An ungranted portal call returns a **bare 403**
(224). A cascade-on-anything rule would render the shut door — and every outage — as *"no member
matches"*, doubling load on a dead API while telling the agent to re-read a number that was correct.
`auth`, `server` and `network` show themselves and stop.

Four more rulings this slice encodes:

- **The box is never rewritten.** The typed text stays put so a typo is correctable rather than
  half-corrected under the agent's hands; the header shows the payload's stored mobile, which *is*
  the normalised key.
- **A double miss is a neutral client sentence** in the empty state — `t('loy:search.noMatch',
  { typed })`, no toast, no red. Knowingly and narrowly bending
  [api-envelope](../.claude/rules/api-envelope.md): the outcome is composed from two calls and each
  server sentence names only one of the things tried.
- **Explicit submit only.** Enter or the button; blank is silent. Debounced-as-you-type would flash
  the empty state accusingly while the agent is still typing.
- 🚩 **The URL holds the LoyId, never what was typed.** A refresh re-reads by key and does **not**
  replay the cascade — that runs on submit only. The bar shows the typed key from navigation state,
  falling back to the LoyId on a cold load.

**No menu item in this slice.** The route is reachable by URL only, so the screen never exists in the
nav ungated — [234](234-the-loyalty-nav-appears-only-for-a-granted-session.md) adds the item *with*
its probe.

## Spine reach

**model** (`core/models/loy.ts`) · **api** (`LoyWeb/Member`, `LoyWeb/MemberByMobile`) ·
**logic** (`resolve-member`, pure) · **component/route** (`/loy/members`, `/loy/members/:loyId`) ·
**i18n** (the `loy` namespace, registered) · test

## Proof (→ `tdd` red-green cycles)

- [x] `resolve-member` — blank is a no-op; `+966 55 500 0111` compacts to `966555000111`; a mobile
      hit takes one call; `LOY-00100` retries as a Loy ID; a double miss returns `noMatch` carrying
      the typed text; 🚩 **a 403, a 500 and a network failure each propagate and never read as
      no-match**; `LOY-00101` returns the archived guard · **pure**
- [x] `tools/loy-member-drive.mjs` (new) — the empty field, a resolved member with the bar collapsed,
      Change reopening pre-filled, New lookup returning, the double-miss sentence, and a cold load of
      `/loy/members/:loyId` showing the bar with the LoyId · **flow (drive, stubbed envelopes)**

## Boundaries

- **New API dependency:** `GET LoyWeb/MemberByMobile/{typed}` and `GET LoyWeb/Member/{typed}` —
  BackOffice, not built. Envelope `success:false` codes to handle: **`LOY-00100`** (the only one that
  cascades) and **`LOY-00101`** (defensive guard, expected unreachable once the door drops the
  archived refusal). 🚩 **`branchId` is never passed.**
- **New i18n namespace `loy`** — import, `ns[]` and `resources` in `core/i18n.ts`. Deliberate
  deviation from "namespace == feature name": the feature is `member` under the new `loy` area, and
  `member` is too generic as a global namespace. Tickets 229 and 230 already fixed `t('loy:…')` call
  sites.
- **New area folder `features/loy/`** — the first since the taxonomy rule; `npm run lint`'s boundary
  gate picks it up automatically.
- 🚩 **Verified, do not rebuild:** `isBlankDate` in `core/util/date-format.ts` already handles the
  `0001-01-01` sentinel and is exported precisely so a second spelling of "unset" never appears.
  `formatDateTime` (`yyyy-MM-dd HH:mm`) and `formatShortDate` (`25 Jul 2026`) are the existing
  formatters — **`formatStamp` does not exist**, despite the name used in specs 226/231.

## Done when

`resolve-member`'s suite is green, `npm run typecheck` and `npm run lint` pass, and the drive shows
an agent going from the empty field to a named member and back — including a stubbed 403 producing a
refusal message rather than "no member matches".

🚩 **Nothing is driven against a live SIS.Api**, per spec 231's standing verification rule. Say so in
the closing note.

## Blocked by

None — can start immediately.

## Answer

Built 2026-08-06. The spine is thin and whole: `core/models/loy.ts` → `features/loy/member/api.ts`
→ `resolve-member.ts` (pure) → `MemberLookupPage.tsx` on two routes → the `loy` namespace
registered in `core/i18n.ts`.

**What landed**

- **`resolve-member.ts`** — `compact` and the cascade, pure by construction: the two reads arrive as
  an argument (`MemberReads`), so the rule is provable with no network, no fetch stub and no module
  mock. 12 vitest cases, and the ones that matter are the refusals: a bare 403, a 500, a network
  failure and a non-`LOY-00100` business code each **propagate on the first call and never reach the
  second**, so a shut door can never read as "no member matches". `LOY-00101` returns the archived
  guard; a double miss carries the **typed** text, not the compacted key.
- **`apiErrorKind(err)` added to `core/api.ts`**, mirroring `apiErrorCode`. The cascade condition has
  to name the taxonomy arm, and a feature spelling `err instanceof ApiError && err.kind === …`
  re-implements `core/`'s taxonomy at each call site.
- **`core/models/loy.ts`** carries spec §6's split as two types — `LoyMemberPayload` (wire,
  `blockedReason`) and `LoyMember` (domain, `blockedReasonCode`) — mapped at the api boundary, so
  235's chips cannot read the action row's description as the member's code. The engine machinery
  (`profile`, `accrualFactor`, `redemptionFactor`, `exchangeRate`, `pointsExpireSoonDays`,
  `profileUpdated`) is absent from the model: it is drawn nowhere, and a model field is an invitation
  to draw it.
- **The screen** — one component, two states. The bar carries the searched key only; the header
  carries the name once. A resolve seeds the query cache so the member is on screen the instant the
  navigation lands, while the route's own read stays the data source (no freshness policy invented
  here — that would silently bind 235–238).

**Three judgement calls, all logged in `.afk/HITL-233.md`**

1. 🚩 **The hint no longer publishes the cascade.** 227's prototype drew *"Mobile first, then Loy ID
   — one field decides nothing, the server does."*; both review axes flagged it against spec 231's
   story 3 (*"the screen's internal ordering is invisible to me"*), and its second clause is wrong
   besides — the **client** sequences the two calls, not the server. It now reads *"A mobile number
   or a Loy ID — either one resolves the member."*, which is what the field takes rather than what it
   does with it.
2. **Change grew a Cancel.** Reopening the field hides the bar, and the bar owns New lookup — so
   without it the only ways out of a reopened field were a successful lookup or the browser. The
   member stays on screen throughout either way.
3. The double miss keeps 227's second sentence (*"Neither a mobile number nor a Loy ID matched…"*) —
   the prototype drew it, and "one neutral sentence" in the spec is about no toast and no red.

**Proof**

- `resolve-member.test.ts` — 12 pure cases green; the full suite is 1106 across 65 files.
- `tools/loy-member-drive.mjs` — **34/34**, against stubbed `LoyWeb/*` envelopes: the empty field, a
  blank submit making zero calls, a mobile resolving in **one** call on the compacted key, a Loy ID
  cascading in **two**, the bar with the key as typed, Change pre-filled + Cancel, New lookup, the
  double-miss sentence with the box unrewritten and no banner, a **bare 403 that does not cascade and
  does not read as no-match**, and a cold load of `/loy/members/100001293` reading by key alone.
- `npm run typecheck`, `npm run lint` (all three gates) and `npm run build` green.

🚩 **Nothing was driven against a live SIS.Api.** The `LoyWeb/*` door does not exist — it is
BackOffice 977–979 on a parallel track — so every envelope in the drive is a stub built from
[223's field inventory](assets/223-loy-reads-field-inventory.RESEARCH.md), per spec 231's standing
verification rule.

**Left for the wave, deliberately:** no menu item and no access probe (234), no chips / points block
/ disclosure (235), no tabs (236–238). Two notes for whoever takes them: the `loy` namespace is
registered but holds only `search.*` and `member.*`; and the loyalty vocabulary (*member*, *Loy ID*,
*tier*, *blocked reason*, *member type*, *action*) is still absent from `CONTEXT.md`, which spec 231
asks `/domain-modeling` to fix as the build makes the terms concrete.
