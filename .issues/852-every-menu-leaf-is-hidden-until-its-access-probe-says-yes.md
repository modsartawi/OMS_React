---
status: open
spec: C:\Work\DMSCO\BackOffice\.issues\3459-every-oms-react-menu-area-has-an-access-door-and-executives-get-one-role.md
blocked-by: BackOffice 3459
---

# 852 — Every menu leaf is hidden until its Access probe says yes

## Why

A Ua user with no roles sees Insurance rules, Campaigns, the store engine switch, Prescription sessions and Send
Broadcast (found 2026-11-07, C-level analytics demo). The pages refuse, but the menu should not offer them.
BackOffice 3459 adds the probes.

## What to build

- **Campaigns** (`layout/menu-model.ts:1149`, `:1197`, `:1205`): gate each leaf on `GET Rules/Access`
  (`canAuthor` / `canApprove` / `canSupport`); the group hides when no leaf is visible. Drop the 🚩 UNGATED comments.
- **Store engine switch** (`:718`): `canSwitchEngine`.
- **Insurance rules** (`layout/menu-insurance-rules.ts`): each leaf on its `GET InsuranceRules/Access` flag;
  the payer-month leaf keeps `InsurancePayerMonthWeb/Access`.
- **Prescription sessions** (`:402`): `GET PrescriptionSessionWeb/Access` `canView`.
- **Send Broadcast** (`features/admin/broadcast/api.ts`): **fail closed** — a 404 is hidden, not allowed.
- Each page's route guard reads the SAME key/call/predicate as its leaf (one cache entry), as the other probes.

## Proof

- [x] Menu test: a probe set of all-false shows none of the five areas; each flag alone shows only its leaf.
      (`src/layout/menu-access-852.test.ts`, 36 cases, over the REAL `MENU`.)
- [x] Broadcast: `Notifications/Access` 404 → leaf hidden. (Same test file, stubbed at `@/core/api`; drive step 1.)
- [x] Pending or errored probe → hidden (no flash-then-hide), as `accessProbe` already does. (Pending, errored,
      `{}`, `null` and malformed `"true"`/`1` answers all hide every leaf of the five.)
- [ ] Staging walk: sign in as a no-role user and as a user holding only `EXECUTIVE` — the menu shows Home,
      Analytics and the copilot button, and nothing from the five areas.

## Boundaries

Takes the menu-probe half out of 520 and 618; their staging walks stay with them. No page behaviour changes.

## Done when

The staging walk above passes.

## Comments

### 2026-11-07 — client half built, stubbed (stays open: BackOffice 3459 is open and nothing of it is deployed)

Built against 3459's **proposed** wire; the staging walk is the only Proof line left.

- **Probes.** `GET Rules/Access` → `@/core/rules/access` (Campaigns and the engine switch are two areas, so it is
  shared); `GET InsuranceRules/Access` → `@/core/insurance-rules/access`; `GET PrescriptionSessionWeb/Access` →
  `features/oms/prescription-sessions/access` (one reader). Each exports ONE key, a `…Query()` options factory and
  its predicates; all three **fail closed** (no 404-tolerant catch; only an explicit `true` grants).
- **Campaigns leaf → flag** (my mapping; 3459 names the flags, not the leaves): Promotions, Priority, Simulator and
  Campaign uploads on `canAuthor || canApprove` (all read `RuleAuthoring`, which both roles hold); Campaign upload
  on `canAuthor` alone (a workbook makes drafts); Sessions, Coupon finder, Customers on `canSupport`. Engine
  switch on `canSwitchEngine`. Nine leaves, one key, one call.
- 🚩 **Insurance flag names are a guess.** 3459 left "per leaf or per grant" open (preferring per leaf), so each
  leaf reads `can` + its `menu.*` key (`canGuards` … `canIdfGroups`, 24 flags). `INSURANCE_RULES_FLAGS` is the
  one list to re-point; the menu test pins the naming rule and `tools/access-852-grants.test.mjs` pins the drives'
  copy. ⚠ There is **no payer-month leaf on main**, so "keeps `InsurancePayerMonthWeb/Access`" had nothing to keep.
- **Broadcast** no longer maps a 404 to allowed; `BroadcastAccessResult.probed` is gone. The page is unchanged:
  an errored probe (a 404 included) still draws the compose card for a deep link, as it did for a transient error.
- ⚠ **No page route guards were added**, against the "What to build" line, because Boundaries says *no page
  behaviour changes* and every one of these pages already names its doors' bare 403. The keys and query factories
  are exported so a later gate shares the leaf's cache entry; Broadcast's page already does.
- **Drives.** 28 existing drives answered any `*/Access` all-false and would have lost their rail leaf; each now
  asks `granted852(p)` (`tools/access-852-grants.mjs`) first, and the five "ungated — no probe call" checks now
  assert the leaf rode `GET Rules/Access`. New `tools/menu-access-852-drive.mjs` **18/18** (no-role, EXECUTIVE,
  each flag alone, Broadcast 404/false/true, one call per probe). Re-run green: engine-switch 56, campaigns 219,
  priority 50, sessions 73, simulator 71, support-lookups 43, campaign-uploads 272, prescription-sessions-hq 122,
  insurance-rules 86, insurance-editions 90, insurance-approvals 126, insurance-templates 92, idf-masters 86,
  idf-lookup 54. The other 14 insurance/IDF drives got the same one-line stub and were not re-run.
- typecheck + build clean; `npm test` 9800/9800. `npm run lint` fails only on
  `features/insurance-rules/aliases/door-shapes.test.ts` (four cross-feature imports, committed 2026-11-01, untouched here).

### 2026-11-07 — reviews (/code-review, /standards-review); BackOffice 3459 is DONE (`6e30f2224`, undeployed)

- ✅ **The insurance names are no longer a guess.** 3459's Answer took one flag per leaf with exactly these 24 names
  (`InsuranceRulesAccessWebEndpoints.cs`), and `Rules/Access` / `PrescriptionSessionWeb/Access` match the client.
  The 🚩 wording is gone. The blocker is done, but the ticket stays open: **SIS.Api is not on staging**, so the walk waits.
- 🚩 **Do not deploy this before 3459 is on the same host.** Every probe fails closed, so on a server without the
  doors, all of Campaigns, all of Insurance rules, the engine switch, HQ prescription sessions and (with the center
  off) Send Broadcast hide for every user.
- **Fixed in review:**
  - The Broadcast page takes the shell's options (`broadcastAccessQuery`: no retry, `staleTime: Infinity`), so a
    404 is one call, not a retried one.
  - The key is the exported `BROADCAST_ACCESS_KEY`.
  - Comments now name each flag's real grant.
  - The test constant is `PROBE_KEYS`.
- ⚠ **Mapping caveats, recorded rather than changed:**
  - The authoring screens open on `[RuleAuthoring, 03]`, which 3459 gives no flag. `canAuthor || canApprove` stands
    in because the seeds bind 03 to both roles. So an approver sees Simulator and is refused on Simulate.
  - Coupon finder and Customers ride `canSupport` provisionally, because their doors do not exist yet.
- **Left for the owner:**
  - Page route guards. The ticket contradicts itself ("route guard reads the SAME key" vs "No page behaviour
    changes"); Broadcast is the only page that shares its key today.
  - On an errored probe, the Broadcast page still draws the compose card: unchanged, and moot once 3459 answers
    `false`.
  - `canWriteOff` is unread: the write-off button still learns from its bare 403.
  - A shared "explicit true" predicate helper, a probe dedupe in `useVisibleMenu` (duplicate query keys predate
    this ticket: Collections, Materials and the rest share keys across leaves), and moving `accessProbe` to a leaf
    module so `menu-insurance-rules` needs no cast.
