---
type: wayfinder-ticket
wayfinder: grilling
map: 222
status: done
blocked-by: 223
---

# 225 — One field that resolves a member

## Question

Decided at charting: **one smart input**, not WPF's country dropdown plus number, and not a
mobile/LoyId toggle. The user types one thing and the app resolves it. That leaves the rule
unwritten, and the rule is where this screen is won or lost:

- **What tells a mobile from a LoyId?** Length, prefix, character class? What do real LoyIds look
  like — and can a LoyId ever be mistaken for a mobile, or vice versa? (223 has the model; a sample
  of real values would settle it faster than reasoning.)
- ~~**Normalization.**~~ 🚩 **Settled — do not re-open, and do not build.**
  [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md) fixed it: the
  browser **sends what the agent typed**, and `LoyWeb/MemberByMobile` applies
  `LoyMobileNumbers.NormaliseTyped` server-side, as `CallCenterWeb` already does. No dialling-code
  prefixing, no `PadLeft`, no country rule anywhere in `features/loy/` — the rule that builds the
  loyalty base's key lives in one place (879 §4). WPF's dropdown and its commented-out
  `PadLeft(10, '0')` are evidence of the problem, not a design to port. What is still open is only
  what the *field* accepts and how it reflects a typed value back — trimming, spaces, a leading `+`,
  and whether the user is shown the normalised number after a hit.
- **The fallback.** WPF tries mobile, and on a miss retries the **raw, un-prefixed** text as a
  LoyId. Is a fallback wanted at all under a smart field, or does the discrimination rule make it
  dead code? If a fallback stays, what does a double miss say to the user — WPF's answer is
  *"Mobile number doesn't exists!"*, which is wrong whenever a LoyId was typed.
- **Ambiguity and the empty case.** Can one mobile resolve to more than one member (family
  profiles, a reused number)? WPF has a commented-out family-lookup dialog that suggests it once
  could. What does the screen do with a blank input, a member that doesn't exist, and an error that
  isn't a miss (network, refusal)? A not-found is not a failure and shouldn't read like one.

Grill until every branch of "what did the user just type" has an answer.

## Answer

**There is no discrimination rule, and there was never a decision to make — the rule is dead code
before it is written.** The field does not classify what was typed. `resolveMember(typed)` calls
`LoyWeb/MemberByMobile/{typed}` and, **only** on a `LOY-00100` business miss, calls
`LoyWeb/Member/{typed}`. WPF's fallback survives, but inverted in meaning: WPF retried as a last
resort after guessing wrong, this retries *by design* because guessing is what goes stale.

Every branch of "what did the user just type":

| Typed | What happens |
|---|---|
| blank / whitespace only | **no-op** — no call, no message, nothing to say |
| `0555000111`, `555000111`, `966555000111`, `+966 55 500 0111` | compacted to digits → mobile hit (1 call) |
| `971501234567` (a caller in Dubai) | mobile hit — `NormaliseTyped` parses against all six countries |
| `100001293` (a LoyId) | mobile miss `LOY-00100` → LoyId hit (2 calls) |
| an archived member's **mobile** | **resolves normally**, with an Archived chip (230) |
| an archived member's **LoyId** | **resolves normally too** — 230 drops the refusal on the door; if `LOY-00101` ever arrives, *"Member 100001293 is archived."*, never "no match" |
| neither | neutral empty state: *"No member matches 0555000111."* |
| door shut (403) / server down / network | **its own message, no retry** — a refusal is not an absence |

### The seven rulings

1. **No shape rule — try both, mobile first.** A length/prefix classifier is a guess about a key
   whose shape the client is not supposed to know, and it goes stale the day the number range rolls
   over. Two cheap GETs do not. Mobile leads because a call centre takes phone calls.
2. **The sequence lives in the client** — `features/loy/api.ts`, `resolveMember(typed)`. A
   server-side `LoyWeb/ResolveMember` would widen the door past
   [Whether phase 1 waits for the door](228-whether-phase-1-waits-for-the-door.md)'s "the four reads
   and nothing else", and — decisive under that ticket's verification standard — a client-side rule
   is a **pure module with a vitest suite**, provable with SIS.Api down, where a server-side one is
   unprovable until the door ships.
3. **Only `LOY-00100` cascades.** `kind: 'business'` + that code retries as a LoyId; any other
   business code shows the server's message and stops; `auth` / `server` / `network` show themselves
   and stop. 🚩 This is the correctness crux: [224](224-who-may-look-a-member-up.md) found an
   ungranted portal call gets a **bare 403**, and a cascade-on-anything rule would render the shut
   door — and every outage — as *"no member matches"*, doubling load on a dead API while lying about
   why.
4. **The field compacts to digits.** Strip whitespace, dashes, parens, and a leading `+`; send the
   rest verbatim. 🚩 **Found while grilling, and it is a live server-side bug, not a client concern
   invented here:** `LoyMobileNumbers.Parse` does `.Trim().TrimStart('+')` and **nothing else** — it
   never strips internal separators, so a pasted `+966 55 500 0111` matches no dialling code, falls
   through to the SA branch, and misses. Compaction is not the normalisation rule the map reserved
   for the server: no dialling code, no `PadLeft`, no country logic, nothing that builds the key.
5. **The box is never rewritten.** The member header shows the payload's stored `Mobile` — which
   *is* the normalised key, supplied by the server rather than computed here. The typed text stays
   put so a typo is correctable rather than half-corrected under the agent's hands.
6. **A double miss is a neutral client sentence in an empty state** — `t('loy:search.noMatch',
   { typed })`, no toast, no red. Knowingly and narrowly bending
   [api-envelope](../.claude/rules/api-envelope.md)'s "surface the server's message": the outcome is
   composed from *two* calls and each server sentence (`"Customer with {mobile} doesn't exists"` /
   `"Customer {loyId} doesn't exists"`) names only one of the things tried. A not-found is a fact,
   not a failure.
7. **Explicit submit** — Enter or the button; blank submit is silent. Debounced as-you-type makes a
   partial number indistinguishable from a genuine miss, flashing the empty state accusingly while
   the agent is still typing, at up to two calls per pause.

8. **`LOY-00101` is never a no-match — but it is now a guard, not a path.**
   [A member who is blocked or archived](230-a-member-who-is-blocked-or-archived.md) resolved
   concurrently with this ticket and **dissolves the branch**: the `LoyWeb` LoyId read **drops the
   archived refusal** and maps `MemberType` through, so both keys resolve the same member and the
   archived fact is carried by a header chip instead of an error. The ruling put to the user — that
   an archived refusal must read as *"Member 100001293 is archived."* and **never** as *"No member
   matches…"* — is kept as a **defensive mapping in `resolveMember`**, because it costs one branch
   and it is exactly what protects the screen if the door ships before 230's amendment rides into
   the BackOffice issue. It is expected to be unreachable in production, and its vitest case exists
   to say so.

### Two questions the ticket asked that the code answered outright

- **Ambiguity does not exist.** One mobile resolves to **at most one member, by construction**:
  `LoyMemberRepository.GetMemberByMobile` is a `FirstOrDefault`, and on any mobile change
  `LoyMemberUpdateService.UpdateMemberThatUseSameMobile` **blanks the previous holder's mobile** and
  blocks them with `BlockedReason = ChangeMobile`. Family members each hold their own LoyId and
  their own mobile. WPF's commented-out `LoyaltyCustomerFamilyLookupController` dialog is dead code,
  not a lost feature — **no disambiguation UI, no member-picker, no list-then-choose.**
- **The try-both rule cannot collide, and the reason is structural.** A LoyId is pure digits,
  fixed-width, zero-padded, no prefix — `NumberRangeService` → `CurrentNumberRange.ToString(new
  string('0', FromNumber.Length))`; the real value in the tree is `100001293`, **9 digits**. Stored
  mobiles always carry a dialling code (`966` + 9 = 12 digits), and `NormaliseTyped` *always*
  prepends one before searching. So a typed LoyId is searched as `966100001293` — 12 digits that no
  real key can equal — and misses cleanly into the LoyId call. This holds even if the range one day
  mints a LoyId beginning `966…`: that parses to a 9-digit key where real SA keys are 12.

### What this ticket did not decide

- **How an archived or blocked member displays once resolved** — settled concurrently by
  [230](230-a-member-who-is-blocked-or-archived.md): two independent header chips. Ruling 8 fixes
  only what *search* says on a refusal that should no longer occur.
- **Where the search box sits, and what happens to it after a hit** —
  [The shape of the member screen](227-the-shape-of-the-member-screen.md).
- **A stale hit is possible and harmless.** `MemberByMobile` is FusionCache'd 45 s
  (`Loy_LoyMemberByMobile_{mobile}_{branchId}`); `Member/{loyId}` is not cached. Re-searching the
  same mobile within 45 s can return a member up to 45 s old. Phase 1 changes nothing about the
  member, so there is nothing to be stale *about* — recorded so it is not rediscovered as a bug.

🚩 **Nothing here was driven against a live SIS.Api**, per the map's verification standard: the
`LoyWeb/*` door does not exist yet. Every fact above comes from reading BackOffice source
(`LoyMobileNumbers`, `LoyMemberRepository`, `LoyMemberUpdateService`, `NumberRangeRepository`,
`SearchViewModel`) and from [223's field inventory](assets/223-loy-reads-field-inventory.RESEARCH.md).
The build ticket proves the rule with a vitest suite over `resolveMember` against stubbed envelopes.
