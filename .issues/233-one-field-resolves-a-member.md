---
status: open
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

- [ ] `resolve-member` — blank is a no-op; `+966 55 500 0111` compacts to `966555000111`; a mobile
      hit takes one call; `LOY-00100` retries as a Loy ID; a double miss returns `noMatch` carrying
      the typed text; 🚩 **a 403, a 500 and a network failure each propagate and never read as
      no-match**; `LOY-00101` returns the archived guard · **pure**
- [ ] `tools/loy-member-drive.mjs` (new) — the empty field, a resolved member with the bar collapsed,
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
