---
type: spec
status: ready
map: 222
---

# 231 — Loy member lookup, read-only

Synthesized from wayfinder map [222 — A Loy member, read-only, in the portal](222-a-loy-member-read-only-in-the-portal.md),
whose eight tickets (223–230) are all resolved. Every decision below traces to one of them; where a
ticket's answer holds detail this spec only gists, the ticket is linked and is the authority.

## Problem Statement

A loyalty agent who has a member on the phone has nowhere in the portal to look them up. The only
tool is `Sartawi.Retail/IC` — a WPF desktop application on the retail floor's stack, behind the
retail floor's permission family, with eleven views bolted together. To answer "how many points do I
have", "why is my balance wrong", "what did I buy last month" or "why can't I use my number", an
agent must leave the back-office portal entirely.

The data is not the obstacle. SIS.Api already serves every read this needs. The obstacles are:

1. **The browser cannot reach any of it.** `Loy/*` routes carry no cookie-session opt-in, and
   ticket 802 made `ApiKeyEndpointFilter`'s cookie branch **default-deny** — so a portal call gets a
   bare 403, not a permission message. ([Who may look a member up](224-who-may-look-a-member-up.md))
2. **The WPF screen answers the question badly.** It shows codes under labels that promise names
   ("City" over `0021`), repeats the whole member on every audit row, splits one member across five
   view-models, and hides the volume ceilings its own queries impose.

An agent needs one field, one screen, and an honest answer.

## Solution

A new **Loyalty** area in the portal (`/loy/*`), whose first screen is a read-only member lookup.

**One field resolves a member.** The agent types a mobile number *or* a Loy ID — the field never asks
which and never guesses. The screen tries the mobile, and only on a genuine not-found tries the same
text as a Loy ID.

**The field then gets out of the way.** Before a lookup, `/loy/members` is a centred field and
nothing else. Once a member resolves, the field collapses into a slim bar carrying the searched key
with **Change** and **New lookup**, and the member owns the screen at `/loy/members/:loyId`.

**The member reads as one thing.** A header above the tabs carries identity, the status chips, and
the points block — with `PointsBalance` as the only headline number on the page. The long tail of
member fields sits behind one disclosure, shut by default. Below it, three tabs — **Activities**,
**Sales**, **Actions** — each fetching only when opened, each stating its own volume ceiling
honestly, each failing on its own without taking the screen down.

**Nothing on this screen changes anything.** Phase 1 is a read: no block, no tier change, no points
adjustment, no enrolment. That is a ruling, not a limitation of the reads.

The server half is a **BackOffice dependency** — a new `LoyWeb/*` door — specified under
[Boundaries](#boundaries-the-backoffice-door) and built on a parallel track. The client builds and
verifies against **mocked envelopes** taken from [223's field inventory](assets/223-loy-reads-field-inventory.RESEARCH.md),
which is how the Nphies wave (spec 209) shipped twelve tickets with SIS.Api down.

## User Stories

### Finding a member

1. As a loyalty agent, I want one field that takes either a mobile number or a Loy ID, so that I do
   not have to know which kind of key I am holding before I can search.
2. As an agent, I want the field to accept `0555000111`, `555000111`, `966555000111` and a pasted
   `+966 55 500 0111` alike, so that whatever the customer reads out or I paste from an email
   resolves without me reformatting it.
3. As an agent, I want a typed Loy ID to resolve even though I searched a "mobile" field first, so
   that the screen's internal ordering is invisible to me.
4. As an agent, I want the screen to search only when I submit, so that a half-typed number never
   flashes "no member matches" at me while I am still typing.
5. As an agent, I want a blank submit to do nothing at all, so that an accidental Enter is not an
   error message.
6. As an agent, I want the text I typed to stay exactly as I typed it after a search, so that I can
   correct one wrong digit instead of retyping a number the screen has rewritten under my hands.
7. As an agent, I want a member who matched neither key to produce one neutral sentence naming what
   I searched, so that I know the lookup completed and found nothing rather than wondering if it ran.
8. As an agent, I want a permission refusal, a server error or a network failure to say **that**,
   never "no member matches", so that I do not spend the call re-reading a correct number at a door
   that is shut.
9. As an agent, I want an archived member to resolve normally by either key, so that a stale account
   is something I can see and explain rather than an error I cannot interpret.
10. As a loyalty analyst, I want no member-picker or disambiguation dialog, because one mobile
    resolves to at most one member by construction and a chooser would imply otherwise.

### The member, once found

11. As an agent, I want the member's name to be the largest thing on the screen, so that I can
    confirm on the phone that I have the right person in one glance.
12. As an agent, I want Loy ID, mobile, join date and last-updated on one line under the name, so
    that the identifying facts read as a set rather than a form.
13. As an agent, I want the points balance as the single headline number with its SAR equivalent
    beneath it, so that the question I am asked most often is answered before I read anything else.
14. As an agent, I want pending points, expiring points and tier points beside the balance at label
    size, so that I can explain a balance that does not match the customer's expectation.
15. As an agent, I want the expiring-points figure tinted only when it is non-zero, so that "nothing
    is expiring" is quiet and "1,200 points expire within 30 days" is not.
16. As an agent, I want a tier chip beside the name, so that I know what the member is entitled to
    without decoding an `S`/`G`/`P`.
17. As an agent, I want a **blocked** chip whenever the member is blocked, reading in words ("Mobile
    moved to another account"), so that the commonest reason a customer cannot use their number is
    the thing I cannot miss.
18. As an agent, I want an unblocked member to show **no** status chip at all, so that silence
    reliably means "ordinary member" and a chip always means "read me".
19. As an agent, I want an archived, non-loyalty or family member to carry its own chip
    independently of the blocked chip, so that an archived-and-blocked member never has one fact
    hidden behind the other.
20. As an agent, I want the rest of the member's fields — email, birth date, national ID, the
    gender/nationality/city codes, preferred language, insurance company — behind one disclosure that
    starts shut, so that a screen I open forty times a day is not forty screens of PII I did not ask
    for.
21. As an agent, I want a field the server sends as a code labelled as a code ("City code", not
    "City"), so that a label never promises a name the screen does not have.
22. As an agent, I want an unset birth date to render as absent rather than as `0001-01-01`, so that
    a sentinel value is never presented as a fact about the customer.
23. As an agent, I want points-engine machinery — accrual and redemption factors, exchange rate, the
    dead `Profile` field — kept off the screen entirely, so that what I read is the member and not
    the engine.

### The tabs

24. As an agent, I want Activities, Sales and Actions as three peer tabs under one member, so that I
    do not navigate away and re-search to change the question I am asking.
25. As an agent, I want Activities to be the tab I land on, because "what happened to my points" is
    the question that brought me here.
26. As an agent, I want a tab to fetch only when I open it, so that every lookup does not pay for a
    500-line sales scan I may never look at.
27. As an agent, I want each activity row to show the signed points figure as its headline, so that
    accruals and redemptions are one scannable column.
28. As an agent, I want the points column aligned and always to two decimals, so that fractional
    accruals line up instead of raggedly implying points are integers.
29. As an agent, I want the points sign **not** colour-coded, because the Activity column already
    names the direction in words and colour would be the only reading for anyone who cannot see it.
30. As an agent, I want the activity status column, so that a **pending** accrual is visibly not a
    posted one — otherwise the tab silently misexplains the balance it exists to explain.
31. As an agent, I want each sale row to lead with the item description, so that "what did they buy"
    is answered by scanning one column.
32. As an agent, I want sale dates shown as dates only, so that the screen never prints a fabricated
    `00:00` the source data does not contain.
33. As an agent, I want a return line to read with its negative quantity and amount against a
    positive unit price, so that the row matches the receipt rather than a tidied-up version of it.
34. As an agent handling a Bahrain member, I want money formatted to its own currency's decimals and
    a currency column to appear, so that BHD is not silently rendered as if it were SAR.
35. As an agent looking at a single-currency member, I want no currency column, so that the common
    case does not spend width on a constant.
36. As an agent, I want the Actions tab to show who did what and when, so that I can explain a change
    someone else made to this account.
37. As an agent, I want the member's own details **not** repeated on every action row, so that a page
    of audit history is audit history and not the same PII twenty-five times.
38. As an agent, I want an action whose description the server could not resolve to fall back to its
    raw code, so that a row never renders as a blank cell.

### Volume, honestly

39. As an agent, I want each capped tab to state its ceiling ("Most recent 100 activities"), so that
    I never mistake a window for a complete history.
40. As an agent, I want a warning when a capped tab comes back exactly full, so that "there may be
    older activity not shown" reaches me on the member where it matters.
41. As an agent, I want a bare row count never shown on a capped tab, because a count reads as
    completeness.
42. As an agent, I want the Actions tab to state its **real** total and page through it, so that the
    one read with a genuine count is visibly different from the two without.
43. As an agent, I want to sort and filter the two tabs whose whole window is already in my browser,
    so that I can answer "did they ever buy X" without scrolling 500 lines.
44. As an agent, I want sorting **disabled** on the paged tab, because sorting page 3 of N reorders a
    page, not a result — the same lie the invisible window would be.
45. As an agent, I want no export in phase 1, because a capped list becomes a file that outlives the
    caption qualifying it.

### When something goes wrong

46. As an agent, I want a failed tab to fail inside that tab, leaving the member header and the other
    two tabs intact, so that one slow report does not cost me the member I already found.
47. As an agent, I want a Retry on a failed tab that refetches only that tab, because the likeliest
    failure — a sales query timing out on a heavy member — usually succeeds on a second attempt.
48. As an agent, I want an empty tab to say what was absent in its own words, so that "no sales
    lines" and "no actions recorded" are distinguishable facts rather than a shared "No data".
49. As an agent, I want an empty tab and a failed tab to never look alike, so that "this member has
    no history" is never confused with "this could not be read".
50. As an agent, I want a failed tab to say so inline without a toast, because the state is already
    fully visible in the tab I am looking at.
51. As an agent whose session has expired, I want the existing single-toast bounce to login, so that
    this screen behaves like every other screen in the portal.

### The screen as an address

52. As an agent, I want a resolved member to live at their own URL, so that I can send a colleague a
    link instead of a number and an instruction.
53. As an agent, I want a refresh to bring the same member back, so that reloading is not a reason to
    re-search.
54. As an agent, I want the open tab in the URL too, so that a link lands on the tab I meant.
55. As an agent, I want **New lookup** to return me to the empty field, so that starting over is one
    click and not a browser Back.
56. As an agent, I want **Change** to reopen the field pre-filled with what I searched, so that a
    one-digit correction does not mean retyping.
57. As an agent, I want browser Back from a member to land on the field, so that navigation behaves
    the way every other portal screen does.

### Access

58. As a loyalty agent with the grant, I want the Loyalty nav group to appear, so that I can find the
    screen without being sent a link.
59. As a user without the grant, I want the nav item hidden and a deep link to land on the portal's
    denied backstop, so that I am not offered a screen I cannot open.
60. As a security owner, I want the access probe to fail **closed**, so that an unseeded grant, a
    missing table or an engine fault hides the screen rather than exposing a PII surface.

## Implementation Decisions

### 1. A new `features/loy/` area

Per [feature-structure](../.claude/rules/feature-structure.md), a new area folder appears when a new
nav group and URL prefix do. `features/loy/member/` holds this screen; phase 2 (modifications,
family, complaints) has room beside it. Registration is the standard four points: the folder, the
`loy` i18n namespace registered in `core/i18n.ts`, the route entries in `app/router.tsx`, and the
menu item in `layout/menu-model.ts` with an `accessProbe`.

Models live in `src/core/models/loy.ts`. All server calls go through `@/core/api` per
[api-envelope](../.claude/rules/api-envelope.md) — no `fetch`, no hand-built envelope, and **401 is
never caught here**.

### 2. The door: `LoyWeb/*`, four reads, one probe

Four routes, consumed from `features/loy/member/api.ts`:

| Call | Purpose |
|---|---|
| `GET LoyWeb/MemberByMobile/{typed}` | first attempt at resolution |
| `GET LoyWeb/Member/{typed}` | second attempt, and the read behind `/loy/members/:loyId` |
| `GET LoyWeb/Reports/LastActivities/{loyId}` | Activities tab |
| `GET LoyWeb/Reports/LoyaltySales/{loyId}` | Sales tab |
| `GET LoyWeb/Reports/LoyMemberActions` (+ `LoyId`, paging) | Actions tab |

`GET LoyWeb/Access` is the fifth route and is the probe, not a read. The screen's own in-page guard
and the menu probe share **one** key and one call, the established pattern
(`omsAccessApi` / `uaAdminApi` / `sessionMonitorApi`).

**`branchId` is never passed.** It does exactly one thing — restate `PointsBalanceAmount` in a
non-SAR plant currency — and all KSA branches are SAR, so passing the acting store is a no-op that
widens the cache key. Omitting it yields `SAR` at rate `1`.
([223 §1](assets/223-loy-reads-field-inventory.RESEARCH.md))

**No lookup calls.** `Loy/Tiers` and `Loy/MemberBlockedReasons` are routes five and six and are not
on the door; `GetTiers` is three C# literals inline, so a round-trip would fetch a compile-time
constant. ([229 §1](229-a-code-the-server-did-not-translate.md))

### 3. Resolution is a client-side pure module

`resolveMember(typed)` in the feature's own module, **not** a server `ResolveMember` route — a fifth
route would widen the door, and a client rule is a pure module provable with SIS.Api down.
The shape, from [225](225-one-field-that-resolves-a-member.md):

```ts
// compaction is NOT normalisation: strip whitespace, dashes, parens, leading '+'.
// No dialling code, no PadLeft, no country rule — the key-building rule is server-side.
const compact = (typed: string) => typed.replace(/[\s()\-]/g, '').replace(/^\+/, '')

// mobile first (a call centre takes phone calls), LoyId only on a genuine miss
async function resolveMember(typed: string): Promise<Resolution> {
  const key = compact(typed)
  if (!key) return { kind: 'noop' }                       // blank submit is silent
  try {
    return { kind: 'member', member: await loyApi.byMobile(key) }
  } catch (err) {
    // 🚩 ONLY LOY-00100 cascades. A bare 403 (shut door), a 500 or a network
    // failure must NOT read as "no member matches" — see 224.
    if (!(apiErrorKind(err) === 'business' && apiErrorCode(err) === 'LOY-00100')) throw err
  }
  try {
    return { kind: 'member', member: await loyApi.byLoyId(key) }
  } catch (err) {
    if (apiErrorKind(err) === 'business' && apiErrorCode(err) === 'LOY-00100') {
      return { kind: 'noMatch', typed }                   // a client sentence, not a server one
    }
    // defensive: expected unreachable once the door drops the archived refusal (230)
    if (apiErrorCode(err) === 'LOY-00101') return { kind: 'archivedRefusal', key }
    throw err
  }
}
```

Four properties this encodes, each of which is a decision and not an implementation detail:

- **No shape rule.** The field never classifies what was typed. A length/prefix classifier is a guess
  about a key whose shape the client should not know, and it goes stale the day the number range
  rolls over.
- **Only `LOY-00100` cascades.** The correctness crux — everything else surfaces itself and stops.
- **The double miss is a client sentence.** `t('loy:search.noMatch', { typed })`, no toast, no red.
  This knowingly and narrowly bends api-envelope's "surface the server's message": the outcome is
  composed from two calls and each server sentence names only one of the things tried.
- **`LOY-00101` is a guard, not a path.** It exists so the screen is correct if the door ships before
  230's amendment rides into the BackOffice issue; its test case exists to say so.

**The browser sends what the agent typed** (compacted). Mobile normalisation is the door's job —
`LoyMobileNumbers.NormaliseTyped`, whose only production caller today is the *call-centre door*, not
the handler. ([228](228-whether-phase-1-waits-for-the-door.md))

### 4. Routes and screen state

| Route | State |
|---|---|
| `/loy/members` | the field, centred, and nothing else |
| `/loy/members/:loyId` | the member; the field collapsed to a bar |
| `/loy/members/:loyId?tab=sales` | ditto, opening on a named tab |

From the [layout prototype](assets/227-member-screen.PROTOTYPE.html), variant B:

- A successful resolve **navigates** to `/loy/members/:loyId`. The member read at that route is the
  screen's data source, so a refresh re-reads and a link works for a colleague.
- 🚩 **The URL holds the LoyId, never what was typed.** A refresh after a *mobile* lookup therefore
  re-reads by key and does **not** replay the two-call cascade — that sequence runs on submit only.
  The bar shows the typed key carried in navigation state, falling back to the LoyId on a cold load.
- The collapsed bar carries **the searched key only**. The member's name appears in exactly one
  place, the header. **Change** reopens the field in place, pre-filled; **New lookup** navigates to
  `/loy/members`.
- Tab selection is a query param so a link lands where it meant to. An unknown `?tab=` value falls
  back to Activities rather than erroring.

### 5. The member header

Not a tab, and **not sticky** — it scrolls away, and the grid's own header is what sticks, so a long
grid gets the viewport.

- **Identity line** — full name, large. Beneath it a key row: Loy ID · Mobile · Joined · Updated.
  The mobile shown is the payload's stored value, which *is* the normalised key.
- **Chips**, additive and independent, with no precedence rule
  ([230](230-a-member-who-is-blocked-or-archived.md)):
  - **tier** — always;
  - **member type** — whenever `memberType !== 'M'` (Archived · Non-loyalty · Family);
  - **blocked** — whenever `blockedReasonCode` is set.
  An ordinary member shows one chip. Blocked-and-archived shows three.
- **Points block** — `pointsBalance` as the only headline figure with `pointsBalanceAmount` +
  currency as its subline; `pendingPoints`, `pointsExpireSoon` ("within 30 days") and
  `tierPointsBalance` beside it at label size. Expiring is the only tinted figure and only when
  non-zero.
- **One disclosure, shut by default** — email, birth date, gender code, national ID, nationality
  code, city code, preferred language, insurance company.
- **Drawn nowhere:** `profile` (a dead constant), `accrualFactor`, `redemptionFactor`, `exchangeRate`,
  `pointsExpireSoonDays` (a never-assigned constant `30`), `profileUpdated`.
- **`birthDate` is a sentinel, not a null** — an unset value arrives as `0001-01-01` and must be
  guarded before display. Every other string on the member model is nullable in TypeScript
  regardless of what C# says, because C# has no nullable annotations there.

### 6. Codes

The rule, from [229](229-a-code-the-server-did-not-translate.md): **a code is data unless its value
set is closed in server source.** A ticket claiming a translation must name the `.cs` that closes the
set, or the code passes through.

`codes.ts` is a pure module: known value → key, unknown → `null`, and the component renders the
**bare code** when there is no key. Never `t(key, { defaultValue: code })` — same pixels, but the
guard would live at each call site as a convention instead of in one module a test enforces.

| Code | Translated? | Why |
|---|---|---|
| `tier` (`S`/`G`/`P`) | ✅ `t()` | closed by `LoyEndpoints.GetTiers` literals |
| `activityStatus` (`A`/`P`/`N`/`E`) | ✅ `t()` | closed by `LoyActivityStatusConstants` |
| `blockedReasonCode` (`CM`/`IA`) | ✅ `t()`, named exception | the set is an open master table, but both codes are **branch conditions in server logic** (`IA` *is* `IsInactive()`; `CM` is machine-written on mobile takeover). Superset of the degrade rule — an unseeded `XZ` renders `XZ`. |
| `gender` | ❌ pass through | 🚩 looks closed, is not — the member read hands over whatever sign-up wrote, unvalidated |
| `nationality`, `cityCode`, `storeCode`, `branchId` | ❌ pass through | open, table-backed, no endpoint on the door |
| `trxType` / `docType` | ❌ pass through | already .NET enum *names*; an undefined value serialises as the number as a string, so neither is a closed TS union |

**Labels say "code"** where the value is one: "City code", "Nationality code", "Store code".

**`blockedReason` is split at the model layer**, because the same server field name carries different
content on two payloads:

```ts
// src/core/models/loy.ts
interface LoyMember          { blockedReasonCode: string | null }        // the CODE
interface LoyMemberActionRow { blockedReasonDescription: string | null } // already-joined English
```

`i18n` keys land in `src/locales/en/loy.json` under `tier.*`, `activityStatus.*`, `blockedReason.*`.

### 7. The three tabs

**Fetch lazily on first open**, cached per member. Activities fetches when the member resolves.
Consequence that simplifies everything downstream: **only the open tab can be loading or failed**,
so there is no invisible broken tab to signal.

**Activities** — six columns: Date (`formatStamp`) · Activity · **Points** · Status · Expires ·
Reference.
- `points` arrives **already signed** from the server (`AddActivity` negates in place for debits) —
  there is no client-side debit/credit table and none is needed.
- Signed, `text-end`, tabular numerals, **exactly two decimals always**, and **never coloured**.
- Expires is blank when `points <= 0` (the server's own rule) and on a sentinel date.
- 🚩 **No client-side total, ever** — the server rounds each row, so a sum of rounded rows will not
  equal the header's `pointsBalance`.
- Ordered by insertion (`ActivityId DESC`), not by date: a backdated posting sorts by when it was
  written. Worth knowing; not worth a caveat on screen.

**Sales** — eight columns: Date · Receipt · Store · Item no. · **Item** · Qty · Unit price · Amount,
plus a ninth **Currency** column **only when the fetched rows hold more than one distinct currency**.
- 🚩 **Date-only, not `formatStamp`** — `TrxTime` is not selected by the report, so rendering `HH:mm`
  would print a fabricated `00:00` on every row.
- Money formats per its **row's** currency: 2 decimals for SAR, **3 for BHD** (Bahrain stores are
  live and BHD is the footprint's only 3-decimal currency). Nothing on this tab is summed, and
  nothing may be — the report does not select an exchange rate.
- `qty` and `amount` are signed on a return; **`unitPrice` is not**. A return line reads
  `-1.00 · 12.00 · -12.00`.
- Two source caveats to expect in the data: the SQL has no `LineType` filter, so non-item lines
  (discount, donation) can appear; and an `INNER JOIN Item` means a line whose item no longer exists
  vanishes silently.

**Actions** — seven columns: When (`formatStamp`) · **Action** · Sub-action · Details · Details 2 ·
By · Branch.
- 🚩 The **entire member snapshot is dropped** from the row — it is the member already on screen,
  repeated 25 times a page, and it puts PII in a grid for no reading benefit.
- Both description fields are LEFT JOINs and go null on an unknown code — each **falls back to its
  raw code**, never an empty cell.
- 🚩 **`LoyId` is always sent.** A bare call returns the first 25 actions of the **whole estate** —
  a silent cross-member leak, not an error. The door makes this unrepresentable; the client sends it
  anyway.

### 8. Volume, sort, filter

| Tab | Ceiling | Caption | Sort | Filter | Paging |
|---|---|---|---|---|---|
| Activities | 100, hard, no total | "Most recent 100 activities." + at-cap warning | ✓ | ✓ | — |
| Sales | 500, hard, no total | "Most recent 500 sales lines." + at-cap warning | ✓ | ✓ | — |
| Actions | none — real `recordsCount` | "312 actions." | ✗ | ✗ | 25/page, existing `GridPager` |

The at-cap warning fires when the returned count **equals** the cap. At exactly-100 that is a
harmless false positive; silence would be a false **negative** on a 4,000-row member, which is the
failure that matters. A bare row count is never shown on a capped tab — it reads as completeness.

Sort/filter follows one rule: **sort what you hold, never what you are paging through.** The Nphies
lists set `sortable: false` for exactly this reason; that binds Actions and does not bind the other
two, whose entire window is already in the browser.

`GridPager`'s house rule holds — a one-page result grows no pager, which is most members.

### 9. Empty, loading, failed — all per tab

- **Loading** in the tab body, with the volume caption already visible.
- **Empty** — a per-tab sentence in that tab's own words ("No loyalty activity for this member.",
  "No sales lines for this member.", "No actions recorded for this member."), never a shared
  "No data".
- **Failed** — the existing `core/ui/ErrorBanner` inline in the tab body, message via
  `apiErrorMessage(err, fallback)`, plus a **Retry scoped to that tab**. No toast. The header and the
  other two tabs are untouched.

Retry earns its place on specific evidence: the likeliest Sales failure is a SQL timeout on a heavy
member, which arrives as a **raw 500 with no envelope** (`ExecuteAsync` rethrows anything that is not
a `DomainException`) — transient, and often fine on a second attempt. The fallback string is
therefore what an agent actually reads there, not the server's message.

Empty and failed are never conflated. By the time a tab fetches, the member exists — only the
*member* call can refuse a bad key, and the reports answer `[]` for a member with no history.

### 10. No row links

Receipt number, activity reference and action number render as plain selectable text. Checked, not
assumed: no route accepts a retail transaction number, an `ActivityId` or an `ActionNo`, and the one
that looks like a candidate (`oms/document/:documentNo`) is a different identifier space that would
404 on every row.

### 11. Access

`GET LoyWeb/Access` → one probe, shared by the menu item and the screen's own in-page guard, on one
TanStack Query key. **Fails closed**: any error, any unseeded grant, any engine fault hides the nav
item and denies the screen. A deep link without the grant lands on the portal's existing denied
backstop.

## Testing Decisions

**What makes a good test here:** it states an external behaviour an agent could describe — "a 403
does not read as no-match", "an unknown tier renders as `X`", "a full page warns" — and it survives a
rewrite of how the module computes it. A test that asserts a call order, a hook's internals, or a
class name is testing the implementation and is deleted rather than fixed.

**Two seams, both already established in this repo, and no new one.** Confirmed with the user at
hand-off: this feature does **not** bootstrap React Testing Library — spec 083's ruling stands that
the pure modules are where regression is silent and the components are thin renderers, and RTL
remains the hardening ticket's to add.

### Seam 1 — pure modules, vitest, `environment: 'node'`

The repo's highest automated seam (`vitest.config.ts`, `src/**/*.test.ts`) and — decisively — **the
only proof available while the `LoyWeb` door does not exist.** Every decision worth regressing is
pushed into a pure module so it lands here:

| Module | What it pins |
|---|---|
| `resolve-member` | compaction (`+966 55 500 0111` → `966555000111`); blank → no-op; mobile hit in one call; `LOY-00100` → LoyId retry; 🚩 **403 / 500 / network do NOT cascade and do NOT read as no-match**; double miss → `noMatch` carrying the typed text; `LOY-00101` → the archived guard |
| `codes` | `S`/`G`/`P` and `A`/`P`/`N`/`E` map to keys; `CM`/`IA` map to keys; 🚩 an unknown value returns `null` so the caller renders the **bare code**, never a raw `loy:tier.X`; gender is never mapped |
| `member-header` | chip derivation — none for an ordinary member, type chip iff `memberType !== 'M'`, blocked chip iff `blockedReasonCode` set, both independently; the `0001-01-01` birth-date sentinel is suppressed |
| `tab-volume` | the caption per tab; at-cap warning fires at exactly the cap and not below; Actions states a real total and never a ceiling |
| `sales-columns` | the Currency column appears iff the rows hold >1 distinct currency; SAR 2dp vs BHD 3dp; a return renders signed qty/amount against an unsigned unit price |

Prior art to copy in shape: `src/features/nphies/authorizations/replay.test.ts`,
`submit-gate.test.ts`, `line-rules.test.ts` and `eligibility/list-params.test.ts` — same wave, same
posture, same "stubbed envelope in, decision out" style. `src/core/api.test.ts` is the model for
asserting on `ApiError` kinds and codes.

### Seam 2 — one Playwright drive, against stubbed envelopes

`tools/loy-member-drive.mjs`, on the pattern of `tools/nphies-eligibility-drive.mjs` and
`tools/callcenter-drive.mjs`: `npx vite --port 5199` in one shell, `node tools/loy-member-drive.mjs`
in another. Manual-run, not a CI gate. It captures the states the pure modules cannot:

the empty field · a resolved member and the collapsed bar · Change reopening pre-filled · New lookup
returning to the field · the double-miss empty state · each tab's first open (lazy fetch) · a tab
failing with its scoped Retry · a capped tab at exactly its cap · a blocked member · an archived
member · a BHD member showing the currency column · `/loy/members/:loyId?tab=sales` cold, straight
from the URL.

### Seam 3 — `npm run typecheck` and `npm run lint`

Every ticket, every time. Lint's three gates (import boundaries, token contrast, colour literals)
bind a new area folder in particular: `features/loy/*` may import `@/core/*` and never another
feature.

### 🚩 The standing verification rule for this whole wave

Set by [228](228-whether-phase-1-waits-for-the-door.md) and inherited by every ticket cut from this
spec: **no ticket may be called done on the strength of a live call.** The door will not exist.
Proof is typecheck + the pure suites + the drive against stubbed envelopes, and **each ticket's
answer says out loud that nothing was driven against a live SIS.Api.** The mocks are built from
[223's field inventory](assets/223-loy-reads-field-inventory.RESEARCH.md) and cannot drift from the
contract, because the contract is a field list read off C# classes rather than a design.

## Out of Scope

- **Every mutating Loy act** — block/unblock, tier update, change mobile, redeem, transfer,
  compensation, activate, enrol. Phase 1 is a read, by the user's ruling.
- **The other seven WPF IC views** — Call, Complain, ComplainItem, ICFamilyMembers, ICHistory,
  Redistribution, UpdateDistribution. The case-management half of IC is a different effort.
- **`Loy/Reports/LastPurchases`** — a fourth read the API offers that no WPF view uses.
- **WPF's Activity Summary grid and its Old Account (Mobile) field** — ruled obsolete by the user at
  hand-off (2026-08-06). The destination stands at general information plus three tabs.
- **Faithfully reproducing the WPF Sales grid.** WPF queries `RetailTrxDetail` through NHibernate
  with no endpoint behind it; the web takes what `LoyaltySales` gives, lets the columns differ, and
  **creates no endpoint for it.**
- **Any lookup call** for tiers, blocked reasons, cities, nationalities or genders. The door stays at
  four reads plus the probe.
- **Export / CSV** from any tab — two of the three are silently capped, and a file outlives the
  caption that qualifies it. Revisit when the server offers a real count.
- **Row links to a detail screen.** No such route exists in phase 1.
- **React Testing Library.** Not bootstrapped here.
- **A member picker / disambiguation UI.** One mobile resolves to at most one member by construction.

### Boundaries: the BackOffice door

The server half is **not built by tickets cut from this spec.** It is a separate issue in
`C:\Work\DMSCO\BackOffice\.issues\`, minted by `/to-tickets` alongside the build tickets (the
912–922 precedent), and cited here so no client ticket silently assumes it. It must carry, in these
words:

1. A new `LoyWeb/*` endpoints file. **Four routes**, each `.AllowCookieSession()` +
   `ApiKeyEndpointFilter` + `LoyMemberGrantEndpointFilter`, delegating to `LoyEndpoints.GetLoyMember`
   / `GetLoyMemberByMobile` and the three `LoyReportService` reads. No new query or report.
2. 🚩 **`MemberByMobile` applies `LoyMobileNumbers.NormaliseTyped` *before* delegating.** Its only
   production caller today is `CallCenterWebEndpoints.cs:230` — the *door*, not the handler — so a
   `LoyWeb` that correctly "delegates to the existing handler" delegates **past** the normalisation
   and reproduces verbatim the live-driven bug where `0555000111` misses a base keyed `966555000111`.
   `Tests/Data.Tests/CallCenterWeb/CallCenterWebMemberLookupTests.cs` already pins the behaviour and
   the new door should be held to it.
3. 🚩 **`LoyMemberActions` must be unreachable without a `LoyId`** — called bare it returns the first
   25 actions of the whole estate. The door is the right place to make that unrepresentable.
4. `GET LoyWeb/Access`, cookie-only, **not** grant-gated, reading the same gate object as the filter.
5. A newly minted **`BackOfficeScreen[LoyMember,03]`** + fail-closed `ILoyMemberScreenGate` — not
   WPF's legacy `"IC"` (retail-floor audience), not `CallCenter,03` (wrong audience). Fail closed on
   no userId, unseeded grant, missing tables or any engine fault; engine `*/*` wildcard for
   superusers, no ADMIN bypass.
6. `Seed-*-Screen-Authorization.sql` **deployed before** the API, plus the Authz Admin role binding —
   or the door locks out the floor it exists to admit.

Plus **two amendments from [230](230-a-member-who-is-blocked-or-archived.md)**, which arrived after
228 specified the door as pure delegation and must not be lost:

7. 🚩 The `LoyWeb` member projection **maps `MemberType` through**. `LoyMemberModel` carries no such
   field today, so without this the screen presents an archived member as a live one with no tell.
   The field is already on the `LoyMember` entity — this is a mapping line, not a new query.
8. 🚩 The `LoyWeb` LoyId read **drops the `LOY-00101` archived refusal**, so both keys resolve the
   same member. `Loy/*` and `CallCenterWeb/*` are untouched; only the new door relaxes.

`CallCenterWeb` keeps its two existing routes. Two doors over one handler is the no-drift rule
working as designed, not duplication.

## Further Notes

- **WPF is a source, not a target.** The user's ruling on this map: divergence is wanted, not
  tolerated. IC is where the *data* and the *domain rules* are read from — never the layout, the
  control choices, or the interaction. A ticket that justifies a decision with "because that's what
  WPF does" has answered the wrong question. Reach instead for
  [logical-tailwind](../.claude/rules/logical-tailwind.md), the steel-blue POS palette that is the
  app standard, and the shapes the call-centre and Nphies screens established.
- **The layout is drawn, not described.** [227's prototype](assets/227-member-screen.PROTOTYPE.html)
  is a working page in both themes — open it before building the header or the tab strip. It carries
  the two rejected variants too, which is why the chosen arrangement is the chosen one.
- **A stale hit is possible and harmless.** `MemberByMobile` is FusionCache'd for 45 s;
  `Member/{loyId}` is not cached. Re-searching the same mobile inside 45 s can return a member up to
  45 s old. Phase 1 changes nothing about the member, so there is nothing to be stale *about* —
  recorded here so it is not rediscovered as a bug.
- **Every string on the member model is nullable in TypeScript.** C# has no nullable annotations in
  `LoyMemberModel`, so the field inventory's "TS" column is the authority, not the C# type.
- **Loyalty vocabulary belongs in `CONTEXT.md`.** The glossary carries no Loy terms yet — *member*,
  *Loy ID*, *tier*, *activity*, *blocked reason*, *member type*, *action* should land there as the
  build makes them concrete. `/domain-modeling` maintains it.
- **Phase 2's seam is deliberately undrawn.** Where a future modification act would attach was left
  dim on the map on purpose: naming it early invites building it. The area folder is the only
  concession made to it.
